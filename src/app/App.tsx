import { HashRouter, Routes, Route, Navigate } from "react-router";
import { useState, createContext, useContext } from "react";
import { RefreshProvider } from "./contexts/RefreshContext";
import Layout from "./components/Layout";
import Login from "./auth/Login";
import CashierDashboard from "./cashier/Dashboard";
import CustomerRegistration from "./cashier/CustomerRegistration";
import LiveMonitoring from "./cashier/LiveMonitoring";
import ZoneMonitoring from "./cashier/ZoneMonitoring";
import PlaytimeTracking from "./cashier/PlaytimeTracking";
import AccessValidation from "./cashier/AccessValidation";
import EntryExitLogs from "./cashier/EntryExitLogs";
import AdminDashboard from "./admin/Dashboard";
import PackageManagement from "./admin/PackageManagement";
import RFIDManagement from "./admin/RFIDManagement";
import CashierManagement from "./admin/CashierManagement";
import AnalyticsReports from "./admin/AnalyticsReports";
import Settings from "./admin/Settings";
import ZoneManagement from "./admin/ZoneManagement";
import RFIDScannerManagement from "./admin/RFIDScannerManagement";

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: "admin" | "cashier";
  username: string;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userRole: "admin",
  username: "",
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Helper function to safely read saved user session on app start
const getSavedSession = () => {
  const savedUser = localStorage.getItem("user");
  if (savedUser) {
    try {
      return JSON.parse(savedUser);
    } catch (e) {
      console.error("Failed to parse saved user session", e);
    }
  }
  return null;
};

export default function App() {
  const savedSession = getSavedSession();

  // 1. Initialize state dynamically from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!savedSession || !!localStorage.getItem("username");
  });

  const [userRole, setUserRole] = useState<"admin" | "cashier">(() => {
    return savedSession?.role || "admin";
  });

  const [username, setUsername] = useState<string>(() => {
    return savedSession?.username || localStorage.getItem("username") || "";
  });

  // 2. Clear state and storage on logout
  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    setUsername("");
    setUserRole("admin");
  };

  // 3. Update state when logging in
  const handleLogin = (role: "admin" | "cashier", user: string) => {
    setUserRole(role);
    setUsername(user);
    setIsAuthenticated(true);
  };

  const defaultRoute = userRole === "cashier" ? "/cashier" : "/admin";

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, userRole, username, logout }}
    >
      <RefreshProvider>
        <HashRouter>
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to={defaultRoute} replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to={defaultRoute} replace />
                ) : (
                  <Login onLogin={handleLogin} />
                )
              }
            />

            {/* Cashier Layout */}
            <Route element={<Layout role="cashier" username={username} />}>
              <Route path="/cashier" element={<CashierDashboard />} />
              <Route path="/register" element={<CustomerRegistration />} />
              <Route path="/live-monitoring" element={<LiveMonitoring />} />
              <Route path="/zone-monitoring" element={<ZoneMonitoring />} />
              <Route path="/playtime" element={<PlaytimeTracking />} />
              <Route path="/access-validation" element={<AccessValidation />} />
              <Route path="/logs" element={<EntryExitLogs />} />
            </Route>

            {/* Admin Layout */}
            <Route element={<Layout role="admin" username={username} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/packages" element={<PackageManagement />} />
              <Route path="/rfid-management" element={<RFIDManagement />} />
              <Route
                path="/cashier-management"
                element={<CashierManagement />}
              />
              <Route path="/analytics" element={<AnalyticsReports />} />
              <Route path="/zone-management" element={<ZoneManagement />} />
              <Route
                path="/rfid-scanners"
                element={<RFIDScannerManagement />}
              />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </RefreshProvider>
    </AuthContext.Provider>
  );
}
