import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import {
  Plus,
  Edit,
  Trash2,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Loader2,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

export type ScannerStatus = "active" | "inactive" | "maintenance";

export interface RFIDScanner {
  id: string;
  name: string;
  serialNumber: string;
  status: ScannerStatus;
  zoneId: string;
  zoneName?: string;
}

export interface Zone {
  id: string;
  name: string;
  scannerId?: string;
}

const STATUS_STYLE: Record<ScannerStatus, string> = {
  active: "bg-success/10 text-success",
  inactive: "bg-gray/10 text-gray",
  maintenance: "bg-warning/10 text-warning",
};

const emptyForm = {
  name: "",
  serialNumber: "",
  status: "active" as ScannerStatus,
  zoneId: "",
};

export default function RFIDScannerManagement() {
  const [scanners, setScanners] = useState<RFIDScanner[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<RFIDScanner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Real-time listener for Firestore `rfid_scanners` collection
  useEffect(() => {
    const scannersRef = collection(db, "rfid_scanners");
    const unsubscribeScanners = onSnapshot(
      scannersRef,
      (snapshot) => {
        const fetchedScanners: RFIDScanner[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            serialNumber: data.serialNumber || "",
            status: data.status || "active",
            zoneId: data.zoneId || "",
            zoneName: data.zoneName || "",
          };
        });
        setScanners(fetchedScanners);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Scanners error:", error);
        toast.error("Failed to load RFID scanners");
        setLoading(false);
      },
    );

    return () => unsubscribeScanners();
  }, []);

  // Real-time listener for Firestore `zones` collection
  useEffect(() => {
    const zonesRef = collection(db, "zones");
    const unsubscribeZones = onSnapshot(
      zonesRef,
      (snapshot) => {
        const fetchedZones: Zone[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            scannerId: data.scannerId || "",
          };
        });
        setZones(fetchedZones);
      },
      (error) => {
        console.error("Firestore Zones error:", error);
      },
    );

    return () => unsubscribeZones();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setSaved(false);
    setModal("add");
  };

  const openEdit = (s: RFIDScanner) => {
    setForm({
      name: s.name,
      serialNumber: s.serialNumber,
      status: s.status,
      zoneId: s.zoneId || "",
    });
    setSelected(s);
    setSaved(false);
    setModal("edit");
  };

  const openDelete = (s: RFIDScanner) => {
    setSelected(s);
    setModal("delete");
  };

  const closeModal = () => {
    setModal(null);
    setSelected(null);
    setSaved(false);
  };

  // Create & Update operations with 1-to-1 sync
  const handleSave = async () => {
    if (!form.name.trim() || !form.serialNumber.trim()) return;
    setSaving(true);

    try {
      const selectedZoneObj = zones.find((z) => z.id === form.zoneId);
      const targetZoneName = selectedZoneObj ? selectedZoneObj.name : "";

      const batch = writeBatch(db);
      let scannerDocId = selected?.id;

      if (modal === "edit" && selected) {
        const scannerRef = doc(db, "rfid_scanners", selected.id);
        batch.update(scannerRef, {
          name: form.name,
          serialNumber: form.serialNumber,
          status: form.status,
          zoneId: form.zoneId,
          zoneName: targetZoneName,
        });

        addNotification({
          type: "info",
          title: "Scanner Updated",
          message: `Scanner "${form.name}" updated.`,
          role: "admin",
        });
        toast.success(`${form.name} updated`);
      } else {
        const scannerRef = doc(collection(db, "rfid_scanners"));
        scannerDocId = scannerRef.id;

        batch.set(scannerRef, {
          name: form.name,
          serialNumber: form.serialNumber,
          status: form.status,
          zoneId: form.zoneId,
          zoneName: targetZoneName,
          createdAt: serverTimestamp(),
        });

        addNotification({
          type: "success",
          title: "Scanner Registered",
          message: `Scanner "${form.name}" registered.`,
          role: "admin",
        });
        toast.success(`${form.name} registered`);
      }

      // 1. Unassign scanner from previous zone if changed
      const previousZoneId = selected?.zoneId;
      if (previousZoneId && previousZoneId !== form.zoneId) {
        const oldZoneRef = doc(db, "zones", previousZoneId);
        batch.update(oldZoneRef, {
          scannerId: "",
          scannerName: "",
        });
      }

      // 2. Assign scanner to new zone (if selected)
      if (form.zoneId && scannerDocId) {
        const newZoneRef = doc(db, "zones", form.zoneId);
        batch.update(newZoneRef, {
          scannerId: scannerDocId,
          scannerName: form.name,
        });
      }

      await batch.commit();
      setSaved(true);
    } catch (err) {
      console.error("Firestore Scanner save error:", err);
      toast.error("Failed to save scanner details.");
    } finally {
      setSaving(false);
    }
  };

  // Delete operation
  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);

    try {
      const batch = writeBatch(db);

      // Unassign scanner from its connected zone
      if (selected.zoneId) {
        const zoneRef = doc(db, "zones", selected.zoneId);
        batch.update(zoneRef, {
          scannerId: "",
          scannerName: "",
        });
      }

      // Delete scanner
      batch.delete(doc(db, "rfid_scanners", selected.id));
      await batch.commit();

      addNotification({
        type: "error",
        title: "Scanner Removed",
        message: `Scanner "${selected.name}" removed.`,
        role: "admin",
      });
      toast.error(`${selected.name} removed`);

      closeModal();
    } catch (err) {
      console.error("Firestore Scanner delete error:", err);
      toast.error("Failed to delete scanner.");
    } finally {
      setDeleting(false);
    }
  };

  const active = scanners.filter((s) => s.status === "active").length;
  const assigned = scanners.filter((s) => Boolean(s.zoneId)).length;

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-dark-slate mb-2 font-bold text-2xl">
              RFID Scanner Management
            </h1>
            <p className="text-gray">
              Register scanners and assign them 1-to-1 to play zones
            </p>
          </div>
          <button
            onClick={openAdd}
            className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" /> Add Scanner
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: "Total Scanners",
              value: scanners.length,
              color: "ocean-blue",
              icon: Wifi,
            },
            {
              label: "Active & Online",
              value: active,
              color: "success",
              icon: CheckCircle,
            },
            {
              label: "Assigned to Zone",
              value: assigned,
              color: "emerald-green",
              icon: MapPin,
            },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="bg-white rounded-2xl shadow-sm border border-gray/10 p-5 flex items-center gap-4"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-5 h-5 text-${color}`} />
              </div>
              <div>
                <p className={`text-2xl font-semibold text-${color}`}>
                  {value}
                </p>
                <p className="text-gray text-sm">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          {loading ? (
            <div className="flex justify-center items-center py-16 text-gray gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-ocean-blue" />
              <span>Loading scanners...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray/20">
                    {[
                      "Name",
                      "Serial Number",
                      "Status",
                      "Assigned Zone",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left py-3 px-4 text-gray font-medium text-sm"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scanners.map((scanner) => (
                    <tr
                      key={scanner.id}
                      className="border-b border-gray/10 hover:bg-light-gray transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              scanner.status === "active"
                                ? "bg-success/10"
                                : "bg-gray/10"
                            }`}
                          >
                            {scanner.status === "active" ? (
                              <Wifi className="w-4 h-4 text-success" />
                            ) : (
                              <WifiOff className="w-4 h-4 text-gray" />
                            )}
                          </div>
                          <span className="text-dark-slate font-medium">
                            {scanner.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray font-mono text-sm uppercase">
                        {scanner.serialNumber}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[scanner.status]}`}
                        >
                          {scanner.status.charAt(0).toUpperCase() +
                            scanner.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {scanner.zoneName ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-ocean-blue/10 text-ocean-blue px-2.5 py-1 rounded-lg font-medium">
                            <MapPin className="w-3.5 h-3.5" />
                            {scanner.zoneName}
                          </span>
                        ) : (
                          <span className="text-gray text-sm italic">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(scanner)}
                            className="p-2 text-ocean-blue hover:bg-ocean-blue/10 rounded-lg transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDelete(scanner)}
                            className="p-2 text-error hover:bg-error/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {scanners.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray">
                        No scanners registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal
          title={
            modal === "edit"
              ? `Edit Scanner — ${selected?.name}`
              : "Add New Scanner"
          }
          onClose={closeModal}
        >
          {!saved ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Scanner Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Entrance Scanner A"
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Serial Number
                </label>
                <input
                  value={form.serialNumber}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serialNumber: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. SN-2024-007"
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none uppercase font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as ScannerStatus,
                    })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              {/* 1-to-1 Zone Dropdown */}
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray text-sm font-medium">
                  Assign to Zone (1-to-1)
                </label>
                <select
                  value={form.zoneId}
                  onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="">-- No Zone Assigned --</option>
                  {zones.map((z) => {
                    const isOccupiedByOther =
                      z.scannerId && z.scannerId !== selected?.id;
                    return (
                      <option key={z.id} value={z.id}>
                        {z.name}
                        {isOccupiedByOther ? " (Already assigned)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={
                    !form.name.trim() || !form.serialNumber.trim() || saving
                  }
                  className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : modal === "edit" ? (
                    "Save Changes"
                  ) : (
                    "Add Scanner"
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
                {modal === "edit" ? "Scanner Updated!" : "Scanner Added!"}
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

      {/* Delete Confirm */}
      {modal === "delete" && selected && (
        <Modal title="Remove Scanner" onClose={closeModal} size="sm">
          <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl flex gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-dark-slate text-sm">
              Remove <strong>{selected.name}</strong>? This will unassign it
              from its connected zone.
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
                "Remove"
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
    </>
  );
}
