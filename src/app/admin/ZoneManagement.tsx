import { useState, useEffect, useMemo } from "react";
import Modal from "../components/Modal";
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  Users,
  CheckCircle,
  AlertTriangle,
  Wifi,
  Loader2,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

export type ZoneStatus = "active" | "inactive" | "maintenance";

export interface Zone {
  id: string;
  name: string;
  description: string;
  capacity: number;
  status: ZoneStatus;
  color: string;
  minAge: number;
  maxAge: number;
  scannerId: string;
  scannerName?: string;
  createdAt?: Timestamp;
}

export interface RFIDScanner {
  id: string;
  name: string;
  model: string;
  status: "active" | "inactive" | "maintenance";
  zoneId: string;
  zoneName?: string;
}

export interface Registration {
  id: string;
  childName?: string;
  rfidCardId?: string;
  packageName?: string;
  packageId?: string;
  status?: string;
  returned?: boolean;
  zoneName?: string;
  zoneId?: string;
  createdAt?: Timestamp;
}

const emptyForm = {
  name: "",
  description: "",
  capacity: 10,
  status: "active" as ZoneStatus,
  color: "ocean-blue",
  minAge: 3,
  maxAge: 15,
  scannerId: "",
};

const STATUS_STYLE: Record<ZoneStatus, string> = {
  active: "bg-success/10 text-success",
  inactive: "bg-gray/10 text-gray",
  maintenance: "bg-warning/10 text-warning",
};

