import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { Bell, CheckCheck, X, Filter } from "lucide-react";
import adminLogo from "../../imports/4cf06a33233964ee2276865a5206b0ca.jpg";
import cashierLogo from "../../imports/ec4967089710f65f16ad716326613389.jpg";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  subscribeNotifications,
  type Notification,
  type NotifType,
} from "../store/notificationStore";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/cashier": "Cashier Dashboard",
  "/register": "Register Customer",
  "/live-monitoring": "Live Monitoring",
  "/zone-monitoring": "Zone Monitoring",
  "/playtime": "Playtime Tracking",
  "/access-validation": "Access Validation",
  "/logs": "Entry & Exit Logs",
  "/packages": "Package Management",
  "/rfid-management": "RFID Management",
  "/cashier-management": "Cashier Management",
  "/analytics": "Analytics & Reports",
  "/zone-management": "Zone Management",
  "/rfid-scanners": "RFID Scanner Management",
  "/settings": "Settings",
};

const TYPE_STYLES: Record<NotifType, string> = {
  warning: "bg-warning/10 border-warning/30 text-warning",
  error: "bg-error/10 border-error/30 text-error",
  success: "bg-success/10 border-success/30 text-success",
  info: "bg-ocean-blue/10 border-ocean-blue/30 text-ocean-blue",
};

const TYPE_DOT: Record<NotifType, string> = {
  warning: "bg-warning",
  error: "bg-error",
  success: "bg-success",
  info: "bg-ocean-blue",
};

const TYPE_ICON: Record<NotifType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

interface TopBarProps {
  role: "admin" | "cashier";
  username?: string;
}

interface StoredUser {
  username: string;
  email?: string;
  name?: string;
  role?: string;
}

function NotifItem({ n, onClick }: { n: Notification; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 hover:bg-light-gray transition-colors flex gap-3 items-start ${!n.read ? "bg-ocean-blue/[0.03]" : ""}`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
          n.type === "success"
            ? "bg-success/10 text-success"
            : n.type === "error"
              ? "bg-error/10 text-error"
              : n.type === "warning"
                ? "bg-warning/10 text-warning"
                : "bg-ocean-blue/10 text-ocean-blue"
        }`}
      >
        {TYPE_ICON[n.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_STYLES[n.type]}`}
          >
            {n.title}
          </span>
          <span className="text-xs text-gray flex-shrink-0">{n.time}</span>
        </div>
        <p
          className={`text-sm mt-1 ${n.read ? "text-gray" : "text-dark-slate"}`}
        >
          {n.message}
        </p>
      </div>
      {!n.read && (
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${TYPE_DOT[n.type]}`}
        ></div>
      )}
    </button>
  );
}

