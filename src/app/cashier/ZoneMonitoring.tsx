import { useState, useEffect } from "react";
import { Users, TrendingUp, MapPin, Star, Loader2 } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

export interface FirestoreZone {
  id: string;
  name: string;
  capacity: number;
  current: number;
  minAge: number;
  maxAge: number;
  accessLevel: "standard" | "premium";
}

export default function ZoneMonitoring() {
  const [zones, setZones] = useState<FirestoreZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const zonesRef = collection(db, "zones");
    const packagesRef = collection(db, "packages");
    const regsRef = collection(db, "registrations");

    let cachedPackages: Record<string, { zoneId: string; zoneName: string }> =
      {};
    let cachedRegistrations: any[] = [];
    let cachedZonesData: any[] = [];

    const updateZoneOccupancy = () => {
      const pkgToZoneMap = cachedPackages;
      const zoneCounts: Record<string, number> = {};

      // Filter only active, un-returned sessions
      const activeRegistrations = cachedRegistrations.filter((reg) => {
        return reg.status !== "completed" && reg.returned !== true;
      });

      activeRegistrations.forEach((reg) => {
        // Direct zone matching if saved on registration
        let targetZoneId = reg.zoneId;

        // Otherwise, look up via packageId mapping
        if (!targetZoneId && reg.packageId && pkgToZoneMap[reg.packageId]) {
          targetZoneId = pkgToZoneMap[reg.packageId].zoneId;
        }

        // Fallback to zoneName if zoneId isn't found
        const fallbackKey = targetZoneId || reg.zoneName || "unassigned";
        zoneCounts[fallbackKey] = (zoneCounts[fallbackKey] || 0) + 1;
      });

      const processedZones: FirestoreZone[] = cachedZonesData.map((docSnap) => {
        const data = docSnap.data();
        const zoneId = docSnap.id;
        const customZoneId = data.id || zoneId;
        const zoneName = data.name || data.zoneName || "Play Zone";

        // Aggregate occupancy across matched zone IDs or name fallbacks
        const liveOccupancy =
          (zoneCounts[zoneId] || 0) +
            (zoneCounts[customZoneId] && customZoneId !== zoneId
              ? zoneCounts[customZoneId]
              : 0) ||
          zoneCounts[zoneName] ||
          0;

        const capacity = Number(data.capacity || data.maxCapacity) || 20;

        return {
          id: zoneId,
          name: zoneName,
          capacity: capacity > 0 ? capacity : 20,
          current: liveOccupancy,
          minAge: Number(data.minAge) || 0,
          maxAge: Number(data.maxAge) || 99,
          accessLevel:
            (data.accessLevel || "standard").toLowerCase() === "premium"
              ? "premium"
              : "standard",
        };
      });

      setZones(processedZones);
      setLoading(false);
    };

    // 1. Live listener for Packages
    const unsubscribePackages = onSnapshot(packagesRef, (pkgSnapshot) => {
      const pkgs: Record<string, { zoneId: string; zoneName: string }> = {};
      pkgSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        pkgs[docSnap.id] = {
          zoneId: data.zoneId || data.zone_id || "",
          zoneName: data.zones || data.zoneName || "",
        };
      });
      cachedPackages = pkgs;
      updateZoneOccupancy();
    });

    // 2. Live listener for Registrations
    const unsubscribeRegs = onSnapshot(regsRef, (regSnapshot) => {
      cachedRegistrations = regSnapshot.docs.map((docSnap) => docSnap.data());
      updateZoneOccupancy();
    });

    // 3. Live listener for Zones
    const unsubscribeZones = onSnapshot(
      zonesRef,
      (zoneSnapshot) => {
        cachedZonesData = zoneSnapshot.docs;
        updateZoneOccupancy();
      },
      (error) => {
        console.error("Error fetching zone monitoring data:", error);
        setLoading(false);
      },
    );

    return () => {
      unsubscribePackages();
      unsubscribeRegs();
      unsubscribeZones();
    };
  }, []);

  const getBarColor = (pct: number) => {
    if (pct >= 90) return "from-error to-red-400";
    if (pct >= 70) return "from-warning to-yellow-400";
    return "from-emerald-green to-mint-green";
  };

  const getStatusLabel = (pct: number) => {
    if (pct >= 90) return "Full";
    if (pct >= 70) return "Busy";
    return "Available";
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-dark-slate mb-2 text-2xl font-bold">
          Zone Monitoring
        </h1>
        <p className="text-gray text-sm">
          Interactive indoor play center zone management & live registration
          tracking
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray/10 text-gray gap-2 mb-8">
          <Loader2 className="w-6 h-6 animate-spin text-ocean-blue" />
          <span>Syncing live zone entries...</span>
        </div>
      ) : zones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray/10 p-12 text-center text-gray mb-8">
          No active zones found in database. Please create zones in
          Settings/Admin.
        </div>
      ) : (
        <>
          {/* Interactive Zone Map */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-8 mb-8">
            <h3 className="text-dark-slate font-bold mb-6">
              Interactive Play Center Map
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {zones.map((zone) => {
                const pct = Math.min(
                  100,
                  Math.round((zone.current / zone.capacity) * 100),
                );
                const statusColor =
                  pct >= 90 ? "error" : pct >= 70 ? "warning" : "success";

                return (
                  <div
                    key={zone.id}
                    className="relative bg-gradient-to-br from-light-gray to-white border-2 border-gray/20 rounded-2xl p-6 hover:shadow-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-dark-slate font-bold">
                            {zone.name}
                          </h4>
                          {zone.accessLevel === "premium" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-warning/10 text-warning rounded-full text-[10px] font-semibold">
                              <Star className="w-2.5 h-2.5 fill-warning" />{" "}
                              Premium
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-ocean-blue" />
                          <span className="text-xs text-gray font-medium">
                            Age:{" "}
                            {zone.minAge === 0
                              ? "Any"
                              : `${zone.minAge}–${zone.maxAge === 99 ? "99+" : zone.maxAge}`}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          statusColor === "error"
                            ? "bg-error/10 text-error"
                            : statusColor === "warning"
                              ? "bg-warning/10 text-warning"
                              : "bg-success/10 text-success"
                        }`}
                      >
                        {getStatusLabel(pct)}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-bold text-dark-slate">
                          {zone.current}
                        </span>
                        <span className="text-gray mb-1 text-sm">
                          / {zone.capacity} children
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray" />
                        <span className="text-xs text-gray font-medium">
                          Current Occupancy
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray font-medium">
                          Capacity
                        </span>
                        <span className="text-xs font-bold text-dark-slate">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getBarColor(pct)} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Capacity Visual Blocks */}
                    <div className="grid grid-cols-5 gap-1 mt-4">
                      {Array.from({ length: Math.min(zone.capacity, 20) }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className={`h-8 rounded transition-all ${
                              i < zone.current
                                ? statusColor === "error"
                                  ? "bg-error"
                                  : statusColor === "warning"
                                    ? "bg-warning"
                                    : "bg-emerald-green"
                                : "bg-gray/10"
                            }`}
                          ></div>
                        ),
                      )}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-br from-ocean-blue/5 to-emerald-green/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zone Details Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-dark-slate font-bold">
                Zone Activity Details
              </h3>
              <div className="flex gap-4 text-xs font-medium">
                {[
                  { cls: "bg-success", label: "Available" },
                  { cls: "bg-warning", label: "Busy" },
                  { cls: "bg-error", label: "Full" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${s.cls} rounded`}></div>
                    <span className="text-gray">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray/20">
                    {[
                      "Zone Name",
                      "Current Occupancy",
                      "Max Capacity",
                      "Utilization",
                      "Access",
                      "Status",
                      "RFID Activity",
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
                  {zones.map((zone) => {
                    const pct = Math.min(
                      100,
                      Math.round((zone.current / zone.capacity) * 100),
                    );
                    return (
                      <tr
                        key={zone.id}
                        className="border-b border-gray/10 hover:bg-light-gray/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-ocean-blue" />
                            <span className="text-dark-slate font-semibold text-sm">
                              {zone.name}
                            </span>
                            {zone.accessLevel === "premium" && (
                              <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-dark-slate text-sm font-medium">
                          {zone.current} children
                        </td>
                        <td className="py-4 px-4 text-gray text-sm">
                          {zone.capacity} children
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-ocean-blue to-sky-blue transition-all"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-dark-slate">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              zone.accessLevel === "premium"
                                ? "bg-warning/10 text-warning"
                                : "bg-ocean-blue/10 text-ocean-blue"
                            }`}
                          >
                            {zone.accessLevel === "premium" && (
                              <Star className="w-3 h-3 fill-warning" />
                            )}
                            {zone.accessLevel.charAt(0).toUpperCase() +
                              zone.accessLevel.slice(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              pct >= 90
                                ? "bg-error/10 text-error"
                                : pct >= 70
                                  ? "bg-warning/10 text-warning"
                                  : "bg-success/10 text-success"
                            }`}
                          >
                            {getStatusLabel(pct)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray">
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span>Active</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
