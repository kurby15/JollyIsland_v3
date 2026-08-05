import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  UserPlus,
  Monitor,
  MapPin,
  Clock,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Package,
  Users,
  BarChart3,
  Radio,
  PanelLeft,
  LayoutGrid,
  Wifi,
} from "lucide-react";
import { useAuth } from "../App";

interface SidebarProps {
  role?: "cashier" | "admin";
}

export default function Sidebar({
  role = "cashier",
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const cashierLinks = [
    {
      to: "/cashier",
      icon: LayoutDashboard,
      label: "Dashboard",
    },
    {
      to: "/register",
      icon: UserPlus,
      label: "Register Customer",
    },
    {
      to: "/live-monitoring",
      icon: Monitor,
      label: "Live Monitoring",
    },
    {
      to: "/zone-monitoring",
      icon: MapPin,
      label: "Zone Monitoring",
    },
    {
      to: "/playtime",
      icon: Clock,
      label: "Playtime Tracking",
    },
    { to: "/logs", icon: FileText, label: "Entry/Exit Logs" },
  ];

  const adminLinks = [
    {
      to: "/admin",
      icon: LayoutDashboard,
      label: "Admin Dashboard",
    },
    {
      to: "/analytics",
      icon: BarChart3,
      label: "Analytics & Reports",
    },
    {
      to: "/packages",
      icon: Package,
      label: "Package Management",
    },
    {
      to: "/rfid-management",
      icon: Radio,
      label: "RFID Management",
    },
    {
      to: "/cashier-management",
      icon: Users,
      label: "User Management",
    },
    {
      to: "/zone-management",
      icon: LayoutGrid,
      label: "Zone Management",
    },
    {
      to: "/rfid-scanners",
      icon: Wifi,
      label: "RFID Scanners",
    },
    { to: "/settings", icon: SettingsIcon, label: "Settings" },
  ];

  const links = role === "admin" ? adminLinks : cashierLinks;

  return (
    <aside
      className={`h-screen bg-white border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out select-none relative ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Gemini Header Layout */}
      <div className="group h-16 px-4 flex items-center relative">
        {/* EXPANDED MODE: Left-aligned Branding & Right-aligned Toggle */}
        {!isCollapsed && (
          <div className="w-full flex items-center justify-between">
            {/* Left Corner: Initials + Title */}
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-ocean-blue to-sky-blue flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                JI
              </div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="font-semibold text-dark-slate text-base leading-tight truncate">
                  JollyIsland
                </span>
                <span className="text-xs text-gray-500 font-normal truncate">
                  {role === "admin"
                    ? "Admin Portal"
                    : "Cashier Portal"}
                </span>
              </div>
            </div>

            {/* Always Visible Toggle Button on the Right */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-dark-slate transition-all duration-200 focus:outline-none shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* COLLAPSED MODE: Badge with Toggle Overlap */}
        {isCollapsed && (
          <div className="relative w-9 h-9 mx-auto flex items-center justify-center">
            {/* Base JI Badge */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-ocean-blue to-sky-blue flex items-center justify-center text-white font-bold text-sm shadow-sm transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
              JI
            </div>

            {/* Overlapping Toggle Button (Reveals on Hover) */}
            <button
              onClick={() => setIsCollapsed(false)}
              className="absolute inset-0 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:text-dark-slate transition-all duration-200 opacity-0 group-hover:opacity-100 focus:outline-none shadow-sm"
              title="Expand sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1">
        <ul className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;

            return (
              <li key={link.to} className="relative group/item">
                <Link
                  to={link.to}
                  className={`flex items-center gap-4 px-3 py-3 rounded-full transition-all text-sm font-medium ${
                    isCollapsed
                      ? "justify-center px-0 w-12 h-12 mx-auto"
                      : ""
                  } ${
                    isActive
                      ? "bg-gradient-to-r from-ocean-blue to-sky-blue text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100 hover:text-ocean-blue"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && (
                    <span className="truncate whitespace-nowrap">
                      {link.label}
                    </span>
                  )}
                </Link>

                {/* Floating Hover Caption */}
                {isCollapsed && (
                  <div className="fixed left-20 -mt-10 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity z-[9999] whitespace-nowrap">
                    {link.label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer / Logout */}
      <div className="p-3">
        <div className="relative group/logout">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-4 px-3 py-3 text-sm font-medium text-error hover:bg-red-50 rounded-full transition-all ${
              isCollapsed
                ? "justify-center px-0 w-12 h-12 mx-auto"
                : ""
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && (
              <span className="truncate whitespace-nowrap">
                Logout
              </span>
            )}
          </button>

          {/* Logout Caption */}
          {isCollapsed && (
            <div className="fixed left-20 -mt-10 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover/logout:opacity-100 transition-opacity z-[9999] whitespace-nowrap">
              Logout
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}