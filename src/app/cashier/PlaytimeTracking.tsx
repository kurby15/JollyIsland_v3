import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import {
  ArrowUpCircle,
  AlertTriangle,
  CheckCircle,
  Package as PackageIcon,
  Wifi,
  Loader2,
  LogOut,
  Radio,
  Filter,
  XCircle,
  HelpCircle,
  Clock,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  writeBatch,
  Timestamp,
  increment,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

export interface RFIDScanner {
  id: string;
  name: string;
  serialNumber: string;
  status: string;
  zoneId: string;
  zoneName: string;
}

export interface Pkg {
  id: string;
  name: string;
  duration: number; // in minutes (-1 = unlimited)
  price: number;
  zones: string;
  active: boolean;
}

export interface Session {
  id: string; // RFID Tag ID
  docId: string;
  name: string;
  packageName: string;
  zones: string;
  started: string;
  startTimeStamp: number;
  total: number;
  remaining: number;
  formattedRemaining: string;
  formattedTotal: string;
  progress: number;
  status: "active" | "warning" | "expiring" | "unlimited";
}

interface PendingTap {
  logId: string;
  tagId: string;
  session: Session;
  customerName: string;
}

// Helper to convert minutes into "X hr Y min" format
const formatDuration = (minutes: number) => {
  if (minutes < 0) return "Unlimited";
  if (minutes === 0) return "0 min";
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

export default function PlaytimeTracking() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Package Upgrade State
  const [upgradeTarget, setUpgradeTarget] = useState<Session | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Pkg | null>(null);
  const [upgradeDone, setUpgradeDone] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Alert State
  const [, setAlertTarget] = useState<Session | null>(null);

  // RFID Return / Complete Session State
  const [completeTarget, setCompleteTarget] = useState<Session | null>(null);
  const [rfidInput, setRfidInput] = useState<string>("");
  const [completing, setCompleting] = useState(false);
  const [completeDone, setCompleteDone] = useState(false);
  const [rfidError, setRfidError] = useState<string>("");

  // RFID Scanners State fetched directly from Firebase Firestore
  const [scanners, setScanners] = useState<RFIDScanner[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState<string>("");

  // Pending RFID Tap Confirmation Modal State
  const [pendingTap, setPendingTap] = useState<PendingTap | null>(null);
  const [processingTapAction, setProcessingTapAction] = useState(false);

  // --- REAL-TIME FIRESTORE LISTENER FOR SCANNERS ---
  useEffect(() => {
    const scannersRef = collection(db, "rfid_scanners");

    const unsubscribeScanners = onSnapshot(
      scannersRef,
      (snapshot) => {
        const liveScanners: RFIDScanner[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || "Unnamed Scanner",
            serialNumber: data.serialNumber || docSnap.id,
            status: data.status || "active",
            zoneId: data.zoneId || "",
            zoneName: data.zoneName || "General Zone",
          };
        });

        setScanners(liveScanners.filter((s) => s.status === "active"));
      },
      (error) => {
        console.error("Error fetching live scanners from Firebase:", error);
      },
    );

    return () => unsubscribeScanners();
  }, []);

  // Find selected scanner and match zone dynamically
  const activeScanner = scanners.find((s) => s.id === selectedScannerId);
  const activeZoneFilter = activeScanner?.zoneName || null;

  // Filter active sessions by scanner zone
  const filteredSessions = sessions.filter((session) => {
    if (!activeZoneFilter) return true;
    return (
      session.zones.trim().toLowerCase() ===
      activeZoneFilter.trim().toLowerCase()
    );
  });

  // --- FETCH PACKAGES & REGISTRATIONS LIVE FROM FIRESTORE ---
  useEffect(() => {
    setLoading(true);

    const packagesRef = collection(db, "packages");
    const regsRef = collection(db, "registrations");

    const cachedPackages: Record<string, Pkg> = {};

    // Live listener for Packages catalog
    const unsubPkgs = onSnapshot(packagesRef, (snapshot) => {
      const pkgList: Pkg[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const pkg: Pkg = {
          id: d.id,
          name: data.name || data.packageName || "Standard Package",
          duration: Number(data.duration ?? data.durationMinutes) ?? 60,
          price: Number(data.price || data.amount) || 0,
          zones: data.zoneName || data.zones || "Play Zone",
          active: data.active !== false,
        };
        cachedPackages[d.id] = pkg;
        if (pkg.active) pkgList.push(pkg);
      });
      setAvailablePackages(pkgList);
    });

    // Live listener for Active Registrations
    const unsubRegs = onSnapshot(
      regsRef,
      (snapshot) => {
        const now = Date.now();

        const activeSessions: Session[] = snapshot.docs
          .filter((docSnap) => {
            const data = docSnap.data();
            return data.status !== "completed" && data.returned !== true;
          })
          .map((docSnap) => {
            const data = docSnap.data();

            let startMs = now;
            if (data.startTimeStamp) {
              startMs = Number(data.startTimeStamp);
            } else if (data.createdAt instanceof Timestamp) {
              startMs = data.createdAt.toMillis();
            } else if (typeof data.createdAt === "string") {
              startMs = new Date(data.createdAt).getTime() || now;
            }

            const linkedPkg = cachedPackages[data.packageId];

            let baseDuration = 60;
            if (
              data.totalDuration !== undefined &&
              data.totalDuration !== null
            ) {
              baseDuration = Number(data.totalDuration);
            } else if (data.duration !== undefined && data.duration !== null) {
              baseDuration = Number(data.duration);
            } else if (linkedPkg) {
              baseDuration = linkedPkg.duration;
            }

            const isUnlimited =
              baseDuration === -1 || data.isUnlimited === true;

            const elapsedMinutes = Math.floor((now - startMs) / (1000 * 60));
            const remainingMinutes = isUnlimited
              ? -1
              : Math.max(0, baseDuration - elapsedMinutes);

            const progress = isUnlimited
              ? 100
              : Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round((elapsedMinutes / baseDuration) * 100),
                  ),
                );

            let status: Session["status"] = "active";
            if (isUnlimited) {
              status = "unlimited";
            } else if (remainingMinutes <= 5) {
              status = "expiring";
            } else if (remainingMinutes <= 15) {
              status = "warning";
            }

            const formattedStarted = new Date(startMs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return {
              id:
                data.rfidCardId ||
                data.rfidTag ||
                data.rfid ||
                `RFID-${docSnap.id.slice(0, 4).toUpperCase()}`,
              docId: docSnap.id,
              name:
                data.childName ||
                data.customerName ||
                data.name ||
                "Guest Child",
              packageName: data.packageName || linkedPkg?.name || "Play Pass",
              zones:
                data.zoneName || data.zones || linkedPkg?.zones || "Play Zone",
              started: formattedStarted,
              startTimeStamp: startMs,
              total: baseDuration,
              remaining: remainingMinutes,
              formattedRemaining: formatDuration(remainingMinutes),
              formattedTotal: formatDuration(baseDuration),
              progress: progress,
              status: status,
            };
          });

        setSessions(activeSessions);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading live play sessions:", error);
        setLoading(false);
      },
    );

    return () => {
      unsubPkgs();
      unsubRegs();
    };
  }, []);

  // --- INTERCEPT RFID TAP FOR INTENT VALIDATION ---
  useEffect(() => {
    const scansRef = collection(db, "rfid_logs");

    const unsubScans = onSnapshot(scansRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const scanData = change.doc.data();

          if (scanData.processed === true) return;

          const scannedTag = scanData.uid || scanData.cardId || scanData.rfid;
          if (!scannedTag) return;

          const normalizedTag = String(scannedTag).trim().toUpperCase();

          try {
            const cardDocRef = doc(db, "rfid_cards", normalizedTag);
            const cardSnap = await getDoc(cardDocRef);

            if (!cardSnap.exists()) return;

            const cardData = cardSnap.data();

            // Check if tag belongs to active session
            const activeSession = sessions.find(
              (s) => s.id.trim().toUpperCase() === normalizedTag,
            );

            if (activeSession) {
              const customerName =
                activeSession.name || cardData.customer || "Customer";

              // Trigger interactive tap validation modal
              setPendingTap({
                logId: change.doc.id,
                tagId: normalizedTag,
                session: activeSession,
                customerName: customerName,
              });

              toast.info(`RFID Tag Detected: ${normalizedTag}`, {
                description: `Please select an action for ${customerName}.`,
              });
            }
          } catch (err) {
            console.error("Error verifying scanned RFID:", err);
          }
        }
      });
    });

    return () => unsubScans();
  }, [sessions]);

  // --- TAP CONFIRMATION MODAL ACTIONS ---

  // Action 1: Confirm End/Complete Session & Open Gate
  const handleConfirmTapComplete = async () => {
    if (!pendingTap) return;
    setProcessingTapAction(true);

    try {
      const batch = writeBatch(db);

      // 1. Mark registration completed
      batch.update(doc(db, "registrations", pendingTap.session.docId), {
        status: "completed",
        returned: true,
        completedAt: Timestamp.now(),
        isRfidAvailable: true,
        activeRfidTag: null,
      });

      // 2. Return RFID card
      batch.set(
        doc(db, "rfid_cards", pendingTap.tagId),
        {
          status: "available",
          isAssigned: false,
          currentSessionId: null,
          lastReturnedAt: Timestamp.now(),
        },
        { merge: true },
      );

      // 3. Mark log processed
      batch.update(doc(db, "rfid_logs", pendingTap.logId), {
        processed: true,
      });

      // 4. Send command to trigger ESP32 Gate Servo
      const gateCommandRef = doc(collection(db, "gate_commands"));
      batch.set(gateCommandRef, {
        scannerSerialNumber: "ESP32-001",
        action: "OPEN_GATE",
        status: "pending",
        rfidTag: pendingTap.tagId,
        createdAt: Timestamp.now(),
      });

      await batch.commit();

      toast.success(`Session Completed & Gate Opened`, {
        description: `${pendingTap.customerName}'s card (${pendingTap.tagId}) returned.`,
      });

      addNotification({
        type: "success",
        title: "Session Completed & Gate Opened",
        message: `Card ${pendingTap.tagId} verified & returned for ${pendingTap.customerName}.`,
        role: "both",
      });

      setPendingTap(null);
    } catch (err) {
      console.error("Failed to complete tap action:", err);
      toast.error("Failed to process session completion.");
    } finally {
      setProcessingTapAction(false);
    }
  };

  // Action 2: Redirect to Package Upgrade
  const handleConfirmTapUpgrade = async () => {
    if (!pendingTap) return;
    setProcessingTapAction(true);

    try {
      await updateDoc(doc(db, "rfid_logs", pendingTap.logId), {
        processed: true,
      });

      const sessionToUpgrade = pendingTap.session;
      setPendingTap(null);
      openUpgrade(sessionToUpgrade);
    } catch (err) {
      console.error("Error redirecting to upgrade:", err);
    } finally {
      setProcessingTapAction(false);
    }
  };

  // Action 3: Cancel / Accidental Tap (Ignore)
  const handleCancelTap = async () => {
    if (!pendingTap) return;
    setProcessingTapAction(true);

    try {
      await updateDoc(doc(db, "rfid_logs", pendingTap.logId), {
        processed: true,
      });

      toast.info("Tap Ignored", {
        description: "Accidental tap dismissed. Session remains active.",
      });

      setPendingTap(null);
    } catch (err) {
      console.error("Error dismissing tap log:", err);
    } finally {
      setProcessingTapAction(false);
    }
  };

  // --- Standard Modal Handlers ---
  const openUpgrade = (session: Session) => {
    setUpgradeTarget(session);
    setSelectedPackage(availablePackages[0] ?? null);
    setUpgradeDone(false);
  };

  const closeUpgrade = () => {
    setUpgradeTarget(null);
    setUpgradeDone(false);
    setSelectedPackage(null);
  };

  const handleUpgrade = async () => {
    if (!upgradeTarget || !selectedPackage) return;
    setUpgrading(true);

    try {
      const regDocRef = doc(db, "registrations", upgradeTarget.docId);
      const isSameZone = upgradeTarget.zones === selectedPackage.zones;

      let newTotalDuration: number;
      let newStartMs: number = upgradeTarget.startTimeStamp;

      if (selectedPackage.duration === -1) {
        newTotalDuration = -1;
      } else if (isSameZone) {
        newTotalDuration = upgradeTarget.total + selectedPackage.duration;
      } else {
        newTotalDuration = selectedPackage.duration;
        newStartMs = Date.now();
      }

      const batch = writeBatch(db);

      batch.update(regDocRef, {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        zoneName: selectedPackage.zones,
        totalDuration: newTotalDuration,
        startTimeStamp: newStartMs,
        updatedAt: Timestamp.now(),
        extensionFee: increment(selectedPackage.price),
        totalAmount: increment(selectedPackage.price),
      });

      const transactionRef = doc(collection(db, "transactions"));
      batch.set(transactionRef, {
        registrationId: upgradeTarget.docId,
        type: "upgrade",
        amount: selectedPackage.price,
        packageName: selectedPackage.name,
        customerName: upgradeTarget.name,
        rfidTag: upgradeTarget.id,
        createdAt: Timestamp.now(),
      });

      await batch.commit();

      setUpgrading(false);
      setUpgradeDone(true);

      toast.success(`Package upgraded`, {
        description: `${upgradeTarget.name} → ${selectedPackage.name} (₱${selectedPackage.price})`,
      });
    } catch (err) {
      console.error("Error updating package session:", err);
      toast.error("Failed to upgrade package in database.");
      setUpgrading(false);
    }
  };

  const openCompleteModal = (session: Session) => {
    setCompleteTarget(session);
    setRfidInput("");
    setRfidError("");
    setCompleteDone(false);
  };

  const closeCompleteModal = () => {
    setCompleteTarget(null);
    setRfidInput("");
    setRfidError("");
    setCompleteDone(false);
  };

  const executeSessionCompletion = async (
    target: Session,
    scannedCardId: string,
  ) => {
    const normalizedInput = scannedCardId.trim().toUpperCase();
    const expectedRfid = target.id.trim().toUpperCase();

    if (normalizedInput !== expectedRfid) {
      setRfidError(
        `RFID tag does not match! Expected: "${target.id}". Please scan or enter the correct card.`,
      );
      return;
    }

    setCompleting(true);
    setRfidError("");

    try {
      const batch = writeBatch(db);

      // 1. Complete Registration
      const regDocRef = doc(db, "registrations", target.docId);
      batch.update(regDocRef, {
        status: "completed",
        returned: true,
        completedAt: Timestamp.now(),
        isRfidAvailable: true,
        activeRfidTag: null,
      });

      // 2. Return RFID Card
      const rfidCardRef = doc(db, "rfid_cards", target.id);
      batch.set(
        rfidCardRef,
        {
          status: "available",
          isAssigned: false,
          currentSessionId: null,
          lastReturnedAt: Timestamp.now(),
        },
        { merge: true },
      );

      // 3. Open Gate via ESP32 Command
      const gateCommandRef = doc(collection(db, "gate_commands"));
      batch.set(gateCommandRef, {
        scannerSerialNumber: "ESP32-001",
        action: "OPEN_GATE",
        status: "pending",
        rfidTag: target.id,
        createdAt: Timestamp.now(),
      });

      await batch.commit();

      setCompleting(false);
      setCompleteDone(true);

      toast.success(`Session Completed & Gate Opened`, {
        description: `RFID ${target.id} returned by ${target.name}`,
      });
    } catch (err) {
      console.error("Error completing session:", err);
      toast.error("Failed to complete session.");
      setCompleting(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!completeTarget) return;
    await executeSessionCompletion(completeTarget, rfidInput);
  };

  const handleRfidInputChange = (value: string) => {
    setRfidInput(value);
    if (rfidError) setRfidError("");

    if (
      completeTarget &&
      value.trim().toUpperCase() === completeTarget.id.trim().toUpperCase()
    ) {
      executeSessionCompletion(completeTarget, value);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-dark-slate mb-2 font-bold text-2xl">
              Playtime Tracking
            </h1>
            <p className="text-gray text-sm">
              Monitor ongoing sessions, track remaining time, upgrade packages,
              or complete sessions.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray/10 px-4 py-3">
            <Wifi
              className={`w-4 h-4 flex-shrink-0 ${
                selectedScannerId ? "text-emerald-500" : "text-gray-400"
              }`}
            />
            <select
              value={selectedScannerId}
              onChange={(e) => setSelectedScannerId(e.target.value)}
              className="text-sm text-dark-slate bg-transparent focus:outline-none min-w-[220px]"
            >
              <option value="">— Filter All Scanner Zones —</option>
              {scanners.map((scanner) => (
                <option key={scanner.id} value={scanner.id}>
                  {scanner.name} ({scanner.zoneName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeZoneFilter && (
          <div className="mb-6 flex items-center justify-between bg-ocean-blue/10 border border-ocean-blue/20 px-4 py-3 rounded-xl text-xs text-ocean-blue">
            <div className="flex items-center gap-2 font-medium">
              <Filter className="w-4 h-4" />
              <span>
                Filtering view for scanner zone:{" "}
                <strong>"{activeZoneFilter}"</strong>
              </span>
            </div>
            <button
              onClick={() => setSelectedScannerId("")}
              className="underline font-semibold hover:text-dark-slate"
            >
              Clear Filter
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray/10 text-gray gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-ocean-blue" />
            <span>Calculating live playtime balances...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray/10 p-12 text-center text-gray space-y-2">
            <p className="font-semibold text-base">No active sessions found.</p>
            <p className="text-xs">
              {activeZoneFilter
                ? `There are no active children currently in "${activeZoneFilter}".`
                : "No active playtime sessions currently running in the system."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <div
                key={session.docId}
                className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition-all flex flex-col justify-between ${
                  session.status === "expiring"
                    ? "border-error"
                    : session.status === "warning"
                      ? "border-warning"
                      : "border-gray/10"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-dark-slate mb-1 font-semibold text-base">
                        {session.name}
                      </h3>
                      <p className="text-xs text-gray font-mono">
                        RFID: {session.id}
                      </p>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        session.status === "unlimited"
                          ? "bg-purple-100 text-purple-600"
                          : session.status === "expiring"
                            ? "bg-error/10 text-error"
                            : session.status === "warning"
                              ? "bg-warning/10 text-warning"
                              : "bg-success/10 text-success"
                      }`}
                    >
                      {session.status === "unlimited"
                        ? "Unlimited"
                        : session.status.charAt(0).toUpperCase() +
                          session.status.slice(1)}
                    </div>
                  </div>

                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray">Current Package:</span>
                      <span className="text-dark-slate font-medium">
                        {session.packageName}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray">Zone Access:</span>
                      <span className="text-dark-slate font-semibold text-ocean-blue">
                        {session.zones}
                      </span>
                    </div>
                  </div>

                  {session.status !== "unlimited" && (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray">
                            Time Remaining
                          </span>
                          <span className="text-dark-slate font-semibold text-xs">
                            {session.formattedRemaining}
                          </span>
                        </div>

                        <div className="h-3 bg-gray/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              session.status === "expiring"
                                ? "bg-error"
                                : session.status === "warning"
                                  ? "bg-warning"
                                  : "bg-gradient-to-r from-emerald-green to-mint-green"
                            }`}
                            style={{
                              width: `${100 - session.progress}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray mb-4">
                        <span>Started: {session.started}</span>
                        <span>Total Duration: {session.formattedTotal}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray/10">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openUpgrade(session)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl text-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 font-medium"
                    >
                      <ArrowUpCircle className="w-4 h-4" /> Upgrade Package
                    </button>

                    {(session.status === "expiring" ||
                      session.status === "warning") && (
                      <button
                        onClick={() => setAlertTarget(session)}
                        className="px-3 py-2 bg-error/10 text-error rounded-xl text-xs hover:bg-error hover:text-white transition-all flex items-center justify-center"
                        title="Alert Cashier"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => openCompleteModal(session)}
                    className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-dark-slate rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4 text-gray-600" /> Complete /
                    Return RFID
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- TAP INTENT VALIDATION MODAL --- */}
      {pendingTap && (
        <Modal title="RFID Card Tapped" onClose={handleCancelTap} size="md">
          <div className="p-5 space-y-6">
            <div className="flex items-center gap-3 bg-ocean-blue/10 p-4 rounded-xl text-ocean-blue">
              <HelpCircle className="w-8 h-8 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-dark-slate">
                  Card Scan Detected ({pendingTap.tagId})
                </p>
                <p className="text-xs text-gray">
                  Choose what you would like to do for{" "}
                  <strong className="text-dark-slate">
                    {pendingTap.customerName}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="bg-light-gray p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray">Active Package:</span>
                <span className="font-semibold text-dark-slate">
                  {pendingTap.session.packageName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray">Time Remaining:</span>
                <span className="font-semibold text-emerald-600">
                  {pendingTap.session.formattedRemaining}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleConfirmTapComplete}
                disabled={processingTapAction}
                className="w-full p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-5 h-5" />
                  Complete & Exit (Open Gate)
                </span>
                <span className="text-xs opacity-80">Return Tag & Open</span>
              </button>

              <button
                onClick={handleConfirmTapUpgrade}
                disabled={processingTapAction}
                className="w-full p-4 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl font-semibold text-sm flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Extend Time / Upgrade Package
                </span>
                <span className="text-xs opacity-80">Add Playtime</span>
              </button>

              <button
                onClick={handleCancelTap}
                disabled={processingTapAction}
                className="w-full p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-gray-500" />
                  Accidental Tap / Cancel
                </span>
                <span className="text-xs text-gray-500">Keep Active</span>
              </button>
            </div>

            {processingTapAction && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray">
                <Loader2 className="w-4 h-4 animate-spin text-ocean-blue" />
                <span>Updating records & opening gate...</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* --- Upgrade Package Modal --- */}
      {upgradeTarget && (
        <Modal
          title="Upgrade / Extend Package"
          onClose={closeUpgrade}
          size="md"
        >
          {!upgradeDone ? (
            <div className="space-y-6 p-4">
              <div className="p-6 bg-light-gray rounded-xl text-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray">Customer:</span>
                  <span className="text-dark-slate font-semibold text-base">
                    {upgradeTarget.name}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray">Current Package:</span>
                  <span className="text-dark-slate font-medium">
                    {upgradeTarget.packageName} ({upgradeTarget.zones})
                  </span>
                </div>
              </div>

              <div>
                <label className="block mb-3 text-xs font-semibold text-gray uppercase tracking-wider">
                  Select New Package
                </label>

                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {availablePackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackage(pkg)}
                      className={`w-full p-5 rounded-xl text-left border-2 transition-all ${
                        selectedPackage?.id === pkg.id
                          ? "border-ocean-blue bg-ocean-blue/5 shadow-sm"
                          : "border-gray/10 hover:border-gray/30 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <PackageIcon className="w-5 h-5 text-ocean-blue" />
                          <p className="text-base font-medium text-dark-slate">
                            {pkg.name}
                          </p>
                        </div>
                        <span className="text-base font-bold text-dark-slate">
                          ₱{pkg.price}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm text-gray mt-1">
                        <span>
                          {pkg.duration === -1
                            ? "Unlimited Duration"
                            : formatDuration(pkg.duration)}
                        </span>
                        <span className="font-semibold text-ocean-blue">
                          {pkg.zones}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleUpgrade}
                  disabled={!selectedPackage || upgrading}
                  className="flex-1 py-3.5 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {upgrading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Upgrading…
                    </>
                  ) : (
                    "Confirm Upgrade"
                  )}
                </button>

                <button
                  onClick={closeUpgrade}
                  className="px-6 py-3.5 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 p-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>

              <h4 className="text-dark-slate mb-2 font-semibold text-xl">
                Package Upgraded!
              </h4>

              <button
                onClick={closeUpgrade}
                className="px-8 py-3.5 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* --- Complete Session & RFID Validation Modal --- */}
      {completeTarget && (
        <Modal
          title="Complete Session & Return RFID"
          onClose={closeCompleteModal}
          size="md"
        >
          {!completeDone ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCompleteSession();
              }}
              className="space-y-5 p-4"
            >
              <div className="p-4 bg-light-gray rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray">Customer Name:</span>
                  <span className="font-semibold text-dark-slate">
                    {completeTarget.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray">Assigned RFID Tag:</span>
                  <span className="font-mono font-bold text-ocean-blue">
                    {completeTarget.id}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray uppercase mb-2">
                  Scan or Enter RFID Card to Confirm Return
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rfidInput}
                    onChange={(e) => handleRfidInputChange(e.target.value)}
                    placeholder={`Type or scan card (e.g. ${completeTarget.id})`}
                    autoFocus
                    className="w-full px-4 py-3 border-2 border-gray/20 rounded-xl focus:border-ocean-blue focus:outline-none font-mono text-sm pr-10"
                  />
                  <Radio className="w-5 h-5 text-gray/40 absolute right-3 top-3.5" />
                </div>

                {rfidError && (
                  <p className="text-xs text-error mt-2 font-medium">
                    {rfidError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!rfidInput.trim() || completing}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-green to-mint-green text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {completing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify, Complete & Open Gate"
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeCompleteModal}
                  className="px-5 py-3 border border-gray/30 text-gray rounded-xl text-sm font-medium hover:bg-gray/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8 p-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>

              <h4 className="text-dark-slate mb-2 font-semibold text-xl">
                Session Completed & Gate Unlocked!
              </h4>

              <button
                type="button"
                onClick={closeCompleteModal}
                className="px-8 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
              >
                Close
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