export default function TopBar({
  role,
  username: initialUsername,
}: TopBarProps) {
  const location = useLocation();

  // Lazy initialize user session from localStorage
  const [userData, setUserData] = useState<StoredUser>(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error("Failed to parse user session", e);
      }
    }
    return {
      username: initialUsername || localStorage.getItem("username") || "User",
      email: "",
    };
  });

  // Sync state if prop changes dynamically
  useEffect(() => {
    if (initialUsername) {
      setUserData((prev) => ({
        ...prev,
        username: initialUsername,
      }));
    }
  }, [initialUsername]);

  const [notifs, setNotifs] = useState<Notification[]>(() =>
    getNotifications(role),
  );
  const [unread, setUnread] = useState(() => getUnreadCount(role));
  const [open, setOpen] = useState(false);
  const [seeAll, setSeeAll] = useState(false);
  const [allFilter, setAllFilter] = useState<"all" | NotifType>("all");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeNotifications(() => {
      setNotifs(getNotifications(role));
      setUnread(getUnreadCount(role));
    });
  }, [role]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pageTitle = PAGE_TITLES[location.pathname] ?? "JollyIsland";
  const handleMarkAll = () => markAllRead(role);
  const handleClickNotif = (n: Notification) => {
    if (!n.read) markRead(n.id);
  };

  const filteredAll =
    allFilter === "all" ? notifs : notifs.filter((n) => n.type === allFilter);
  const unreadAll = notifs.filter((n) => !n.read).length;

  return (
    <>
      <div className="h-16 bg-white border-b border-gray/10 flex items-center justify-between px-8 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-dark-slate font-semibold text-base">
            {pageTitle}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Bell with badge */}
          <div ref={panelRef} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="relative p-2 rounded-xl hover:bg-light-gray transition-all"
            >
              <Bell className="w-5 h-5 text-gray" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>

            {/* Dropdown panel */}
            {open && (
              <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-xl border border-gray/10 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray/10">
                  <div className="flex items-center gap-2">
                    <span className="text-dark-slate font-semibold">
                      Notifications
                    </span>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 bg-error/10 text-error text-xs font-semibold rounded-full">
                        {unread} new
                      </span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button
                      onClick={handleMarkAll}
                      className="flex items-center gap-1 text-xs text-ocean-blue hover:underline"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[360px] overflow-y-auto divide-y divide-gray/10">
                  {notifs.length === 0 ? (
                    <div className="py-10 text-center text-gray text-sm">
                      No notifications
                    </div>
                  ) : (
                    notifs
                      .slice(0, 6)
                      .map((n) => (
                        <NotifItem
                          key={n.id}
                          n={n}
                          onClick={() => handleClickNotif(n)}
                        />
                      ))
                  )}
                </div>

                <div className="px-5 py-3 border-t border-gray/10 bg-light-gray/50 flex items-center justify-between">
                  <span className="text-xs text-gray">
                    {notifs.length} total
                  </span>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setSeeAll(true);
                    }}
                    className="text-xs font-medium text-ocean-blue hover:underline flex items-center gap-1"
                  >
                    See all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray/10">
            <img
              src={role === "admin" ? adminLogo : cashierLogo}
              alt={role}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-ocean-blue/20"
            />
            <div className="hidden sm:block">
              {/* Display persistent username */}
              <p className="text-dark-slate text-sm font-medium leading-tight">
                {userData.username}
              </p>
              {/* Display persistent email if available */}
              {userData.email && (
                <p className="text-[11px] text-gray truncate max-w-[150px]">
                  {userData.email}
                </p>
              )}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mt-0.5 ${
                  role === "admin"
                    ? "bg-purple-100 text-purple-600"
                    : "bg-ocean-blue/10 text-ocean-blue"
                }`}
              >
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* See All Modal */}
      {seeAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray/10">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-ocean-blue" />
                <h3 className="text-dark-slate">All Notifications</h3>
                {unreadAll > 0 && (
                  <span className="px-2 py-0.5 bg-error/10 text-error text-xs font-semibold rounded-full">
                    {unreadAll} unread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadAll > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="flex items-center gap-1 text-xs text-ocean-blue hover:underline"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setSeeAll(false)}
                  className="text-gray hover:text-dark-slate transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray/10 bg-light-gray/30">
              <Filter className="w-3.5 h-3.5 text-gray" />
              {(["all", "success", "info", "warning", "error"] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setAllFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                      allFilter === f
                        ? f === "all"
                          ? "bg-ocean-blue text-white"
                          : f === "success"
                            ? "bg-success text-white"
                            : f === "warning"
                              ? "bg-warning text-white"
                              : f === "error"
                                ? "bg-error text-white"
                                : "bg-ocean-blue text-white"
                        : "bg-white text-gray border border-gray/20 hover:border-gray/40"
                    }`}
                  >
                    {f === "all"
                      ? `All (${notifs.length})`
                      : `${f} (${notifs.filter((n) => n.type === f).length})`}
                  </button>
                ),
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray/10">
              {filteredAll.length === 0 ? (
                <div className="py-16 text-center text-gray">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>No {allFilter !== "all" ? allFilter : ""} notifications</p>
                </div>
              ) : (
                filteredAll.map((n) => (
                  <NotifItem
                    key={n.id}
                    n={n}
                    onClick={() => handleClickNotif(n)}
                  />
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray/10 bg-light-gray/30 text-center">
              <span className="text-xs text-gray">
                {filteredAll.length} notification
                {filteredAll.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
