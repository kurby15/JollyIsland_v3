import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import {
  Search,
  Download,
  FileText,
  Filter,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";

export interface LogEntry {
  id: string;
  rfid: string;
  name: string;
  zone: string;
  entry: string;
  exit: string;
  duration: string;
  status: "inside" | "exited";
  rawEntryMs: number;
}

// Helper to convert minutes into exact "X hr Y min" format matching PlaytimeTracking
const formatDuration = (minutes: number) => {
  if (minutes < 0) return "0 min";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) {
    return `${hrs} hr ${mins} min`;
  } else if (hrs > 0) {
    return `${hrs} hr`;
  } else {
    return `${mins} min`;
  }
};

export default function EntryExitLogs() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [exportType, setExportType] = useState<
    "pdf" | "excel" | "print" | null
  >(null);
  const [exportDone, setExportDone] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [zonesList, setZonesList] = useState<string[]>([]);

  // Fetch Entry/Exit logs and unique zones from Firestore
  useEffect(() => {
    setLoading(true);

    const logsRef = collection(db, "scanLogs");
    const regsRef = collection(db, "registrations");
    const zonesRef = collection(db, "zones");

    // Fetch zones for the dropdown filter directly from Firestore
    const unsubZones = onSnapshot(zonesRef, (zoneSnap) => {
      const uniqueZones = new Set<string>();
      zoneSnap.docs.forEach((d) => {
        const data = d.data();
        const zoneName = data.name || data.zoneName;
        if (zoneName) uniqueZones.add(zoneName);
      });
      setZonesList(Array.from(uniqueZones));
    });

    // Primary: Subscribe to scanLogs collection
    const unsubScanLogs = onSnapshot(logsRef, (scanSnap) => {
      if (!scanSnap.empty) {
        const fetchedLogs: LogEntry[] = scanSnap.docs.map((d) => {
          const data = d.data();
          const entryMs =
            data.entryTime instanceof Timestamp
              ? data.entryTime.toMillis()
              : data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : Date.now();

          const exitMs =
            data.exitTime instanceof Timestamp
              ? data.exitTime.toMillis()
              : null;

          const isInside = data.status === "inside" && !exitMs;

          const entryTimeStr = new Date(entryMs).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const exitTimeStr = exitMs
            ? new Date(exitMs).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          // Duration math based on consumed time (exitTime or current time if still inside)
          const durationMinutes = Math.max(
            0,
            Math.floor(((exitMs || Date.now()) - entryMs) / (1000 * 60)),
          );

          return {
            id: d.id,
            rfid:
              data.rfidCardId ||
              data.rfidTag ||
              data.rfid ||
              data.tagCode ||
              "Unassigned",
            name: data.childName || data.name || "Guest Child",
            zone: data.zoneName || data.zone || "Play Zone",
            entry: entryTimeStr,
            exit: exitTimeStr,
            duration: formatDuration(durationMinutes),
            status: isInside ? "inside" : "exited",
            rawEntryMs: entryMs,
          };
        });

        fetchedLogs.sort((a, b) => b.rawEntryMs - a.rawEntryMs);
        setLogs(fetchedLogs);
        setFilteredLogs(fetchedLogs);
        setLoading(false);
      } else {
        // Fallback: Build logs directly from Registrations collection synced with completed / returned status
        const unsubRegs = onSnapshot(regsRef, (regSnap) => {
          const derivedLogs: LogEntry[] = regSnap.docs.map((d) => {
            const data = d.data();
            const now = Date.now();

            let entryMs = now;
            if (data.enteredAt instanceof Timestamp) {
              entryMs = data.enteredAt.toMillis();
            } else if (data.createdAt instanceof Timestamp) {
              entryMs = data.createdAt.toMillis();
            } else if (data.startTimeStamp) {
              entryMs = Number(data.startTimeStamp);
            }

            let exitMs: number | null = null;
            if (data.exitedAt instanceof Timestamp) {
              exitMs = data.exitedAt.toMillis();
            } else if (data.completedAt instanceof Timestamp) {
              exitMs = data.completedAt.toMillis();
            }

            const isExited =
              data.status === "exited" ||
              data.returned === true ||
              data.status === "completed" ||
              Boolean(exitMs);

            const entryTimeStr = new Date(entryMs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const exitTimeStr = exitMs
              ? new Date(exitMs).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : isExited
                ? new Date(
                    data.updatedAt?.toMillis() || now,
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-";

            // Accurate consumed playtime calculation (Exit time minus Entry time, or active elapsed time)
            const referenceEndMs =
              exitMs || (isExited ? data.updatedAt?.toMillis() || now : now);
            const durationMinutes = Math.max(
              0,
              Math.floor((referenceEndMs - entryMs) / (1000 * 60)),
            );

            return {
              id: d.id,
              rfid:
                data.rfidCardId ||
                data.rfidTag ||
                data.rfid ||
                data.tagCode ||
                "Unassigned",
              name:
                data.childName ||
                data.customerName ||
                data.name ||
                "Guest Child",
              zone: data.zoneName || data.zones || "Play Area",
              entry: entryTimeStr,
              exit: exitTimeStr,
              duration: formatDuration(durationMinutes),
              status: isExited ? "exited" : "inside",
              rawEntryMs: entryMs,
            };
          });

          derivedLogs.sort((a, b) => b.rawEntryMs - a.rawEntryMs);
          setLogs(derivedLogs);
          setFilteredLogs(derivedLogs);
          setLoading(false);
        });

        return () => unsubRegs();
      }
    });

    return () => {
      unsubZones();
      unsubScanLogs();
    };
  }, []);

  // Filter Handler for search, date, and zone filtering
  const handleApplyFilters = () => {
    let result = [...logs];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.rfid.toLowerCase().includes(q) ||
          l.zone.toLowerCase().includes(q),
      );
    }

    if (zoneFilter) {
      result = result.filter(
        (l) => l.zone.toLowerCase() === zoneFilter.toLowerCase(),
      );
    }

    if (dateFilter) {
      const filterDateStr = new Date(dateFilter).toDateString();
      result = result.filter(
        (l) => new Date(l.rawEntryMs).toDateString() === filterDateStr,
      );
    }

    setFilteredLogs(result);
  };

  const openExport = (type: "pdf" | "excel" | "print") => {
    setExportType(type);
    setExportDone(false);
    setIsExporting(false);
  };

  const closeExport = () => {
    setExportType(null);
    setExportDone(false);
    setIsExporting(false);
  };

  // Export & Print Actions
  const handleDownload = () => {
    if (!exportType) return;
    setIsExporting(true);

    setTimeout(() => {
      if (exportType === "excel") {
        const headers = [
          "RFID Tag",
          "Child Name",
          "Zone",
          "Entry Time",
          "Exit Time",
          "Duration",
          "Status",
        ];
        const rows = filteredLogs.map((l) => [
          `"${l.rfid}"`,
          `"${l.name}"`,
          `"${l.zone}"`,
          `"${l.entry}"`,
          `"${l.exit}"`,
          `"${l.duration}"`,
          `"${l.status}"`,
        ]);

        const csvContent =
          "data:text/csv;charset=utf-8," +
          [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute(
          "download",
          `entry_exit_logs_${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportType === "print" || exportType === "pdf") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Entry & Exit Logs</title>
                <style>
                  body { font-family: sans-serif; padding: 20px; }
                  h2 { margin-bottom: 5px; }
                  p { color: #666; font-size: 14px; margin-bottom: 20px; }
                  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
                  th { background-color: #f4f4f4; }
                </style>
              </head>
              <body>
                <h2>Entry & Exit Activity Logs</h2>
                <p>Generated on ${new Date().toLocaleString()} | Total Entries: ${filteredLogs.length}</p>
                <table>
                  <thead>
                    <tr>
                      <th>RFID Tag</th>
                      <th>Child Name</th>
                      <th>Zone</th>
                      <th>Entry Time</th>
                      <th>Exit Time</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredLogs
                      .map(
                        (l) => `
                      <tr>
                        <td>${l.rfid}</td>
                        <td>${l.name}</td>
                        <td>${l.zone}</td>
                        <td>${l.entry}</td>
                        <td>${l.exit}</td>
                        <td>${l.duration}</td>
                        <td>${l.status.toUpperCase()}</td>
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      }

      setIsExporting(false);
      setExportDone(true);
      const label = exportType === "print" ? "Print" : exportType.toUpperCase();

      addNotification({
        type: "success",
        title: `Logs ${exportType === "print" ? "Printed" : "Exported"}`,
        message: `${filteredLogs.length} log entries ${
          exportType === "print" ? "sent to printer" : `exported as ${label}`
        }.`,
        role: "admin",
      });

      toast.success(
        exportType === "print" ? "Sent to printer" : `${label} export ready`,
        {
          description: `${filteredLogs.length} entries${zoneFilter ? ` · Zone Filter Active` : ""}`,
        },
      );
    }, 600);
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-dark-slate mb-2 font-bold text-2xl">
            Entry & Exit Logs
          </h1>
          <p className="text-gray text-sm">
            Complete activity history and live zone-synchronized tracking with
            consumed duration breakdown
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, RFID tag, or zone..."
                className="w-full pl-10 pr-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors text-sm"
              />
            </div>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors text-sm text-gray"
            />

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors text-sm text-gray"
            >
              <option value="">All Zones</option>
              {zonesList.map((zoneName) => (
                <option key={zoneName} value={zoneName}>
                  {zoneName}
                </option>
              ))}
            </select>

            <button
              onClick={handleApplyFilters}
              className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Filter className="w-4 h-4" /> Apply Filters
            </button>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-ocean-blue" />
              <span>Loading scan logs and consumed time calculations...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray/20">
                    {[
                      "RFID Tag",
                      "Child Name",
                      "Zone",
                      "Entry Time",
                      "Exit Time",
                      "Duration Consumed",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left py-3 px-4 text-xs font-semibold text-gray uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-gray/10 hover:bg-light-gray transition-colors text-sm"
                    >
                      <td className="py-4 px-4 text-dark-slate font-mono font-medium">
                        {log.rfid}
                      </td>
                      <td className="py-4 px-4 text-dark-slate font-medium">
                        {log.name}
                      </td>
                      <td className="py-4 px-4 text-gray">{log.zone}</td>
                      <td className="py-4 px-4 text-gray">{log.entry}</td>
                      <td className="py-4 px-4 text-gray">{log.exit}</td>
                      <td className="py-4 px-4 text-dark-slate font-medium">
                        {log.duration}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            log.status === "inside"
                              ? "bg-success/10 text-success"
                              : "bg-gray/10 text-gray"
                          }`}
                        >
                          {log.status === "inside" ? "Inside" : "Exited"}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-gray text-sm"
                      >
                        No entry/exit logs match your current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex gap-4 mt-6 pt-6 border-t border-gray/20">
            <button
              onClick={() => openExport("pdf")}
              className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>

            <button
              onClick={() => openExport("excel")}
              className="px-6 py-3 border-2 border-emerald-green text-emerald-green rounded-xl hover:bg-emerald-green hover:text-white transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>

            <button
              onClick={() => openExport("print")}
              className="px-6 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <FileText className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Export / Print Modal */}
      {exportType && (
        <Modal
          title={
            exportType === "print"
              ? "Print Logs"
              : `Export ${exportType === "pdf" ? "PDF" : "Excel"}`
          }
          onClose={closeExport}
          size="sm"
        >
          {!exportDone ? (
            <div className="space-y-4 p-2">
              <p className="text-gray text-sm">
                {exportType === "print" ? "Print" : "Export"}{" "}
                <strong className="text-dark-slate">
                  {filteredLogs.length} log entries
                </strong>
                {zoneFilter ? ` from selected zone` : ""}.
              </p>

              <div className="p-4 bg-light-gray rounded-xl space-y-1 max-h-48 overflow-y-auto text-sm">
                {filteredLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex justify-between items-center text-xs py-1 border-b border-gray/10 last:border-0"
                  >
                    <span className="font-mono text-gray font-medium">
                      {l.rfid}
                    </span>
                    <span className="text-dark-slate font-medium">
                      {l.name}
                    </span>
                    <span
                      className={
                        l.status === "inside"
                          ? "text-success font-semibold"
                          : "text-gray"
                      }
                    >
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleDownload}
                  disabled={isExporting}
                  className={`flex-1 py-3 text-white rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-70 ${
                    exportType === "excel"
                      ? "bg-gradient-to-r from-emerald-green to-mint-green"
                      : "bg-gradient-to-r from-ocean-blue to-sky-blue"
                  }`}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />{" "}
                      {exportType === "print" ? "Sending…" : "Generating…"}
                    </>
                  ) : (
                    <>
                      {exportType === "print" ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {exportType === "print"
                        ? "Print Now"
                        : `Download ${exportType.toUpperCase()}`}
                    </>
                  )}
                </button>

                <button
                  onClick={closeExport}
                  className="px-4 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 p-2">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>

              <h4 className="text-dark-slate mb-2 font-semibold text-lg">
                {exportType === "print" ? "Sent to Printer!" : "Export Ready!"}
              </h4>

              <p className="text-gray mb-6 text-sm">
                {exportType === "print"
                  ? "The log sheet has been sent to the printer."
                  : `Your ${exportType.toUpperCase()} file has been generated.`}
              </p>

              <button
                onClick={closeExport}
                className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
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
