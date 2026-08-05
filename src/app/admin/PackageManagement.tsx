import { useState, useEffect, useMemo } from "react";
import Modal from "../components/Modal";
import { Package, Plus, Edit, Trash2, Loader2, MapPin } from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

export interface Pkg {
  id: string;
  name: string;
  duration: number;
  price: number;
  zoneId: string; // Storing ID instead of hardcoded name string
  active: boolean;
}

export interface Zone {
  id: string;
  name: string;
  status: string;
}

const emptyForm = {
  name: "",
  duration: 30,
  price: 0,
  zoneId: "all",
  active: true,
};

export default function PackageManagement() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 1. Listen to Real-time `zones` collection
  useEffect(() => {
    const zonesRef = collection(db, "zones");
    const unsubscribeZones = onSnapshot(
      zonesRef,
      (snapshot) => {
        const fetchedZones: Zone[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Unnamed Zone",
          status: d.data().status || "active",
        }));
        setZones(fetchedZones);
      },
      (error) => {
        console.error("Firestore Zones error:", error);
      },
    );

    return () => unsubscribeZones();
  }, []);

  // Map for quick ID -> Name lookup
  const zoneMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("all", "All Zones");
    zones.forEach((z) => map.set(z.id, z.name));
    return map;
  }, [zones]);

  // 2. Listen to Real-time `packages` collection
  useEffect(() => {
    const packagesRef = collection(db, "packages");
    const unsubscribePackages = onSnapshot(
      packagesRef,
      (snapshot) => {
        const fetchedPackages: Pkg[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            duration: Number(data.duration) ?? 30,
            price: Number(data.price) ?? 0,
            zoneId: data.zoneId || "all",
            active: data.active ?? true,
          };
        });
        setPackages(fetchedPackages);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Packages error:", error);
        toast.error("Failed to load packages");
        setLoading(false);
      },
    );

    return () => unsubscribePackages();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (p: Pkg) => {
    setForm({
      name: p.name,
      duration: p.duration,
      price: p.price,
      zoneId: p.zoneId,
      active: p.active,
    });
    setEditId(p.id);
    setShowForm(true);
  };

  // 3. Save Package with linked Zone ID
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    try {
      const selectedZoneName = zoneMap.get(form.zoneId) || "All Zones";

      if (editId) {
        const pkgRef = doc(db, "packages", editId);
        await updateDoc(pkgRef, {
          name: form.name,
          duration: form.duration,
          price: form.price,
          zoneId: form.zoneId,
          active: form.active,
        });

        addNotification({
          type: "success",
          title: "Package Updated",
          message: `"${form.name}" updated (₱${form.price}, Access: ${selectedZoneName}).`,
          role: "admin",
        });
        toast.success(`${form.name} updated`, {
          description: `₱${form.price} · ${selectedZoneName}`,
        });
      } else {
        const pkgRef = doc(collection(db, "packages"));
        await setDoc(pkgRef, {
          name: form.name,
          duration: form.duration,
          price: form.price,
          zoneId: form.zoneId,
          active: form.active,
          createdAt: serverTimestamp(),
        });

        addNotification({
          type: "success",
          title: "Package Added",
          message: `New package "${form.name}" created for ${selectedZoneName}.`,
          role: "admin",
        });
        toast.success(`${form.name} added`, {
          description: `₱${form.price} · ${selectedZoneName}`,
        });
      }

      setShowForm(false);
    } catch (err) {
      console.error("Firestore Package save error:", err);
      toast.error("Failed to save package.");
    } finally {
      setSaving(false);
    }
  };

  // 4. Delete Package
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const pkg = packages.find((p) => p.id === deleteId);
      await deleteDoc(doc(db, "packages", deleteId));

      if (pkg) {
        addNotification({
          type: "error",
          title: "Package Deleted",
          message: `Package "${pkg.name}" removed from system.`,
          role: "admin",
        });
        toast.error(`${pkg.name} deleted`);
      }

      setDeleteId(null);
    } catch (err) {
      console.error("Firestore Package delete error:", err);
      toast.error("Failed to delete package.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-dark-slate mb-2 font-bold text-2xl">
              Package Management
            </h1>
            <p className="text-gray">
              Manage play packages and live zone access
            </p>
          </div>
          <button
            onClick={openAdd}
            className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" /> Add Package
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-ocean-blue" />
            <span>Loading packages...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              // Automatic reactive resolution of Zone Name from zoneMap
              const currentZoneName = zoneMap.get(pkg.zoneId) || "Deleted Zone";

              return (
                <div
                  key={pkg.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-ocean-blue to-sky-blue rounded-xl flex items-center justify-center">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        pkg.active
                          ? "bg-success/10 text-success"
                          : "bg-gray/10 text-gray"
                      }`}
                    >
                      {pkg.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="text-dark-slate font-semibold text-lg mb-4">
                    {pkg.name}
                  </h3>
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray">Duration:</span>
                      <span className="text-dark-slate font-medium">
                        {pkg.duration === -1
                          ? "Unlimited"
                          : `${pkg.duration} minutes`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray">Price:</span>
                      <span className="text-dark-slate font-bold text-xl">
                        ₱{pkg.price}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray">Zone Access:</span>
                      <span className="inline-flex items-center gap-1 font-medium text-ocean-blue bg-ocean-blue/5 px-2 py-0.5 rounded-md">
                        <MapPin className="w-3 h-3" />
                        {currentZoneName}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(pkg)}
                      className="flex-1 px-4 py-2 border-2 border-ocean-blue text-ocean-blue rounded-xl hover:bg-ocean-blue hover:text-white transition-all flex items-center justify-center gap-2 font-medium"
                    >
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(pkg.id)}
                      className="px-4 py-2 border-2 border-error text-error rounded-xl hover:bg-error hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {packages.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray bg-white rounded-2xl border border-gray/10">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No packages found. Click "Add Package" to create one.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <Modal
          title={editId !== null ? "Edit Package" : "Add New Package"}
          onClose={() => setShowForm(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-gray text-sm font-medium">
                Package Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                placeholder="e.g. Kiddie Pass A"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray text-sm font-medium">
                Duration (minutes, -1 = Unlimited)
              </label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) =>
                  setForm({ ...form, duration: Number(e.target.value) })
                }
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray text-sm font-medium">
                Price (₱)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray text-sm font-medium">
                Link to Zone Access
              </label>
              <select
                value={form.zoneId}
                onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
                className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
              >
                <option value="all">All Zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray text-sm font-medium">Status:</span>
              <button
                type="button"
                onClick={() => setForm({ ...form, active: !form.active })}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  form.active
                    ? "bg-success/10 text-success"
                    : "bg-gray/10 text-gray"
                }`}
              >
                {form.active ? "Active" : "Inactive"}
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </>
                ) : editId !== null ? (
                  "Save Changes"
                ) : (
                  "Add Package"
                )}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteId !== null && (
        <Modal
          title="Delete Package"
          onClose={() => setDeleteId(null)}
          size="sm"
        >
          <p className="text-gray mb-6">
            Are you sure you want to delete{" "}
            <strong className="text-dark-slate">
              {packages.find((p) => p.id === deleteId)?.name}
            </strong>
            ? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-error text-white rounded-xl hover:bg-red-600 transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-medium"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete"
              )}
            </button>
            <button
              onClick={() => setDeleteId(null)}
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
