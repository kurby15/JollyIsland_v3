import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import { Skeleton } from "../components/ui/skeleton";
import { useRefresh } from "../contexts/RefreshContext";
import {
  Users,
  Activity,
  TrendingUp,
  MapPin,
  Download,
  CheckCircle,
  Bell,
  Loader2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";

export interface LiveSession {
  id: string;
  rfidCardId: string;
  childName: string;
  zoneId?: string;
  zoneName: string;
  packageName: string;
  entryTimeStr: string;
  createdAtMs: number;
  remainingStr: string;
  progress: number;
  status: "active" | "warning" | "expiring";
}

export interface ZoneItem {
  id: string;
  name: string;
  maxCapacity?: number;
}

type ModalType = "export" | "alerts" | null;

export default function LiveMonitoring() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<ModalType>(null);
  const [exportDone, setExportDone] = useState(false);
  const [alertTarget, setAlertTarget] = useState("all");
  const [alertMsg, setAlertMsg] = useState("");
  const [alertSent, setAlertSent] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const { refreshCounter, nextRefreshSeconds, forceRefresh, isRefreshing } =
    useRefresh();

  // 1. Fetch Zones from Firestore
  useEffect(() => {
    const zonesRef = collection(db, "zones");
    const unsubscribe = onSnapshot(
      zonesRef,
      (snapshot) => {
        const fetchedZones: ZoneItem[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.data().zoneName || "Play Zone",
          maxCapacity: Number(doc.data().maxCapacity) || 50,
        }));
        setZones(fetchedZones);
      },
      (error) => console.error("Error loading zones:", error),
    );
    return () => unsubscribe();
  }, []);

  // 2. Fetch Active Registrations & Live Real-Time Time Tracking
  useEffect(() => {
    setLoading(true);
    const regRef = collection(db, "registrations");

    const unsubscribe = onSnapshot(
      regRef,
      (snapshot) => {
        const now = Date.now();

        const activeSessions: LiveSession[] = snapshot.docs
          .filter((docSnap) => {
            const data = docSnap.data();
            return data.status !== "completed" && data.returned !== true;
          })
          .map((docSnap) => {
            const data = docSnap.data();

            // Uses the precise timestamp generated when scanned by ESP32 or fallback
            let startMs = now;
            if (data.startTimeStamp) {
              startMs = Number(data.startTimeStamp);
            } else if (data.createdAt instanceof Timestamp) {
              startMs = data.createdAt.toMillis();
            } else if (typeof data.createdAt === "string") {
              startMs = new Date(data.createdAt).getTime() || now;
            }

            let durationMins = 60;
            if (
              data.totalDuration !== undefined &&
              data.totalDuration !== null
            ) {
              durationMins = Number(data.totalDuration);
            } else if (data.duration !== undefined && data.duration !== null) {
              durationMins = Number(data.duration);
            }

            const isUnlimited =
              durationMins === -1 || data.isUnlimited === true;

            const elapsedMinutes = Math.floor((now - startMs) / (1000 * 60));
            const remainingMinsTotal = isUnlimited
              ? -1
              : Math.max(0, durationMins - elapsedMinutes);

            const progress = isUnlimited
              ? 100
              : Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round((elapsedMinutes / durationMins) * 100),
                  ),
                );

            let remainingStr = `${remainingMinsTotal} min`;
            if (isUnlimited) {
              remainingStr = "Unlimited";
            } else if (remainingMinsTotal >= 60) {
              const hrs = Math.floor(remainingMinsTotal / 60);
              const mins = remainingMinsTotal % 60;
              remainingStr = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
            }

            let status: "active" | "warning" | "expiring" = "active";
            if (!isUnlimited) {
              if (remainingMinsTotal <= 5) {
                status = "expiring";
              } else if (remainingMinsTotal <= 15) {
                status = "warning";
              }
            }

            const matchedZone = zones.find((z) => z.id === data.zoneId);
            const zoneName =
              data.zoneName ||
              data.zones ||
              (matchedZone ? matchedZone.name : "Main Play Zone");

            const entryTimeStr = new Date(startMs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return {
              id: docSnap.id,
              rfidCardId:
                data.rfidCardId ||
                data.rfidTag ||
                data.rfid ||
                `RFID-${docSnap.id.slice(0, 4).toUpperCase()}`,
              childName:
                data.childName ||
                data.customerName ||
                data.name ||
                "Anonymous Child",
              zoneId: data.zoneId,
              zoneName,
              packageName: data.packageName || "Standard Entry",
              entryTimeStr,
              createdAtMs: startMs,
              remainingStr,
              progress,
              status,
            };
          });

        setSessions(activeSessions);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching live registrations:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [zones]);

  useEffect(() => {
    setShowSkeleton(true);
    const timer = window.setTimeout(() => setShowSkeleton(false), 650);
    return () => window.clearTimeout(timer);
  }, [refreshCounter]);

  const isLoadingDisplay = loading || showSkeleton;

  const activeRfidCount = useMemo(
    () => sessions.filter((s) => s.status === "active").length,
    [sessions],
  );

  const zonesInUse = useMemo(() => {
    const uniqueActiveZones = new Set(sessions.map((s) => s.zoneName));
    const totalZones = zones.length || 5;
    return `${uniqueActiveZones.size}/${totalZones}`;
  }, [sessions, zones]);

  const openExport = () => {
    setExportDone(false);
    setModal("export");
  };
  const openAlerts = () => {
    setAlertSent(false);
    setAlertMsg("");
    setAlertTarget("all");
    setModal("alerts");
  };
  const closeModal = () => setModal(null);

  const handleDownloadCSV = () => {
    const headers = [
      "RFID Card",
      "Child Name",
      "Package",
      "Zone",
      "Entry Time",
      "Remaining",
      "Status",
      "Progress (%)",
    ];
    const rows = sessions.map((s) => [
      s.rfidCardId,
      `"${s.childName}"`,
      `"${s.packageName}"`,
      `"${s.zoneName}"`,
      s.entryTimeStr,
      s.remainingStr,
      s.status,
      `${s.progress}%`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Live_Monitoring_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportDone(true);
  };

  const handleSendAlert = async () => {
    if (!alertMsg.trim()) {
      toast.error("Please enter an alert message");
      return;
    }

    setSendingAlert(true);
    try {
      await addDoc(collection(db, "alerts"), {
        target: alertTarget,
        message: alertMsg.trim(),
        createdAt: serverTimestamp(),
      });

      addNotification({
        type: "warning",
        title: "System Alert Broadcasted",
        message: alertMsg,
        role: "both",
      });

      toast.success("Alert sent successfully!");
      setAlertSent(true);
    } catch (error) {
      console.error("Failed to send alert:", error);
      toast.error("Failed to send alert notification");
    } finally {
      setSendingAlert(false);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-dark-slate mb-2 text-2xl font-bold">
              Live Monitoring Dashboard
            </h1>
            <p className="text-gray">
              Real-time RFID activity and zone tracking
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray/10 shadow-sm">
            <div
              className={`w-3 h-3 rounded-full ${
                isRefreshing ? "bg-success animate-pulse" : "bg-gray-200"
              }`}
            ></div>
            <span className="text-dark-slate font-medium text-sm">
              Auto-refreshing in {nextRefreshSeconds}s
            </span>
            <button
              type="button"
              onClick={forceRefresh}
              className="rounded-full border border-gray/20 bg-gray/50 px-3 py-1 text-xs font-semibold text-dark-slate hover:bg-gray/100"
            >
              Refresh now
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Children Inside"
            value={sessions.length}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Active RFID Tags"
            value={activeRfidCount}
            icon={Activity}
            color="green"
          />
          <StatCard
            title="Occupancy Rate"
            value={
              sessions.length > 0
                ? `${Math.min(100, Math.round((sessions.length / 50) * 100))}%`
                : "0%"
            }
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            title="Zones in Use"
            value={zonesInUse}
            icon={MapPin}
            color="orange"
          />
        </div>

        {/* Real-time Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-dark-slate font-bold">Real-Time Monitoring</h3>
            <div className="flex gap-4">
              {[
                { color: "bg-success", label: "Active" },
                { color: "bg-warning", label: "Warning" },
                { color: "bg-error", label: "Expiring" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${s.color} rounded-full`}></div>
                  <span className="text-xs text-gray font-medium">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoadingDisplay ? (
              <div className="space-y-6 py-6">
                <div className="text-center text-sm text-gray">
                  Refreshing live active sessions...
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray/20">
                      {[
                        "RFID Number",
                        "Child Name",
                        "Package",
                        "Current Zone",
                        "Entry Time",
                        "Remaining Time",
                        "Status",
                        "Progress",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx} className="border-b border-gray/10">
                        {Array.from({ length: 8 }).map((__, colIdx) => (
                          <td key={colIdx} className="py-4 px-4">
                            <Skeleton className="h-4 max-w-[140px]" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray text-sm">
                No active children logged in play zones right now.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray/20">
                    {[
                      "RFID Number",
                      "Child Name",
                      "Package",
                      "Current Zone",
                      "Entry Time",
                      "Remaining Time",
                      "Status",
                      "Progress",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray/10 hover:bg-light-gray/50 transition-colors"
                    >
                      <td className="py-4 px-4 font-mono text-xs font-semibold text-dark-slate">
                        {item.rfidCardId}
                      </td>
                      <td className="py-4 px-4 font-medium text-dark-slate text-sm">
                        {item.childName}
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-gray">
                        {item.packageName}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-ocean-blue/10 text-ocean-blue rounded-lg text-xs font-medium">
                          <MapPin className="w-3 h-3" />
                          {item.zoneName}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-gray">
                        {item.entryTimeStr}
                      </td>
                      <td className="py-4 px-4 text-xs font-semibold text-dark-slate">
                        {item.remainingStr}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === "active"
                              ? "bg-success/10 text-success"
                              : item.status === "warning"
                                ? "bg-warning/10 text-warning"
                                : "bg-error/10 text-error"
                          }`}
                        >
                          {item.status === "active"
                            ? "Active"
                            : item.status === "warning"
                              ? "Warning"
                              : "Expiring Soon"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray/20 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                item.status === "active"
                                  ? "bg-gradient-to-r from-emerald-green to-mint-green"
                                  : item.status === "warning"
                                    ? "bg-warning"
                                    : "bg-error"
                              }`}
                              style={{ width: `${item.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray w-10 text-right">
                            {item.progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            onClick={openExport}
            className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium text-sm"
          >
            <Download className="w-4 h-4" /> Export Current Data
          </button>
          <button
            onClick={() => navigate("/logs")}
            className="px-6 py-3 border-2 border-ocean-blue text-ocean-blue rounded-xl hover:bg-ocean-blue hover:text-white transition-all font-medium text-sm"
          >
            View Full Logs
          </button>
          <button
            onClick={openAlerts}
            className="px-6 py-3 bg-gradient-to-r from-emerald-green to-mint-green text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium text-sm"
          >
            <Bell className="w-4 h-4" /> Send Alerts
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {modal === "export" && (
        <Modal title="Export Current Data" onClose={closeModal} size="sm">
          {!exportDone ? (
            <div className="space-y-4">
              <p className="text-gray text-sm">
                Export a snapshot of all{" "}
                <strong className="text-dark-slate">
                  {sessions.length} active sessions
                </strong>
                .
              </p>
              <div className="p-4 bg-light-gray rounded-xl space-y-2 text-sm max-h-48 overflow-y-auto">
                {sessions.map((d) => (
                  <div
                    key={d.id}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-gray font-mono">{d.rfidCardId}</span>
                    <span className="text-dark-slate font-medium">
                      {d.childName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        d.status === "active"
                          ? "bg-success/10 text-success"
                          : d.status === "warning"
                            ? "bg-warning/10 text-warning"
                            : "bg-error/10 text-error"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadCSV}
                  className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all text-sm font-medium"
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
              <h4 className="text-dark-slate font-bold mb-2">
                Export Complete!
              </h4>
              <p className="text-gray text-sm mb-6">
                Live monitoring data has been downloaded.
              </p>
              <button
                onClick={closeModal}
                className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Send Alerts Modal */}
      {modal === "alerts" && (
        <Modal title="Send Alerts" onClose={closeModal} size="sm">
          {!alertSent ? (
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-xs font-medium text-gray">
                  Send Alert To
                </label>
                <select
                  value={alertTarget}
                  onChange={(e) => setAlertTarget(e.target.value)}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none text-sm"
                >
                  <option value="all">All Active Sessions</option>
                  <option value="expiring">Expiring Sessions Only</option>
                  <option value="warning">Warning Sessions Only</option>
                  {sessions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.childName} ({d.rfidCardId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-medium text-gray">
                  Message
                </label>
                <textarea
                  value={alertMsg}
                  onChange={(e) => setAlertMsg(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none resize-none text-sm"
                  placeholder="Enter your alert message..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSendAlert}
                  disabled={sendingAlert}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-green to-mint-green text-white rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
                >
                  {sendingAlert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Send Alert"
                  )}
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all text-sm font-medium"
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
              <h4 className="text-dark-slate font-bold mb-2">Alert Sent!</h4>
              <p className="text-gray text-sm mb-6">
                Alert dispatched to{" "}
                <strong>
                  {alertTarget === "all"
                    ? "all active sessions"
                    : alertTarget === "expiring"
                      ? "expiring sessions"
                      : alertTarget}
                </strong>
                .
              </p>
              <button
                onClick={closeModal}
                className="px-6 py-3 bg-gradient-to-r from-emerald-green to-mint-green text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
