import { useState, useEffect, useMemo, useRef } from "react";
import Modal from "../components/Modal";
import {
  UserPlus,
  CheckCircle,
  Clock,
  Tag,
  Users,
  Receipt,
  Loader2,
  Wifi,
  Radio,
  Zap,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  Timestamp,
  getDocs,
  increment,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";

export interface PackageItem {
  id: string;
  name: string;
  duration: string | number;
  price: number;
  zoneId: string;
  zoneName: string;
}

export interface ZoneItem {
  id: string;
  name: string;
}

export interface RFIDCard {
  id: string;
  pagerNumber?: string;
  status: "available" | "assigned" | "lost" | "disabled";
  customer?: string;
  assignedDate?: string | Timestamp;
}

const GUARDIAN_FEE = 50;

const emptyForm = {
  childName: "",
  age: "",
  package: "",
  rfidCard: "",
  guardianEntry: false,
};

type FormData = typeof emptyForm;

function formatDuration(rawDuration: string | number): string {
  if (
    rawDuration === -1 ||
    rawDuration === "-1" ||
    String(rawDuration).toLowerCase().includes("unlimited")
  ) {
    return "Unlimited";
  }

  const numMatch = String(rawDuration).match(/\d+/);
  if (!numMatch) return String(rawDuration);

  const minutes = parseInt(numMatch[0], 10);
  if (isNaN(minutes)) return String(rawDuration);

  if (String(rawDuration).toLowerCase().includes("hr")) {
    return String(rawDuration);
  }

  const hours = minutes / 60;
  return hours < 1 ? `${hours} hrs` : `${hours} ${hours === 1 ? "hr" : "hrs"}`;
}

export default function CustomerRegistration() {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [availableCards, setAvailableCards] = useState<RFIDCard[]>([]);

  const [loadingPackages, setLoadingPackages] = useState(true);
  const [, setLoadingCards] = useState(true);

  const [selectedZoneId, setSelectedZoneId] = useState("All");
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastRegistered, setLastRegistered] = useState<{
    form: FormData;
    total: number;
    pkgName?: string;
    pkgPrice?: number;
  } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [lastScannedTag, setLastScannedTag] = useState<string | null>(null);

  // Refs for tracking active state inside asynchronous listener callbacks
  const formRef = useRef(form);
  const packagesRef = useRef(packages);
  const registeringRef = useRef(registering);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    packagesRef.current = packages;
  }, [packages]);

  useEffect(() => {
    registeringRef.current = registering;
  }, [registering]);

  // 1. Fetch Zones
  useEffect(() => {
    const zonesRef = collection(db, "zones");
    const unsubscribe = onSnapshot(
      zonesRef,
      (snapshot) => {
        const fetchedZones: ZoneItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().zoneName || "Play Zone",
        }));
        setZones(fetchedZones);
      },
      (error) => console.error("Error fetching zones:", error),
    );
    return () => unsubscribe();
  }, []);

  // 2. Fetch Packages
  useEffect(() => {
    setLoadingPackages(true);
    const pkgRef = collection(db, "packages");

    const unsubscribe = onSnapshot(
      pkgRef,
      (snapshot) => {
        const defaultZone = zones[0]?.name || "Jolly Play Zone";

        const fetchedPackages: PackageItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const pkgZoneId = data.zoneId || data.zone_id || "";

          const matchedZone = zones.find((z) => z.id === pkgZoneId);
          const resolvedZoneName = matchedZone
            ? matchedZone.name
            : data.zones || data.zoneName || defaultZone;

          let parsedDuration: string | number = data.duration ?? "";
          if (
            data.durationMinutes !== undefined &&
            data.durationMinutes !== null
          ) {
            parsedDuration = Number(data.durationMinutes);
          }

          return {
            id: docSnap.id,
            name: data.name || data.packageName || "",
            duration: parsedDuration,
            price: Number(data.price || data.amount) || 0,
            zoneId: pkgZoneId || matchedZone?.id || "",
            zoneName: resolvedZoneName,
          };
        });

        setPackages(fetchedPackages);
        setLoadingPackages(false);
      },
      (error) => {
        console.error("Firestore Packages read error:", error);
        toast.error("Failed to load packages from database");
        setLoadingPackages(false);
      },
    );

    return () => unsubscribe();
  }, [zones]);

  // 3. Fetch Available Cards
  useEffect(() => {
    setLoadingCards(true);
    const rfidRef = collection(db, "rfid_cards");
    const q = query(rfidRef, where("status", "==", "available"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedCards: RFIDCard[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            pagerNumber: data.pagerNumber || "-",
            status: data.status,
            customer: data.customer || "-",
          };
        });
        setAvailableCards(fetchedCards);
        setLoadingCards(false);
      },
      (error) => {
        console.error("Firestore Available RFID read error:", error);
        toast.error("Failed to load available RFID cards");
        setLoadingCards(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const selectedPkg = useMemo(() => {
    return packages.find((p) => p.id === form.package);
  }, [packages, form.package]);

  const packagePrice = selectedPkg?.price ?? 0;
  const guardianFee = form.guardianEntry ? GUARDIAN_FEE : 0;
  const total = packagePrice + guardianFee;

  const canSubmit = Boolean(form.childName.trim() && form.age && form.package);

  // --- CORE REGISTRATION & GATE OPEN FUNCTION ---
  const executeRegistration = async (rfidUid: string) => {
    if (registeringRef.current) return;
    setRegistering(true);

    const currentForm = formRef.current;
    const currentPkg = packagesRef.current.find(
      (p) => p.id === currentForm.package,
    );

    const calculatedPkgPrice = currentPkg?.price ?? 0;
    const calculatedGuardianFee = currentForm.guardianEntry ? GUARDIAN_FEE : 0;
    const calculatedTotal = calculatedPkgPrice + calculatedGuardianFee;

    try {
      const todayStr = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const nowMs = Date.now();

      let durationMinutes = 60;
      if (currentPkg) {
        if (currentPkg.duration === -1 || currentPkg.duration === "-1") {
          durationMinutes = -1;
        } else {
          const rawDurStr = String(currentPkg.duration);
          const numMatch = rawDurStr.match(/\d+/);
          if (numMatch) {
            durationMinutes = parseInt(numMatch[0], 10);
            if (
              rawDurStr.toLowerCase().includes("hr") &&
              !rawDurStr.toLowerCase().includes("min")
            ) {
              durationMinutes *= 60;
            }
          }
        }
      }

      // Check if session already active on this card
      const regsRef = collection(db, "registrations");
      const activeQuery = query(
        regsRef,
        where("rfidCardId", "==", rfidUid),
        where("status", "==", "active"),
      );
      const existingSnap = await getDocs(activeQuery);

      const batch = writeBatch(db);

      if (!existingSnap.empty) {
        // Handle Top-up / Extension
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        const docRef = doc(db, "registrations", existingDoc.id);

        const currentDuration = Number(existingData.totalDuration || 60);
        const addedDuration = durationMinutes === -1 ? 0 : durationMinutes;
        const newTotalDuration =
          currentDuration === -1 ? -1 : currentDuration + addedDuration;
        const newTotalAmount =
          Number(existingData.totalAmount || 0) + calculatedTotal;

        batch.update(docRef, {
          totalDuration: newTotalDuration,
          extensionDuration: increment(addedDuration),
          totalAmount: newTotalAmount,
          lastExtendedAt: serverTimestamp(),
        });

        const txRef = doc(collection(db, "transactions"));
        batch.set(txRef, {
          registrationId: existingDoc.id,
          rfidCardId: rfidUid,
          childName: currentForm.childName.trim(),
          packageName: currentPkg?.name || "Extension",
          amount: calculatedTotal,
          type: "Extension",
          createdAt: serverTimestamp(),
        });

        toast.success(
          `Session extended for ${currentForm.childName} — ₱${calculatedTotal} added`,
        );
      } else {
        // Primary Registration
        const registrationRef = doc(collection(db, "registrations"));
        batch.set(registrationRef, {
          childName: currentForm.childName.trim(),
          age: Number(currentForm.age),
          packageId: currentForm.package,
          packageName: currentPkg?.name || "",
          zoneId: currentPkg?.zoneId || "",
          zoneName: currentPkg?.zoneName || "",
          rfidCardId: rfidUid,
          activeRfidTag: rfidUid,
          isRfidAvailable: false,
          guardianEntry: currentForm.guardianEntry,
          guardianFee: calculatedGuardianFee,
          packagePrice: calculatedPkgPrice,
          totalAmount: calculatedTotal,
          totalDuration: durationMinutes,
          startTimeStamp: nowMs,
          status: "active",
          returned: false,
          createdAt: serverTimestamp(),
        });

        // Mark RFID Card as assigned
        const cardRef = doc(db, "rfid_cards", rfidUid);
        batch.update(cardRef, {
          status: "assigned",
          isAssigned: true,
          customer: currentForm.childName.trim(),
          assignedDate: todayStr,
          currentSessionId: registrationRef.id,
        });

        toast.success(
          `${currentForm.childName} registered — ₱${calculatedTotal} received`,
          {
            description: `${currentPkg?.name}${
              currentForm.guardianEntry ? " + Guardian Entry" : ""
            } · Card ${rfidUid}`,
          },
        );
      }

      // --- COMMAND SENT TO ESP32 GATE ---
      const commandRef = doc(collection(db, "gate_commands"));
      batch.set(commandRef, {
        command: "OPEN_GATE",
        status: "pending",
        scannerSerialNumber: "ESP32-001",
        rfidCardId: rfidUid,
        childName: currentForm.childName.trim(),
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      addNotification({
        type: "success",
        title: "Customer Registered & Gate Triggered",
        message: `${currentForm.childName} registered with ${currentPkg?.name} (₱${calculatedTotal}). Gate opening command sent to scanner ESP32-001.`,
        role: "both",
      });

      setLastRegistered({
        form: { ...currentForm, rfidCard: rfidUid },
        total: calculatedTotal,
        pkgName: currentPkg?.name,
        pkgPrice: calculatedPkgPrice,
      });
      setShowSuccess(true);
      setForm(emptyForm);
      setSelectedZoneId("All");
      setLastScannedTag(null);
    } catch (error) {
      console.error("Firestore Customer registration error:", error);
      toast.error("Failed to register customer. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  // 4. REAL-TIME LISTENER FOR PHYSICAL SCANNER (Auto-registers upon card contact)
  useEffect(() => {
    const logsRef = collection(db, "rfid_logs");
    const q = query(logsRef, where("processed", "==", false), limit(5));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const unprocessedDocs = snapshot.docs.filter(
        (docSnap) => docSnap.data().processed === false,
      );

      if (unprocessedDocs.length === 0) return;

      for (const logDoc of unprocessedDocs) {
        const logData = logDoc.data();
        const scannedUid = logData.uid;
        if (!scannedUid) continue;

        const batch = writeBatch(db);

        // Mark as processed immediately to avoid duplicated handler runs
        batch.update(logDoc.ref, {
          processed: true,
          processedAt: serverTimestamp(),
        });

        await batch.commit();

        setLastScannedTag(scannedUid);

        // Verify form readiness
        const currentForm = formRef.current;
        if (
          !currentForm.childName.trim() ||
          !currentForm.age ||
          !currentForm.package
        ) {
          toast.warning(`RFID Scanned: ${scannedUid}`, {
            description:
              "Please fill out child details and select a package first!",
          });
          setForm((prev) => ({ ...prev, rfidCard: scannedUid }));
          return;
        }

        // Form complete -> Execute automatic registration and gate open trigger!
        await executeRegistration(scannedUid);
      }
    });

    return () => unsubscribe();
  }, [availableCards]);

  const categoryTabs = useMemo(() => {
    const uniqueZones = Array.from(
      new Set(
        packages.map((p) => JSON.stringify({ id: p.zoneId, name: p.zoneName })),
      ),
    ).map((str) => JSON.parse(str) as { id: string; name: string });

    return [{ id: "All", name: "All" }, ...uniqueZones];
  }, [packages]);

  const filteredPackages = useMemo(() => {
    if (selectedZoneId === "All") return packages;
    return packages.filter(
      (p) => p.zoneId === selectedZoneId || p.zoneName === selectedZoneId,
    );
  }, [packages, selectedZoneId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || registering) return;
    if (!form.rfidCard) {
      toast.error("Please tap an RFID card on the scanner to register.");
      return;
    }
    executeRegistration(form.rfidCard);
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-dark-slate mb-1 text-2xl font-bold">
              Customer Registration
            </h1>
            <p className="text-gray">
              Fill details, select a package, then{" "}
              <strong>tap RFID card</strong> on the scanner to register and
              trigger the gate.
            </p>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2 bg-ocean-blue/10 border border-ocean-blue/20 rounded-xl text-ocean-blue text-xs font-semibold w-fit">
            <Radio className="w-4 h-4 animate-pulse text-ocean-blue" />
            <span>ESP32 RFID Scanner Connected</span>
          </div>
        </div>

        <form onSubmit={handleManualSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* ── Left Side: Inputs + Package Grid ── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Child Information Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-ocean-blue/10 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-ocean-blue" />
                  </div>
                  <h3 className="text-dark-slate font-semibold">
                    Child Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm text-gray font-medium">
                      Child Name <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.childName}
                      onChange={(e) =>
                        setForm({ ...form, childName: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:bg-white focus:outline-none transition-all"
                      placeholder="Enter child's full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm text-gray font-medium">
                      Age <span className="text-error">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="18"
                      value={form.age}
                      onChange={(e) =>
                        setForm({ ...form, age: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:bg-white focus:outline-none transition-all"
                      placeholder="e.g. 7"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Package Selector */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Tag className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h3 className="text-dark-slate font-semibold">
                    Select Package
                  </h3>
                </div>

                <div className="flex gap-1.5 p-1 bg-light-gray rounded-xl mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {categoryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedZoneId(tab.id)}
                      className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                        selectedZoneId === tab.id
                          ? "bg-white text-dark-slate shadow-sm"
                          : "text-gray hover:text-dark-slate"
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>

                {loadingPackages ? (
                  <div className="flex items-center justify-center py-12 text-gray gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-ocean-blue" />{" "}
                    Loading packages...
                  </div>
                ) : filteredPackages.length === 0 ? (
                  <p className="text-center py-8 text-gray text-sm">
                    No packages found for this zone.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
                    {filteredPackages.map((pkg) => {
                      const isSelected = form.package === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setForm({ ...form, package: pkg.id })}
                          className={`text-left p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                            isSelected
                              ? "border-ocean-blue bg-ocean-blue/5 shadow-md"
                              : "border-gray/10 hover:border-ocean-blue/30 hover:shadow-sm"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-ocean-blue rounded-l-xl" />
                          )}
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="text-[10px] font-bold tracking-wider text-ocean-blue uppercase bg-ocean-blue/10 px-2 py-0.5 rounded-md">
                                {pkg.zoneName}
                              </span>
                              <p className="text-dark-slate font-bold text-sm mt-1.5">
                                {pkg.name}
                              </p>
                            </div>
                            <span className="text-emerald-500 font-bold text-base">
                              ₱{pkg.price}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray pt-2 border-t border-gray/10">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{" "}
                              {formatDuration(pkg.duration)}
                            </div>
                            {isSelected && (
                              <span className="text-ocean-blue font-semibold flex items-center gap-0.5">
                                <CheckCircle className="w-3 h-3" /> Selected
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RFID Scanner Dynamic Action Banner */}
              <div
                className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition-all ${
                  canSubmit
                    ? "border-ocean-blue bg-ocean-blue/5 animate-pulse"
                    : "border-gray/15"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      canSubmit
                        ? "bg-ocean-blue text-white"
                        : "bg-gray/10 text-gray"
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-dark-slate font-bold text-base">
                      {canSubmit
                        ? "READY! Tap RFID Card on Scanner to Register & Open Gate"
                        : "Fill in child details and pick a package to proceed"}
                    </h3>
                    <p className="text-xs text-gray mt-0.5">
                      {canSubmit
                        ? "Scanning card registers customer and sends OPEN_GATE signal to ESP32."
                        : "Awaiting child name, age, and package choice."}
                    </p>
                  </div>
                </div>

                {lastScannedTag && (
                  <div className="mt-4 p-3 bg-white border border-gray/15 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-ocean-blue">
                    <Wifi className="w-4 h-4 animate-pulse" />
                    <span>Last Scanned Card UID: {lastScannedTag}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right Side: Order Summary ── */}
            <div className="sticky top-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray/10 overflow-hidden">
                <div className="bg-gradient-to-r from-ocean-blue to-sky-blue px-6 py-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt className="w-4 h-4 text-white/80" />
                    <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
                      Payment Summary
                    </span>
                  </div>
                  <p className="text-white font-semibold text-lg">
                    JollyIsland Play Center
                  </p>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-xs text-gray uppercase tracking-wider font-medium mb-3">
                      Customer
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray">Child Name</span>
                        <span className="text-dark-slate font-medium">
                          {form.childName || (
                            <span className="text-gray/50 italic">—</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray">Age</span>
                        <span className="text-dark-slate font-medium">
                          {form.age ? (
                            `${form.age} yrs`
                          ) : (
                            <span className="text-gray/50 italic">—</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray/20" />

                  <div>
                    <p className="text-xs text-gray uppercase tracking-wider font-medium mb-3">
                      Order
                    </p>
                    <div className="space-y-3">
                      {selectedPkg ? (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-dark-slate font-semibold text-sm">
                              {selectedPkg.name}
                            </p>
                            <p className="text-gray text-xs mt-0.5">
                              {selectedPkg.zoneName} Zone ·{" "}
                              {formatDuration(selectedPkg.duration)}
                            </p>
                          </div>
                          <span className="text-dark-slate font-semibold text-sm">
                            ₱{selectedPkg.price}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm text-gray/50 italic">
                          <span>No package selected</span>
                          <span>₱0</span>
                        </div>
                      )}

                      {/* Guardian add-on option */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          form.guardianEntry
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-gray/10 bg-light-gray/50"
                        }`}
                        onClick={() =>
                          setForm({
                            ...form,
                            guardianEntry: !form.guardianEntry,
                          })
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              form.guardianEntry
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-gray/30 bg-white"
                            }`}
                          >
                            {form.guardianEntry && (
                              <CheckCircle
                                className="w-3.5 h-3.5 text-white"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-gray" />
                              <span className="text-dark-slate text-sm font-medium">
                                Guardian Entry
                              </span>
                            </div>
                            <p className="text-xs text-gray mt-0.5">
                              Accompanies child inside
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold ${
                            form.guardianEntry
                              ? "text-emerald-500"
                              : "text-gray/50"
                          }`}
                        >
                          +₱{GUARDIAN_FEE}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray/20" />

                  {/* Total calculation */}
                  <div className="flex items-center justify-between">
                    <span className="text-dark-slate font-bold text-base">
                      Total Payable
                    </span>
                    <span className="text-emerald-500 font-extrabold text-2xl">
                      ₱{total}
                    </span>
                  </div>

                  {/* Fallback Manual Trigger */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="submit"
                      disabled={!canSubmit || registering}
                      className="w-full py-3.5 px-4 bg-ocean-blue hover:bg-sky-blue disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {registering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing & Triggering Gate...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Manual Register (If Card Scanned)
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-gray text-center">
                      (Card tap on reader triggers registration automatically)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Success Modal - Compatible with Modal props */}
      {showSuccess && lastRegistered && (
        <Modal
          title="Registration Successful!"
          onClose={() => setShowSuccess(false)}
        >
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark-slate">
                {lastRegistered.form.childName} Registered
              </h3>
              <p className="text-xs text-gray mt-1">
                Gate opening signal sent to scanner ESP32-001
              </p>
            </div>
            <div className="p-4 bg-light-gray rounded-xl space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray">Card ID:</span>
                <span className="font-mono font-bold text-dark-slate">
                  {lastRegistered.form.rfidCard}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray">Package:</span>
                <span className="font-semibold text-dark-slate">
                  {lastRegistered.pkgName}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray/20 pt-2 font-bold">
                <span className="text-dark-slate">Amount Paid:</span>
                <span className="text-emerald-500">
                  ₱{lastRegistered.total}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-3 bg-ocean-blue text-white rounded-xl font-bold shadow-sm hover:bg-sky-blue transition-all"
            >
              Done / Next Registration
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
