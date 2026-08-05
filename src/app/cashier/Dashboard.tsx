import { useState, useEffect } from "react";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import {
  Users,
  DollarSign,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";

export interface ActiveChild {
  docId: string;
  rfid: string;
  name: string;
  zone: string;
  packageName: string;
  startTimeStamp: number;
  totalDuration: number;
  timeRemaining: number;
  status: "active" | "warning" | "expiring" | "expired";
}

export interface ActivityLog {
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

export interface Customer {
  name: string;
  package: string;
  time: string;
  amount: number;
  guardianFee?: number;
  extensionFee?: number;
}

export interface RevenueGroup {
  packageName: string;
  count: number;
  total: number;
}

type ModalType = "activeChildren" | "revenue" | "customers" | "expired" | null;

export default function CashierDashboard() {
  const [modal, setModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeChildren, setActiveChildren] = useState<ActiveChild[]>([]);
  const [expiredSessions, setExpiredSessions] = useState<ActiveChild[]>([]);
  const [todaysCustomers, setTodaysCustomers] = useState<Customer[]>([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueGroup[]>([]);
  const [todayRevenueTotal, setTodayRevenueTotal] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Timer interval to force re-calculation of remaining time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);

    const packagesRef = collection(db, "packages");
    const regsRef = collection(db, "registrations");
    const logsRef = collection(db, "scanLogs");

    let packagesMap: Record<
      string,
      { name: string; duration: number; price: number }
    > = {};

    let latestRegDocs: any[] = [];

    // Helper to calculate revenue solely from registrations including extensions/upgrades
    const processRevenue = () => {
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      const customerMap: Record<string, Customer> = {};
      const revenueMap: Record<string, { count: number; total: number }> = {};
      let totalRev = 0;

      // Process registrations for today
      latestRegDocs.forEach((docSnap) => {
        const data = docSnap.data();
        let startMs = Date.now();
        if (data.startTimeStamp) {
          startMs = Number(data.startTimeStamp);
        } else if (data.createdAt instanceof Timestamp) {
          startMs = data.createdAt.toMillis();
        }

        if (startMs >= startOfToday) {
          const linkedPkg = packagesMap[data.packageId];
          const pkgPrice = Number(
            data.packagePrice ||
              data.amount ||
              data.price ||
              data.amountPaid ||
              linkedPkg?.price ||
              0,
          );

          let guardianFee = 0;
          if (data.guardianFee !== undefined && data.guardianFee !== null) {
            guardianFee = Number(data.guardianFee);
          } else if (data.guardianEntry === true) {
            guardianFee = 50;
          }

          // Capture Extension / Upgrade Fees dynamically
          const extensionFee = Number(
            data.extensionFee ||
              data.extensionPrice ||
              data.upgradeFee ||
              data.addedAmount ||
              0,
          );

          const totalPaidForReg =
            data.totalAmount !== undefined
              ? Number(data.totalAmount)
              : pkgPrice + guardianFee + extensionFee;

          const pkgName =
            data.packageName || linkedPkg?.name || "Standard Pass";
          const childName =
            data.childName || data.customerName || data.name || "Guest Child";

          totalRev += totalPaidForReg;

          const customerKey =
            data.rfidCardId || data.rfidTag || data.rfid || docSnap.id;

          let packageDesc = pkgName;
          if (guardianFee > 0) packageDesc += " + Guardian";
          if (extensionFee > 0) packageDesc += " (Extended/Upgraded)";

          // Use unique key or array push if multiple transactions per RFID per day are expected
          customerMap[docSnap.id] = {
            name: childName,
            package: packageDesc,
            time: new Date(startMs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            amount: totalPaidForReg,
            guardianFee,
            extensionFee,
          };

          // Base Package Revenue Grouping
          if (!revenueMap[pkgName]) {
            revenueMap[pkgName] = { count: 0, total: 0 };
          }
          revenueMap[pkgName].count += 1;
          revenueMap[pkgName].total += pkgPrice;

          // Guardian Fee Revenue Grouping
          if (guardianFee > 0) {
            const guardianKey = "Guardian Fees";
            if (!revenueMap[guardianKey]) {
              revenueMap[guardianKey] = { count: 0, total: 0 };
            }
            revenueMap[guardianKey].count += 1;
            revenueMap[guardianKey].total += guardianFee;
          }

          // Extension / Upgrade Revenue Grouping
          if (extensionFee > 0) {
            const extensionKey = "Extensions & Upgrades";
            if (!revenueMap[extensionKey]) {
              revenueMap[extensionKey] = { count: 0, total: 0 };
            }
            revenueMap[extensionKey].count += 1;
            revenueMap[extensionKey].total += extensionFee;
          }
        }
      });

      const breakdown: RevenueGroup[] = Object.keys(revenueMap).map(
        (pkgName) => ({
          packageName: pkgName,
          count: revenueMap[pkgName].count,
          total: revenueMap[pkgName].total,
        }),
      );

      setTodaysCustomers(Object.values(customerMap));
      setRevenueBreakdown(breakdown);
      setTodayRevenueTotal(totalRev);
      setLoading(false);
    };

    // 1. Packages Listener
    const unsubPkgs = onSnapshot(packagesRef, (snapshot) => {
      const newMap: Record<
        string,
        { name: string; duration: number; price: number }
      > = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        newMap[doc.id] = {
          name: data.name || data.packageName || "Standard Package",
          duration: Number(data.duration ?? data.durationMinutes) ?? 60,
          price: Number(data.price || data.amount) || 0,
        };
      });
      packagesMap = newMap;
    });

    // 2. Active Sessions / Registrations Listener (Handles Extension Duration Sync)
    const unsubRegs = onSnapshot(
      regsRef,
      (snapshot) => {
        latestRegDocs = snapshot.docs;
        const now = Date.now();
        const activeList: ActiveChild[] = [];
        const expiredList: ActiveChild[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();

          const isExited =
            data.status === "exited" ||
            data.status === "completed" ||
            data.returned === true ||
            Boolean(data.exitedAt);

          if (isExited) return;

          const rawRfid =
            data.rfidCardId || data.rfidTag || data.rfid || data.tagCode || "";
          const registeredRfid =
            rawRfid && String(rawRfid).trim() !== "" ? rawRfid : "-";

          let startMs = now;
          if (data.startTimeStamp) {
            startMs = Number(data.startTimeStamp);
          } else if (data.createdAt instanceof Timestamp) {
            startMs = data.createdAt.toMillis();
          } else if (typeof data.createdAt === "string") {
            startMs = new Date(data.createdAt).getTime() || now;
          }

          const linkedPkg = packagesMap[data.packageId];

          let baseDuration = 60;
          if (data.totalDuration !== undefined && data.totalDuration !== null) {
            baseDuration = Number(data.totalDuration);
          } else if (data.duration !== undefined && data.duration !== null) {
            baseDuration = Number(data.duration);
          } else if (linkedPkg) {
            baseDuration = linkedPkg.duration;
          }

          // Syncs added extension minutes instantly
          const extensionMinutes = Number(
            data.extensionDuration || data.addedDuration || 0,
          );
          const effectiveDuration =
            baseDuration === -1 ? -1 : baseDuration + extensionMinutes;

          const isUnlimited =
            effectiveDuration === -1 || data.isUnlimited === true;
          const elapsedMinutes = Math.floor((now - startMs) / (1000 * 60));
          const remainingMinutes = isUnlimited
            ? 9999
            : effectiveDuration - elapsedMinutes;

          let status: ActiveChild["status"] = "active";
          if (isUnlimited) {
            status = "active";
          } else if (remainingMinutes <= 0) {
            status = "expired";
          } else if (remainingMinutes <= 5) {
            status = "expiring";
          } else if (remainingMinutes <= 15) {
            status = "warning";
          }

          const childItem: ActiveChild = {
            docId: docSnap.id,
            rfid: registeredRfid,
            name:
              data.childName || data.customerName || data.name || "Guest Child",
            zone: data.zoneName || data.zones || "Play Area",
            packageName: data.packageName || linkedPkg?.name || "Standard Pass",
            startTimeStamp: startMs,
            totalDuration: effectiveDuration,
            timeRemaining: remainingMinutes,
            status: status,
          };

          if (status === "expired") {
            expiredList.push(childItem);
          } else {
            activeList.push(childItem);
          }
        });

        setActiveChildren(activeList);
        setExpiredSessions(expiredList);
        processRevenue();
      },
      (error) => {
        console.error("Error fetching registrations:", error);
      },
    );

    // 3. Activity Scan Logs Listener
    const qLogs = query(logsRef, orderBy("entryTime", "desc"), limit(10));
    let unsubFallback: (() => void) | null = null;

    const unsubScanLogs = onSnapshot(
      qLogs,
      (scanSnap) => {
        if (!scanSnap.empty) {
          const fetchedLogs: ActivityLog[] = scanSnap.docs.map((d) => {
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

            const durationMinutes = Math.max(
              0,
              Math.floor(((exitMs || Date.now()) - entryMs) / (1000 * 60)),
            );
            const durationStr =
              durationMinutes >= 60
                ? `${Math.floor(durationMinutes / 60)} hr ${
                    durationMinutes % 60
                  } min`
                : `${durationMinutes} min`;

            const rawLogRfid =
              data.rfidCardId ||
              data.rfidTag ||
              data.rfid ||
              data.tagCode ||
              "";
            const formattedLogRfid =
              rawLogRfid && String(rawLogRfid).trim() !== "" ? rawLogRfid : "-";

            return {
              id: d.id,
              rfid: formattedLogRfid,
              name: data.childName || data.name || "Guest Child",
              zone: data.zoneName || data.zone || "Play Zone",
              entry: entryTimeStr,
              exit: exitTimeStr,
              duration: durationStr,
              status: isInside ? "inside" : "exited",
              rawEntryMs: entryMs,
            };
          });

          fetchedLogs.sort((a, b) => b.rawEntryMs - a.rawEntryMs);
          setRecentActivity(fetchedLogs.slice(0, 5));
        } else {
          unsubFallback = onSnapshot(regsRef, (regSnap) => {
            if (regSnap.empty) {
              setRecentActivity([]);
              return;
            }

            const derivedLogs: ActivityLog[] = regSnap.docs.map((d) => {
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
                  ? "Completed"
                  : "-";

              const durationMinutes = Math.max(
                0,
                Math.floor(
                  ((exitMs || (isExited ? entryMs + 3600000 : now)) - entryMs) /
                    (1000 * 60),
                ),
              );
              const durationStr =
                durationMinutes >= 60
                  ? `${Math.floor(durationMinutes / 60)} hr ${
                      durationMinutes % 60
                    } min`
                  : `${durationMinutes} min`;

              const rawDerivedRfid =
                data.rfidCardId ||
                data.rfidTag ||
                data.rfid ||
                data.tagCode ||
                "";
              const formattedDerivedRfid =
                rawDerivedRfid && String(rawDerivedRfid).trim() !== ""
                  ? rawDerivedRfid
                  : "-";

              return {
                id: d.id,
                rfid: formattedDerivedRfid,
                name:
                  data.childName ||
                  data.customerName ||
                  data.name ||
                  "Guest Child",
                zone: data.zoneName || data.zones || "Play Area",
                entry: entryTimeStr,
                exit: exitTimeStr,
                duration: durationStr,
                status: isExited ? "exited" : "inside",
                rawEntryMs: entryMs,
              };
            });

            derivedLogs.sort((a, b) => b.rawEntryMs - a.rawEntryMs);
            setRecentActivity(derivedLogs.slice(0, 5));
          });
        }
      },
      (err) => {
        console.warn("Could not query scanLogs with ordering:", err);
      },
    );

    return () => {
      unsubPkgs();
      unsubRegs();
      unsubScanLogs();
      if (unsubFallback) unsubFallback();
    };
  }, []);

  const calculateRemaining = (child: ActiveChild) => {
    if (child.totalDuration === -1) return 9999;
    const elapsedMinutes = Math.floor(
      (currentTime - child.startTimeStamp) / (1000 * 60),
    );
    return child.totalDuration - elapsedMinutes;
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-dark-slate mb-2 font-bold text-2xl">
            Cashier Dashboard
          </h1>
          <p className="text-gray text-sm">
            Real-time monitoring and customer management
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button
            className="text-left cursor-pointer focus:outline-none"
            onClick={() => setModal("activeChildren")}
          >
            <StatCard
              title="Active Children"
              value={loading ? "..." : activeChildren.length}
              icon={Users}
              color="blue"
              trend="Live Active"
            />
          </button>

          <button
            className="text-left cursor-pointer focus:outline-none"
            onClick={() => setModal("revenue")}
          >
            <StatCard
              title="Today's Revenue"
              value={loading ? "..." : `₱${todayRevenueTotal.toLocaleString()}`}
              icon={DollarSign}
              color="green"
              trend="Updated Live"
            />
          </button>

          <button
            className="text-left cursor-pointer focus:outline-none"
            onClick={() => setModal("customers")}
          >
            <StatCard
              title="Today's Customers"
              value={loading ? "..." : todaysCustomers.length}
              icon={Activity}
              color="purple"
            />
          </button>

          <button
            className="text-left cursor-pointer focus:outline-none"
            onClick={() => setModal("expired")}
          >
            <StatCard
              title="Expired Sessions"
              value={loading ? "..." : expiredSessions.length}
              icon={Clock}
              color="orange"
            />
          </button>
        </div>

        {/* Main Section */}
        <div className="space-y-6">
          {/* Active Children Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate font-semibold text-lg">
                Active Children — Live Monitoring
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse"></div>
                <span className="text-xs text-gray font-medium">
                  Live Stream
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray">
                <Loader2 className="w-5 h-5 animate-spin text-ocean-blue" />
                <span>Loading active sessions...</span>
              </div>
            ) : activeChildren.length === 0 ? (
              <p className="text-center py-8 text-gray text-sm">
                No active children currently in play zones.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray/20">
                      {[
                        "RFID Tag",
                        "Child Name",
                        "Package",
                        "Current Zone",
                        "Time Remaining",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-2 text-xs font-semibold text-gray uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeChildren.map((child) => {
                      const dynamicRemaining = calculateRemaining(child);
                      return (
                        <tr
                          key={child.docId}
                          className="border-b border-gray/10 hover:bg-light-gray transition-colors"
                        >
                          <td className="py-4 px-2 text-dark-slate font-mono text-sm font-medium">
                            {child.rfid}
                          </td>
                          <td className="py-4 px-2 text-dark-slate font-medium text-sm">
                            {child.name}
                          </td>
                          <td className="py-4 px-2 text-gray text-sm">
                            {child.packageName}
                          </td>
                          <td className="py-4 px-2 text-gray text-sm">
                            {child.zone}
                          </td>
                          <td className="py-4 px-2 text-dark-slate font-semibold text-sm">
                            {child.totalDuration === -1
                              ? "Unlimited"
                              : `${Math.max(0, dynamicRemaining)} min`}
                          </td>
                          <td className="py-4 px-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                child.status === "active"
                                  ? "bg-success/10 text-success"
                                  : child.status === "warning"
                                    ? "bg-warning/10 text-warning"
                                    : "bg-error/10 text-error"
                              }`}
                            >
                              {child.status === "active" ? (
                                <CheckCircle className="w-3.5 h-3.5" />
                              ) : child.status === "warning" ? (
                                <AlertCircle className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {child.status.charAt(0).toUpperCase() +
                                child.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Entry/Exit Logs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate font-semibold text-lg flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-ocean-blue" />
                Recent Entry & Exit Activity
              </h3>
              <span className="text-xs text-gray font-medium">
                Latest 5 Logs
              </span>
            </div>

            {recentActivity.length === 0 ? (
              <p className="text-center py-8 text-gray text-sm">
                No recent entry/exit logs found.
              </p>
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
                        "Duration",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-3 text-xs font-semibold text-gray uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-gray/10 hover:bg-light-gray transition-colors text-sm"
                      >
                        <td className="py-3 px-3 text-dark-slate font-mono font-medium">
                          {log.rfid}
                        </td>
                        <td className="py-3 px-3 text-dark-slate font-medium">
                          {log.name}
                        </td>
                        <td className="py-3 px-3 text-gray">{log.zone}</td>
                        <td className="py-3 px-3 text-gray">{log.entry}</td>
                        <td className="py-3 px-3 text-gray">{log.exit}</td>
                        <td className="py-3 px-3 text-dark-slate font-medium">
                          {log.duration}
                        </td>
                        <td className="py-3 px-3">
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
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "activeChildren" && (
        <Modal
          title="Active Children Details"
          onClose={() => setModal(null)}
          size="lg"
        >
          <div className="space-y-3 p-2">
            {activeChildren.length === 0 ? (
              <p className="text-gray text-center py-4 text-sm">
                No active children online.
              </p>
            ) : (
              activeChildren.map((c) => {
                const dynamicRemaining = calculateRemaining(c);
                return (
                  <div
                    key={c.docId}
                    className="flex items-center justify-between p-4 bg-light-gray rounded-xl"
                  >
                    <div>
                      <p className="text-dark-slate font-semibold">{c.name}</p>
                      <p className="text-xs text-gray font-mono">
                        {c.rfid} · {c.zone} ({c.packageName})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-dark-slate font-semibold text-sm">
                        {c.totalDuration === -1
                          ? "Unlimited"
                          : `${Math.max(0, dynamicRemaining)} min left`}
                      </p>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          c.status === "active"
                            ? "bg-success/10 text-success"
                            : c.status === "warning"
                              ? "bg-warning/10 text-warning"
                              : "bg-error/10 text-error"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {modal === "revenue" && (
        <Modal title="Today's Revenue Breakdown" onClose={() => setModal(null)}>
          <div className="space-y-3 p-2">
            {revenueBreakdown.length === 0 ? (
              <p className="text-gray text-center py-4 text-sm">
                No revenue recorded today.
              </p>
            ) : (
              revenueBreakdown.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-light-gray rounded-xl"
                >
                  <div>
                    <p className="text-dark-slate font-medium">
                      {r.packageName}
                    </p>
                    <p className="text-xs text-gray">
                      {r.count}{" "}
                      {r.packageName === "Guardian Fees"
                        ? "entry fee(s)"
                        : r.packageName === "Extensions & Upgrades"
                          ? "extension(s)"
                          : "entry pass(es)"}
                    </p>
                  </div>
                  <p className="text-emerald-green font-bold">
                    ₱{r.total.toLocaleString()}
                  </p>
                </div>
              ))
            )}
            <div className="pt-4 border-t border-gray/20 flex justify-between font-bold text-base px-2">
              <p className="text-dark-slate">Total Daily Revenue</p>
              <p className="text-emerald-green">
                ₱{todayRevenueTotal.toLocaleString()}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {modal === "customers" && (
        <Modal
          title="Today's Registered Customers"
          onClose={() => setModal(null)}
        >
          <div className="space-y-3 p-2 max-h-[60vh] overflow-y-auto">
            {todaysCustomers.length === 0 ? (
              <p className="text-gray text-center py-4 text-sm">
                No customer registrations recorded today.
              </p>
            ) : (
              todaysCustomers.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-light-gray rounded-xl"
                >
                  <div>
                    <p className="text-dark-slate font-medium">{c.name}</p>
                    <p className="text-xs text-gray">
                      {c.package} · {c.time}
                    </p>
                  </div>
                  <p className="text-ocean-blue font-bold">
                    ₱{c.amount.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {modal === "expired" && (
        <Modal title="Expired Sessions" onClose={() => setModal(null)}>
          <div className="space-y-3 p-2">
            {expiredSessions.length === 0 ? (
              <p className="text-gray text-center py-4 text-sm">
                No expired sessions currently.
              </p>
            ) : (
              expiredSessions.map((s) => (
                <div
                  key={s.docId}
                  className="flex items-center justify-between p-4 bg-light-gray rounded-xl"
                >
                  <div>
                    <p className="text-dark-slate font-semibold">{s.name}</p>
                    <p className="text-xs text-gray font-mono">
                      {s.rfid} · {s.zone} ({s.packageName})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-error/10 text-error">
                      Expired
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
