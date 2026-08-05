import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import bgImage from "../../imports/image.png";
import { db } from "../../firebase";

type UserRole = "admin" | "cashier";

interface FirestoreUserDoc {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Timestamp;
}

interface LoginProps {
  onLogin: (role: UserRole, username: string) => void;
}

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedIdentifier = loginIdentifier.trim().toLowerCase();
      const usersRef = collection(db, "users");

      // Query by username first
      const usernameQuery = query(
        usersRef,
        where("username", "==", normalizedIdentifier),
      );
      let querySnapshot = await getDocs(usernameQuery);

      // If not found by username, query by email
      if (querySnapshot.empty) {
        const emailQuery = query(
          usersRef,
          where("email", "==", normalizedIdentifier),
        );
        querySnapshot = await getDocs(emailQuery);
      }

      if (querySnapshot.empty) {
        setError("No matching account was found.");
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as FirestoreUserDoc;

      // Optional: Check status if your documents have a status field
      if ((userData as any).status === "inactive") {
        setError("Your account has been deactivated.");
        setLoading(false);
        return;
      }

      const submittedHash = await hashPassword(password);

      if (submittedHash !== userData.passwordHash) {
        setError("Invalid password.");
        setLoading(false);
        return;
      }

      // Update `lastLogin` timestamp in Firestore for UserManagement tracking
      const userRef = doc(db, "users", userDoc.id);
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
      });

      // Save complete user session to localStorage for reload persistence
      const userSession = {
        username: userData.username,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };
      localStorage.setItem("user", JSON.stringify(userSession));
      localStorage.setItem("username", userData.username);

      onLogin(userData.role, userData.username);
      navigate(userData.role === "admin" ? "/admin" : "/cashier");
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during sign-in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12">
        <div className="text-white text-center max-w-lg">
          <div className="mb-8">
            <h1 className="mb-4 text-white">Welcome to JollyIsland</h1>
            <p className="text-xl text-white/90">
              RFID-Based Customer Activity Monitoring
            </p>
            <p className="text-lg text-white/80 mt-2">
              Indoor Play Center Management System
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-sm">
            <div className="text-center mb-8">
              <h2 className="text-dark-slate mb-2">Sign In</h2>
              <p className="text-gray">Access your management dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="loginIdentifier"
                  className="block mb-2 text-dark-slate"
                >
                  Username or Gmail
                </label>
                <input
                  id="loginIdentifier"
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors"
                  placeholder="Enter your username or Gmail"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block mb-2 text-dark-slate"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none transition-colors pr-12"
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-ocean-blue transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] bg-gradient-to-r from-ocean-blue to-sky-blue disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray/20 text-center">
              <p className="text-gray">JollyIsland Management System v1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