export default function ZoneManagement() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [scanners, setScanners] = useState<RFIDScanner[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pkgMap, setPkgMap] = useState<
    Record<string, { zoneId: string; zoneName: string }>
  >({});
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<"add" | "edit" | "delete" | "view" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Zone | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | ZoneStatus>("all");

  // 1. Real-time listener for Firestore `zones` collection
  useEffect(() => {
    const zonesRef = collection(db, "zones");
    const unsubscribeZones = onSnapshot(
      zonesRef,
      (snapshot) => {
        const fetchedZones: Zone[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || data.zoneName || "",
            description: data.description || "",
            capacity: Number(data.capacity || data.maxCapacity) || 0,
            status: data.status || "active",
            color: data.color || "ocean-blue",
            minAge: Number(data.minAge) || 0,
            maxAge: Number(data.maxAge) || 99,
            scannerId: data.scannerId || "",
            scannerName: data.scannerName || "",
            createdAt: data.createdAt,
          };
        });
        setZones(fetchedZones);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Zones error:", error);
        toast.error("Failed to load zones");
        setLoading(false);
      },
    );

    return () => unsubscribeZones();
  }, []);

  // 2. Real-time listener for Firestore `rfid_scanners` collection
  useEffect(() => {
    const scannersRef = collection(db, "rfid_scanners");
    const unsubscribeScanners = onSnapshot(
      scannersRef,
      (snapshot) => {
        const fetchedScanners: RFIDScanner[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || d.id,
            model: data.model || "Standard RFID Reader",
            status: data.status || "active",
            zoneId: data.zoneId || "",
            zoneName: data.zoneName || "",
          };
        });
        setScanners(fetchedScanners);
      },
      (error) => {
        console.error("Firestore Scanners error:", error);
      },
    );

    return () => unsubscribeScanners();
  }, []);

  // 3. Real-time listener for `packages` lookup table
  useEffect(() => {
    const packagesRef = collection(db, "packages");
    const unsubscribePackages = onSnapshot(packagesRef, (snapshot) => {
      const pkgs: Record<string, { zoneId: string; zoneName: string }> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        pkgs[docSnap.id] = {
          zoneId: data.zoneId || data.zone_id || "",
          zoneName: data.zones || data.zoneName || "",
        };
      });
      setPkgMap(pkgs);
    });

    return () => unsubscribePackages();
  }, []);

  // 4. Real-time listener for `registrations` (Live Monitoring reference)
  useEffect(() => {
    const regsRef = collection(db, "registrations");
    const unsubscribeRegs = onSnapshot(
      regsRef,
      (snapshot) => {
        const activeRegs: Registration[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              childName:
                data.childName || data.customerName || data.name || "Guest",
              rfidCardId: data.rfidCardId || data.rfidTag || data.rfid || "",
              packageName: data.packageName || "Standard Pass",
              packageId: data.packageId || "",
              status: data.status ?? "",
              returned: Boolean(data.returned),
              zoneName: data.zoneName ?? "",
              zoneId: data.zoneId ?? "",
              createdAt: data.createdAt,
            };
          })
          .filter((reg) => reg.status !== "completed" && reg.returned !== true);

        setRegistrations(activeRegs);
      },
      (error) => {
        console.error("Firestore Registrations error:", error);
      },
    );

    return () => unsubscribeRegs();
  }, []);

  // Map active registrations to their respective zones with package fallback
  const zoneOccupantsMap = useMemo(() => {
    const map: Record<string, Registration[]> = {};

    registrations.forEach((reg) => {
      let key = reg.zoneId;

      if (!key && reg.packageId && pkgMap[reg.packageId]) {
        key = pkgMap[reg.packageId].zoneId || pkgMap[reg.packageId].zoneName;
      }

      if (!key) {
        key = reg.zoneName || "unassigned";
      }

      if (!map[key]) map[key] = [];
      map[key].push(reg);
    });

    return map;
  }, [registrations, pkgMap]);

  const filtered =
    filterStatus === "all"
      ? zones
      : zones.filter((z) => z.status === filterStatus);

  const openAdd = () => {
    setForm(emptyForm);
    setSaved(false);
    setModal("add");
  };

  const openEdit = (z: Zone) => {
    setForm({
      name: z.name,
      description: z.description,
      capacity: z.capacity,
      status: z.status,
      color: z.color,
      minAge: z.minAge,
      maxAge: z.maxAge,
      scannerId: z.scannerId || "",
    });
    setSelected(z);
    setSaved(false);
    setModal("edit");
  };

  const openDelete = (z: Zone) => {
    setSelected(z);
    setModal("delete");
  };

  const openView = (z: Zone) => {
    setSelected(z);
    setModal("view");
  };

  const closeModal = () => {
    setModal(null);
    setSelected(null);
    setSaved(false);
  };

  // Create & Update operations
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    try {
      const batch = writeBatch(db);

      let savedZoneId = selected?.id;
      if (!savedZoneId) {
        const newZoneRef = doc(collection(db, "zones"));
        savedZoneId = newZoneRef.id;
      }

      const zoneRef = doc(db, "zones", savedZoneId);
      const selectedScanner = scanners.find((s) => s.id === form.scannerId);

      const zoneData: Record<string, any> = {
        name: form.name,
        description: form.description,
        capacity: form.capacity,
        status: form.status,
        color: form.color,
        minAge: form.minAge,
        maxAge: form.maxAge,
        scannerId: form.scannerId,
        scannerName: selectedScanner ? selectedScanner.name : "",
      };

      if (modal === "add") {
        zoneData.createdAt = serverTimestamp();
        batch.set(zoneRef, zoneData);
      } else {
        batch.update(zoneRef, zoneData);
      }

      // Unassign previous scanner if changed
      const previousScannerId = selected?.scannerId;
      if (previousScannerId && previousScannerId !== form.scannerId) {
        const oldScannerRef = doc(db, "rfid_scanners", previousScannerId);
        batch.update(oldScannerRef, {
          zoneId: "",
          zoneName: "",
        });
      }

      // Assign new scanner
      if (form.scannerId) {
        const newScannerRef = doc(db, "rfid_scanners", form.scannerId);
        batch.update(newScannerRef, {
          zoneId: savedZoneId,
          zoneName: form.name,
        });
      }

      await batch.commit();

      if (modal === "edit") {
        addNotification({
          type: "info",
          title: "Zone Updated",
          message: `Zone "${form.name}" updated.`,
          role: "admin",
        });
        toast.success(`${form.name} updated`);
      } else {
        addNotification({
          type: "success",
          title: "Zone Added",
          message: `New zone "${form.name}" added.`,
          role: "admin",
        });
        toast.success(`${form.name} added`);
      }

      setSaved(true);
    } catch (err) {
      console.error("Firestore Zone save error:", err);
      toast.error("Failed to save zone changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);

    try {
      const batch = writeBatch(db);

      if (selected.scannerId) {
        const scRef = doc(db, "rfid_scanners", selected.scannerId);
        batch.update(scRef, {
          zoneId: "",
          zoneName: "",
        });
      }

      const zoneRef = doc(db, "zones", selected.id);
      batch.delete(zoneRef);

      await batch.commit();

      addNotification({
        type: "error",
        title: "Zone Deleted",
        message: `Zone "${selected.name}" has been removed.`,
        role: "admin",
      });
      toast.error(`${selected.name} deleted`);

      closeModal();
    } catch (err) {
      console.error("Firestore Zone delete error:", err);
      toast.error("Failed to delete zone.");
    } finally {
      setDeleting(false);
    }
  };

  // Totals calculated from live registrations reference
  const totalCapacity = useMemo(
    () => zones.reduce((s, z) => s + z.capacity, 0),
    [zones],
  );

  const totalCurrent = useMemo(() => registrations.length, [registrations]);

  const activeCount = useMemo(
    () => zones.filter((z) => z.status === "active").length,
    [zones],
  );

  return (
    <>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-dark-slate mb-2 font-bold text-2xl">
              Zone Management & Live Occupancy
            </h1>
            <p className="text-gray">
              Configure play zones and monitor real-time child entries per zone
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-light-gray p-1 rounded-xl border border-gray/10">
              {(["all", "active", "inactive", "maintenance"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      filterStatus === s
                        ? "bg-white text-dark-slate shadow-sm"
                        : "text-gray hover:text-dark-slate"
                    }`}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={openAdd}
              className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" /> Add Zone
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: "Total Zones",
              value: zones.length,
              icon: MapPin,
              color: "text-ocean-blue bg-ocean-blue/10",
            },
            {
              label: "Active Zones",
              value: activeCount,
              icon: CheckCircle,
              color: "text-success bg-success/10",
            },
            {
              label: "Total Active Entries",
              value: `${totalCurrent}/${totalCapacity}`,
              icon: Users,
              color: "text-emerald-500 bg-emerald-500/10",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl shadow-sm border border-gray/10 p-5"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl text-dark-slate font-bold">{value}</p>
              <p className="text-gray text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Zone Cards Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-ocean-blue" />
            <span>Syncing live entries and zone data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((zone) => {
              const activeChildren =
                zoneOccupantsMap[zone.id] || zoneOccupantsMap[zone.name] || [];
              const currentOccupants = activeChildren.length;

              const pct =
                zone.capacity > 0
                  ? Math.min(
                      100,
                      Math.round((currentOccupants / zone.capacity) * 100),
                    )
                  : 0;
              const isBusy = pct >= 70;
              const isFull = pct >= 90;

              const assignedScanner = scanners.find(
                (s) => s.id === zone.scannerId,
              );

              return (
                <div
                  key={zone.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all flex flex-col justify-between ${
                    zone.status !== "active"
                      ? "border-gray/10 opacity-75"
                      : isFull
                        ? "border-error/30"
                        : isBusy
                          ? "border-warning/30"
                          : "border-gray/10"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-ocean-blue/10 text-ocean-blue flex items-center justify-center">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-dark-slate font-semibold">
                            {zone.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                STATUS_STYLE[zone.status]
                              }`}
                            >
                              {zone.status.charAt(0).toUpperCase() +
                                zone.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openView(zone)}
                          className="p-2 text-gray hover:text-ocean-blue hover:bg-ocean-blue/5 rounded-lg transition-all"
                          title="View Live Entries"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(zone)}
                          className="p-2 text-ocean-blue hover:bg-ocean-blue/10 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDelete(zone)}
                          className="p-2 text-error hover:bg-error/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-gray text-sm mb-4 line-clamp-2">
                      {zone.description || "No description provided."}
                    </p>

                    {/* Occupancy Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-gray font-medium">
                          Occupancy Level
                        </span>
                        <span className="text-xs font-bold text-dark-slate">
                          {currentOccupants} / {zone.capacity}
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isFull
                              ? "bg-error"
                              : isBusy
                                ? "bg-warning"
                                : "bg-ocean-blue"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray">
                          Age:{" "}
                          {zone.minAge === 0
                            ? "Any"
                            : `${zone.minAge}–${
                                zone.maxAge === 99 ? "99+" : zone.maxAge
                              } yrs`}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            isFull
                              ? "text-error"
                              : isBusy
                                ? "text-warning"
                                : "text-success"
                          }`}
                        >
                          {isFull ? "Full" : isBusy ? "Busy" : "Available"} •{" "}
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Live Registered Entries Box */}
                    <div className="mb-4 p-3 bg-light-gray/60 rounded-xl border border-gray/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-dark-slate flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-ocean-blue" />
                          Live Occupants
                        </span>
                        <button
                          onClick={() => openView(zone)}
                          className="text-xs text-ocean-blue font-medium hover:underline flex items-center"
                        >
                          View all <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {currentOccupants === 0 ? (
                        <p className="text-xs text-gray italic">
                          No active entry in this zone
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {activeChildren.slice(0, 3).map((child) => (
                            <span
                              key={child.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray/10 rounded-lg text-xs text-dark-slate font-medium shadow-2xs"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                              {child.childName}
                            </span>
                          ))}
                          {currentOccupants > 3 && (
                            <span className="inline-flex items-center px-2 py-1 bg-ocean-blue/10 text-ocean-blue rounded-lg text-xs font-semibold">
                              +{currentOccupants - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scanner Display */}
                    {assignedScanner || zone.scannerName ? (
                      <div className="flex items-center gap-2 p-2.5 bg-ocean-blue/5 rounded-xl border border-ocean-blue/10">
                        <Wifi className="w-4 h-4 text-ocean-blue flex-shrink-0" />
                        <span className="text-xs text-ocean-blue font-medium truncate">
                          Scanner: {assignedScanner?.name || zone.scannerName}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 bg-gray/5 rounded-xl border border-gray/10">
                        <Wifi className="w-4 h-4 text-gray/40 flex-shrink-0" />
                        <span className="text-xs text-gray/50 italic">
                          No RFID scanner assigned
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-1 md:col-span-2 xl:col-span-3 py-16 text-center text-gray bg-white rounded-2xl border border-gray/10">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No zones match the current filter.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal
          title={
            modal === "edit" ? `Edit Zone — ${selected?.name}` : "Add New Zone"
          }
          onClose={closeModal}
          size="lg"
        >
          {!saved ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Zone Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors"
                  placeholder="e.g. Ninja Warrior Course"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors resize-none"
                  placeholder="Brief description of this play zone..."
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Max Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: +e.target.value })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as ZoneStatus })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Min Age
                </label>
                <input
                  type="number"
                  min="0"
                  max="18"
                  value={form.minAge}
                  onChange={(e) =>
                    setForm({ ...form, minAge: +e.target.value })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Max Age (99 = no limit)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.maxAge}
                  onChange={(e) =>
                    setForm({ ...form, maxAge: +e.target.value })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                />
              </div>

              {/* 1-to-1 RFID Scanner Dropdown */}
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Assigned RFID Scanner (1 Zone = 1 Scanner)
                </label>
                <select
                  value={form.scannerId}
                  onChange={(e) =>
                    setForm({ ...form, scannerId: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="">-- No Scanner Assigned --</option>
                  {scanners.map((scanner) => {
                    const isAssignedToOther =
                      scanner.zoneId && scanner.zoneId !== selected?.id;
                    return (
                      <option key={scanner.id} value={scanner.id}>
                        {scanner.name} ({scanner.model})
                        {isAssignedToOther
                          ? ` - Assigned to ${scanner.zoneName}`
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim() || saving}
                  className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : modal === "edit" ? (
                    "Save Changes"
                  ) : (
                    "Add Zone"
                  )}
                </button>
                <button
                  onClick={closeModal}
                  className="px-6 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h4 className="text-dark-slate mb-2 font-medium text-lg">
                {modal === "edit" ? "Zone Updated!" : "Zone Added!"}
              </h4>
              <p className="text-gray mb-6">
                <strong>{form.name}</strong> saved successfully.
              </p>
              <button
                onClick={closeModal}
                className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {modal === "delete" && selected && (
        <Modal title="Remove Zone" onClose={closeModal} size="sm">
          <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl flex gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-dark-slate text-sm">
              Removing <strong>{selected.name}</strong> will unassign its
              connected RFID scanner.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-error text-white rounded-xl hover:bg-red-600 transition-all font-medium disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Removing…
                </>
              ) : (
                "Remove Zone"
              )}
            </button>
            <button
              onClick={closeModal}
              className="flex-1 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all font-medium"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* View Live Entries & Zone Details Modal */}
      {modal === "view" && selected && (
        <Modal title={`${selected.name} — Live Occupants`} onClose={closeModal}>
          <div className="space-y-5">
            <p className="text-gray text-sm">
              {selected.description || "No description provided."}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-light-gray rounded-xl">
                <p className="text-xs text-gray">Status</p>
                <p className="text-sm font-semibold text-dark-slate capitalize">
                  {selected.status}
                </p>
              </div>
              <div className="p-3 bg-light-gray rounded-xl">
                <p className="text-xs text-gray">Capacity</p>
                <p className="text-sm font-semibold text-dark-slate">
                  {selected.capacity} Max
                </p>
              </div>
              <div className="p-3 bg-light-gray rounded-xl">
                <p className="text-xs text-gray">Current Occupants</p>
                <p className="text-sm font-semibold text-ocean-blue">
                  {
                    (
                      zoneOccupantsMap[selected.id] ||
                      zoneOccupantsMap[selected.name] ||
                      []
                    ).length
                  }
                </p>
              </div>
              <div className="p-3 bg-light-gray rounded-xl">
                <p className="text-xs text-gray">Age Limit</p>
                <p className="text-sm font-semibold text-dark-slate">
                  {selected.minAge}–
                  {selected.maxAge === 99 ? "99+" : selected.maxAge} yrs
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-dark-slate mb-3">
                Active Children Currently in Zone
              </h4>

              {(() => {
                const activeInZone =
                  zoneOccupantsMap[selected.id] ||
                  zoneOccupantsMap[selected.name] ||
                  [];

                if (activeInZone.length === 0) {
                  return (
                    <div className="p-6 text-center text-gray border border-gray/10 rounded-xl bg-light-gray/50">
                      No children actively checked into this zone right now.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {activeInZone.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray/10 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-ocean-blue/10 text-ocean-blue flex items-center justify-center text-xs font-bold">
                            {child.childName?.[0]?.toUpperCase() || "G"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-dark-slate">
                              {child.childName}
                            </p>
                            <p className="text-xs text-gray font-mono">
                              RFID: {child.rfidCardId || "N/A"}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 bg-ocean-blue/10 text-ocean-blue rounded-full font-medium">
                          {child.packageName}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-2">
              <button
                onClick={closeModal}
                className="w-full py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
