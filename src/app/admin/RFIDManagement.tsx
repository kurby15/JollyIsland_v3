import { useState, useEffect, useMemo } from "react";
import Modal from "../components/Modal";
import {
  Radio,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  Loader2,
  Wifi,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";

export interface RFIDCard {
  id: string; // RFID Tag UID
  pagerNumber?: string;
  status: "available" | "assigned" | "lost" | "disabled";
  customer?: string;
  assignedDate?: string | Timestamp;
  createdAt?: Timestamp;
}

const emptyForm = {
  id: "",
  pagerNumber: "",
  status: "available" as RFIDCard["status"],
};

export default function RFIDManagement() {
  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Form & Modal States
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RFIDCard | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Read: Real-time listener for Firestore `rfid_cards` collection
  useEffect(() => {
    setLoadingCards(true);
    const rfidRef = collection(db, "rfid_cards");

    const unsubscribeCards = onSnapshot(
      rfidRef,
      (snapshot) => {
        const fetchedCards: RFIDCard[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          let formattedAssignedDate = "-";
          if (data.assignedDate) {
            if (typeof data.assignedDate === "string") {
              formattedAssignedDate = data.assignedDate;
            } else if (data.assignedDate.toDate) {
              formattedAssignedDate = data.assignedDate
                .toDate()
                .toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
            }
          }

          return {
            id: docSnap.id,
            pagerNumber: data.pagerNumber || "-",
            status: data.status || "available",
            customer: data.customer || "-",
            assignedDate: formattedAssignedDate,
            createdAt: data.createdAt,
          };
        });

        setCards(fetchedCards);
        setLoadingCards(false);
      },
      (error) => {
        console.error("Firestore RFID read error:", error);
        toast.error("Failed to load RFID cards from Firestore");
        setLoadingCards(false);
      },
    );

    return () => unsubscribeCards();
  }, []);

  // --- RFID AUTO-FILL LISTENER ---
  // Listens for incoming live scans while the "Add RFID" modal is open
  useEffect(() => {
    // Only listen if modal is open, we're not editing, and form isn't completed yet
    if (!showForm || editId || saved) return;

    const logsQuery = query(
      collection(db, "rfid_logs"),
      where("processed", "==", false),
      limit(1),
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const logData = change.doc.data();
          const scannedUid = logData.uid || logData.cardId;

          if (scannedUid) {
            const formattedUid = String(scannedUid).trim().toUpperCase();

            // Auto-fill UID into form
            setForm((prev) => ({ ...prev, id: formattedUid }));
            toast.info(`Card Scanned: ${formattedUid}`);

            // Mark log entry as processed so it won't re-trigger
            try {
              await updateDoc(doc(db, "rfid_logs", change.doc.id), {
                processed: true,
              });
            } catch (err) {
              console.error("Failed to mark scan log as processed:", err);
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [showForm, editId, saved]);

  // Auto-Release Listener: Syncs with `registrations` to free RFIDs when completed/exited
  useEffect(() => {
    const regsRef = collection(db, "registrations");
    const unsubscribeRegs = onSnapshot(regsRef, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === "modified" || change.type === "added") {
          const data = change.doc.data();
          const isCompleted =
            data.status === "exited" ||
            data.status === "completed" ||
            data.returned === true ||
            Boolean(data.exitedAt);

          const rfidId =
            data.rfidCardId || data.rfidTag || data.rfid || data.tagCode;

          if (isCompleted && rfidId) {
            try {
              const cardRef = doc(
                db,
                "rfid_cards",
                String(rfidId).toUpperCase(),
              );
              const cardSnap = await getDoc(cardRef);

              if (cardSnap.exists() && cardSnap.data().status === "assigned") {
                await updateDoc(cardRef, {
                  status: "available",
                  customer: "-",
                  assignedDate: "-",
                });
              }
            } catch (err) {
              console.error("Error auto-releasing RFID card:", err);
            }
          }
        }
      }
    });

    return () => unsubscribeRegs();
  }, []);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      const matchSearch =
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        (c.customer &&
          c.customer.toLowerCase().includes(search.toLowerCase())) ||
        (c.pagerNumber &&
          c.pagerNumber.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = filterStatus ? c.status === filterStatus : true;
      return matchSearch && matchStatus;
    });
  }, [cards, search, filterStatus]);

  const stats = useMemo(
    () => [
      {
        label: "Total Cards",
        count: cards.length,
        color: "from-purple-600 to-indigo-500",
      },
      {
        label: "Available",
        count: cards.filter((c) => c.status === "available").length,
        color: "from-emerald-green to-mint-green",
      },
      {
        label: "Assigned",
        count: cards.filter((c) => c.status === "assigned").length,
        color: "from-ocean-blue to-sky-blue",
      },
      {
        label: "Lost",
        count: cards.filter((c) => c.status === "lost").length,
        color: "from-orange-500 to-orange-400",
      },
      {
        label: "Disabled",
        count: cards.filter((c) => c.status === "disabled").length,
        color: "from-gray to-gray/70",
      },
    ],
    [cards],
  );

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setSaved(false);
    setShowForm(true);
  };

  const openEdit = (card: RFIDCard) => {
    setForm({
      id: card.id,
      pagerNumber: card.pagerNumber === "-" ? "" : card.pagerNumber || "",
      status: card.status,
    });
    setEditId(card.id);
    setSaved(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.id.trim()) return;
    setSaving(true);

    const formattedId = form.id.trim().toUpperCase();
    const formattedPager = form.pagerNumber.trim().toUpperCase() || "-";

    try {
      if (editId) {
        const cardRef = doc(db, "rfid_cards", editId);

        const updatePayload: any = {
          pagerNumber: formattedPager,
          status: form.status,
        };
        if (form.status === "available") {
          updatePayload.customer = "-";
          updatePayload.assignedDate = "-";
        }

        await updateDoc(cardRef, updatePayload);

        addNotification({
          type: "info",
          title: "RFID Card Updated",
          message: `Card ${formattedId} status changed to "${form.status}".`,
          role: "both",
        });
        toast.success(`Card ${formattedId} updated`, {
          description: `Status: ${form.status}`,
        });
      } else {
        const cardRef = doc(db, "rfid_cards", formattedId);
        const docSnap = await getDoc(cardRef);

        if (docSnap.exists()) {
          toast.error("Card ID already exists", {
            description: `${formattedId} is already registered in database.`,
          });
          setSaving(false);
          return;
        }

        await setDoc(cardRef, {
          pagerNumber: formattedPager,
          status: form.status,
          customer: "-",
          assignedDate: "-",
          createdAt: serverTimestamp(),
        });

        addNotification({
          type: "success",
          title: "RFID Card Added",
          message: `New RFID card ${formattedId} added to system.`,
          role: "both",
        });
        toast.success(`Card ${formattedId} added`, {
          description: `Status: ${form.status}${formattedPager !== "-" ? ` · Pager ${formattedPager}` : ""}`,
        });
      }

      setSaved(true);
    } catch (err) {
      console.error("Firestore save error:", err);
      toast.error("Failed to save RFID card.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await deleteDoc(doc(db, "rfid_cards", deleteTarget.id));

      addNotification({
        type: "error",
        title: "RFID Card Deleted",
        message: `Card ${deleteTarget.id} has been removed from the system.`,
        role: "admin",
      });
      toast.error(`Card ${deleteTarget.id} deleted`, {
        description: "Removed from RFID inventory",
      });

      setDeleteTarget(null);
    } catch (err) {
      console.error("Firestore delete error:", err);
      toast.error("Failed to delete RFID card.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-dark-slate mb-2 text-2xl font-bold">
              RFID Management
            </h1>
            <p className="text-gray">Manage RFID card inventory and status</p>
          </div>
          <button
            onClick={openAdd}
            className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" /> Add RFID Card
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${stat.color} rounded-2xl p-5 text-white shadow-sm`}
            >
              <p className="text-white/80 text-sm mb-1 font-medium">
                {stat.label}
              </p>
              <p className="text-3xl font-bold">{stat.count}</p>
            </div>
          ))}
        </div>

        {/* RFID Cards List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search RFID cards or pager number..."
                className="w-full pl-10 pr-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors"
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="lost">Lost</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray/20">
                  <th className="text-left py-3 px-4 text-gray font-medium">
                    RFID Tag UID
                  </th>
                  <th className="text-left py-3 px-4 text-gray font-medium">
                    Pager #
                  </th>
                  <th className="text-left py-3 px-4 text-gray font-medium">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-gray font-medium">
                    Assigned To
                  </th>
                  <th className="text-left py-3 px-4 text-gray font-medium">
                    Date Created / Assigned
                  </th>
                  <th className="text-left py-3 px-4 text-gray font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingCards ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-ocean-blue" />
                        <span>Loading RFID cards...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((card) => (
                    <tr
                      key={card.id}
                      className="border-b border-gray/10 hover:bg-light-gray transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-ocean-blue" />
                          <span className="text-dark-slate font-mono font-bold">
                            {card.id}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-dark-slate font-medium">
                        {card.pagerNumber || "-"}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            card.status === "assigned"
                              ? "bg-ocean-blue/10 text-ocean-blue"
                              : card.status === "available"
                                ? "bg-success/10 text-success"
                                : card.status === "lost"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-gray/10 text-gray"
                          }`}
                        >
                          {card.status.charAt(0).toUpperCase() +
                            card.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray">{card.customer}</td>
                      <td className="py-4 px-4 text-gray text-sm">
                        {typeof card.assignedDate === "string"
                          ? card.assignedDate
                          : "-"}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(card)}
                            className="p-2 text-ocean-blue hover:bg-ocean-blue/10 rounded-lg transition-all"
                            title="Edit Card"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(card)}
                            className="p-2 text-error hover:bg-error/10 rounded-lg transition-all"
                            title="Remove Card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray">
                      No RFID cards found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <Modal
          title={editId ? "Edit RFID Card" : "Add New RFID Card"}
          onClose={() => setShowForm(false)}
        >
          {!saved ? (
            <div className="space-y-4">
              {/* Scan indicator badge for adding new cards */}
              {!editId && (
                <div className="p-3 bg-ocean-blue/10 border border-ocean-blue/20 rounded-xl flex items-center gap-3 text-ocean-blue text-sm font-medium">
                  <Wifi className="w-4 h-4 animate-pulse text-ocean-blue" />
                  <span>
                    Ready to scan. Tap an RFID tag on the scanner to auto-fill
                    UID.
                  </span>
                </div>
              )}

              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  RFID Tag UID
                </label>
                <input
                  value={form.id}
                  disabled={!!editId}
                  onChange={(e) =>
                    setForm({ ...form, id: e.target.value.toUpperCase() })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none disabled:opacity-60 uppercase font-mono"
                  placeholder="Scan or enter RFID UID..."
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Pager Number
                </label>
                <input
                  value={form.pagerNumber}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pagerNumber: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none uppercase"
                  placeholder="E.G. P-102"
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as RFIDCard["status"],
                    })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="available">Available</option>
                  <option value="assigned">Assigned</option>
                  <option value="lost">Lost</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!form.id.trim() || saving}
                  className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : editId ? (
                    "Save Changes"
                  ) : (
                    "Add Card"
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
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h4 className="text-dark-slate mb-2 font-bold text-lg">
                {editId ? "Changes Saved!" : "RFID Card Added!"}
              </h4>
              <p className="text-gray mb-6">
                <strong>{form.id.toUpperCase()}</strong> has been{" "}
                {editId ? "updated" : "added"} successfully.
              </p>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          title="Remove RFID Card"
          onClose={() => setDeleteTarget(null)}
          size="sm"
        >
          <p className="text-gray mb-6">
            Are you sure you want to remove{" "}
            <strong className="text-dark-slate">{deleteTarget.id}</strong>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-error text-white rounded-xl hover:bg-red-600 transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-medium"
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
              onClick={() => setDeleteTarget(null)}
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
