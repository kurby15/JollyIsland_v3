import { useState, useEffect, useMemo } from "react";
import Modal from "../components/Modal";
import {
  Users,
  Plus,
  Edit,
  UserX,
  CheckCircle,
  Shield,
  UserCheck,
  Loader2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { addNotification } from "../store/notificationStore";
import { toast } from "sonner";
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: "admin" | "cashier";
  status: "active" | "inactive";
  lastLogin?: string | Timestamp;
  createdAt?: Timestamp;
}

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const emptyForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "cashier" as "admin" | "cashier",
  status: "active" as "active" | "inactive",
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "Cashier">(
    "All",
  );
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  // Read: Real-time listener for Firestore users collection
  useEffect(() => {
    setLoadingUsers(true);
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const fetchedUsers: User[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          // Safely format lastLogin string display from Firestore Timestamp or string
          let formattedLastLogin = "Never";
          if (data.lastLogin) {
            if (typeof data.lastLogin === "string") {
              formattedLastLogin = data.lastLogin;
            } else if (data.lastLogin instanceof Timestamp) {
              formattedLastLogin = data.lastLogin.toDate().toLocaleString();
            } else if (typeof data.lastLogin.toDate === "function") {
              formattedLastLogin = data.lastLogin.toDate().toLocaleString();
            }
          }

          return {
            id: docSnap.id,
            name: data.name || "",
            username: data.username || "",
            email: data.email || "",
            role: (data.role?.toLowerCase() === "admin"
              ? "admin"
              : "cashier") as "admin" | "cashier",
            status: data.status || "active",
            lastLogin: formattedLastLogin,
            passwordHash: data.passwordHash,
            createdAt: data.createdAt,
          };
        });

        setUsers(fetchedUsers);
        setLoadingUsers(false);
      },
      (error) => {
        console.error("Firestore read error:", error);
        toast.error("Failed to load users from Firestore");
        setLoadingUsers(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "All") return users;
    const filterRole = roleFilter.toLowerCase();
    return users.filter((user) => user.role === filterRole);
  }, [users, roleFilter]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setSaved(false);
    setShowPw(false);
    setShowConfirm(false);
    setChangePassword(false);
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setForm({
      name: u.name,
      username: u.username,
      email: u.email || "",
      password: "",
      confirmPassword: "",
      role: u.role,
      status: u.status,
    });
    setEditId(u.id);
    setSaved(false);
    setShowPw(false);
    setShowConfirm(false);
    setChangePassword(false);
    setShowForm(true);
  };

  const passwordMismatch = form.password !== form.confirmPassword;
  const canSave =
    form.name.trim() &&
    form.username.trim() &&
    (editId
      ? !changePassword || (form.password.length >= 6 && !passwordMismatch)
      : form.password.length >= 6 && !passwordMismatch);

  // Create & Update Operations
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    const displayRole = form.role === "admin" ? "Admin" : "Cashier";

    try {
      if (editId) {
        // Update User
        const userRef = doc(db, "users", editId);
        const updateData: Record<string, any> = {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          email:
            form.email.trim().toLowerCase() ||
            `${form.username.trim().toLowerCase()}@gmail.com`,
          role: form.role,
          status: form.status,
        };

        if (changePassword && form.password) {
          updateData.passwordHash = await hashPassword(form.password);
        }

        await updateDoc(userRef, updateData);

        addNotification({
          type: "success",
          title: "User Updated",
          message: `${form.name} (${displayRole}) account has been updated.`,
          role: "admin",
        });
        toast.success(`${form.name} updated`, {
          description: `Role: ${displayRole} · Status: ${form.status}${changePassword ? " · Password changed" : ""}`,
        });
      } else {
        // Create User
        const passwordHash = await hashPassword(form.password);
        const newUserDoc = {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          email:
            form.email.trim().toLowerCase() ||
            `${form.username.trim().toLowerCase()}@gmail.com`,
          passwordHash,
          role: form.role,
          status: form.status,
          createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "users"), newUserDoc);

        addNotification({
          type: "success",
          title: "User Added",
          message: `${form.name} added as ${displayRole} (${docRef.id}).`,
          role: "admin",
        });
        toast.success(`${form.name} added`, {
          description: `${displayRole} account created`,
        });
      }

      setSaved(true);
    } catch (err) {
      console.error("Firestore save error:", err);
      toast.error("Failed to save user details.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Operation
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const displayRole = deleteTarget.role === "admin" ? "Admin" : "Cashier";

    try {
      await deleteDoc(doc(db, "users", deleteTarget.id));

      addNotification({
        type: "error",
        title: "User Removed",
        message: `${deleteTarget.name} (${displayRole}) has been removed from the system.`,
        role: "admin",
      });
      toast.error(`${deleteTarget.name} removed`, {
        description: `${displayRole} account deleted`,
      });

      setDeleteTarget(null);
    } catch (err) {
      console.error("Firestore delete error:", err);
      toast.error("Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-dark-slate mb-2 text-2xl font-bold">
              User Management
            </h1>
            <p className="text-gray">
              Manage admin and cashier accounts, roles, and permissions
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Filter Tabs */}
            <div className="flex bg-light-gray p-1 rounded-xl border border-gray/10">
              {(["All", "Admin", "Cashier"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    roleFilter === role
                      ? "bg-white text-dark-slate shadow-sm"
                      : "text-gray hover:text-dark-slate"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            <button
              onClick={openAdd}
              className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" /> Add User
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray/10 p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray/20">
                  {[
                    "Name",
                    "Username",
                    "Role",
                    "Status",
                    "Last Login",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-gray font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-ocean-blue" />
                        <span>Loading Firestore users...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const displayRole =
                      user.role === "admin" ? "Admin" : "Cashier";
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-gray/10 hover:bg-light-gray transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
                                user.role === "admin"
                                  ? "bg-gradient-to-br from-purple-600 to-indigo-500"
                                  : "bg-gradient-to-br from-ocean-blue to-sky-blue"
                              }`}
                            >
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </div>
                            <span className="text-dark-slate font-medium">
                              {user.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray">{user.username}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                              user.role === "admin"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-ocean-blue/10 text-ocean-blue"
                            }`}
                          >
                            {user.role === "admin" ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <UserCheck className="w-3 h-3" />
                            )}
                            {displayRole}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              user.status === "active"
                                ? "bg-success/10 text-success"
                                : "bg-gray/10 text-gray"
                            }`}
                          >
                            {user.status.charAt(0).toUpperCase() +
                              user.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray text-sm">
                          {typeof user.lastLogin === "string"
                            ? user.lastLogin
                            : "Never"}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEdit(user)}
                              className="p-2 text-ocean-blue hover:bg-ocean-blue/10 rounded-lg transition-all"
                              title="Edit User"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(user)}
                              className="p-2 text-error hover:bg-error/10 rounded-lg transition-all"
                              title="Remove User"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray">
                      No users found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <Modal
          title={
            editId
              ? `Edit ${form.role === "admin" ? "Admin" : "Cashier"}`
              : `Add New ${form.role === "admin" ? "Admin" : "Cashier"}`
          }
          onClose={() => setShowForm(false)}
        >
          {!saved ? (
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Full Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                  placeholder="e.g. Juan dela Cruz"
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Username
                </label>
                <input
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                  placeholder="e.g. jdelacruz"
                />
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Email (Gmail)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                  placeholder="e.g. jdelacruz@gmail.com"
                />
              </div>

              {/* Password — required on Add, optional toggle on Edit */}
              {editId ? (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePassword((v) => !v);
                      setForm((f) => ({
                        ...f,
                        password: "",
                        confirmPassword: "",
                      }));
                      setShowPw(false);
                      setShowConfirm(false);
                    }}
                    className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-all ${
                      changePassword
                        ? "bg-ocean-blue/10 text-ocean-blue"
                        : "text-gray hover:bg-light-gray"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {changePassword
                      ? "Cancel password change"
                      : "Change password"}
                  </button>
                  {changePassword && (
                    <div className="mt-3 space-y-3 p-4 bg-light-gray/60 rounded-xl border border-gray/10">
                      <div>
                        <label className="block mb-1 text-gray text-sm font-medium">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPw ? "text" : "password"}
                            value={form.password}
                            onChange={(e) =>
                              setForm({ ...form, password: e.target.value })
                            }
                            className="w-full px-4 py-3 pr-11 bg-white border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                            placeholder="Min. 6 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark-slate transition-colors"
                          >
                            {showPw ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray text-sm font-medium">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirm ? "text" : "password"}
                            value={form.confirmPassword}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                confirmPassword: e.target.value,
                              })
                            }
                            className={`w-full px-4 py-3 pr-11 bg-white border-2 rounded-xl focus:outline-none transition-colors ${
                              form.confirmPassword && passwordMismatch
                                ? "border-error"
                                : "border-transparent focus:border-ocean-blue"
                            }`}
                            placeholder="Re-enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark-slate transition-colors"
                          >
                            {showConfirm ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {form.confirmPassword && passwordMismatch && (
                          <p className="text-error text-xs mt-1">
                            Passwords do not match
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 text-gray text-sm font-medium">
                      Password <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        className="w-full px-4 py-3 pr-11 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                        placeholder="Min. 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark-slate transition-colors"
                      >
                        {showPw ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {form.password && form.password.length < 6 && (
                      <p className="text-warning text-xs mt-1">
                        Password must be at least 6 characters
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block mb-1 text-gray text-sm font-medium">
                      Confirm Password <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) =>
                          setForm({ ...form, confirmPassword: e.target.value })
                        }
                        className={`w-full px-4 py-3 pr-11 bg-light-gray border-2 rounded-xl focus:outline-none transition-colors ${
                          form.confirmPassword && passwordMismatch
                            ? "border-error"
                            : "border-transparent focus:border-ocean-blue"
                        }`}
                        placeholder="Re-enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-dark-slate transition-colors"
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {form.confirmPassword && passwordMismatch && (
                      <p className="text-error text-xs mt-1">
                        Passwords do not match
                      </p>
                    )}
                    {form.password &&
                      form.confirmPassword &&
                      !passwordMismatch && (
                        <p className="text-success text-xs mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Passwords match
                        </p>
                      )}
                  </div>
                </div>
              )}

              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as "admin" | "cashier",
                    })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-gray text-sm font-medium">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as "active" | "inactive",
                    })
                  }
                  className="w-full px-4 py-3 bg-light-gray border-2 border-transparent rounded-xl focus:border-ocean-blue focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="flex-1 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : editId ? (
                    "Save Changes"
                  ) : (
                    `Add ${form.role === "admin" ? "Admin" : "Cashier"}`
                  )}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all font-medium"
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
              <h4 className="text-dark-slate mb-2 font-bold text-lg">
                {editId
                  ? "Changes Saved!"
                  : `${form.role === "admin" ? "Admin" : "Cashier"} Added!`}
              </h4>
              <p className="text-gray mb-6">
                <strong>{form.name}</strong> has been{" "}
                {editId ? "updated" : "added"} as a{" "}
                <strong>{form.role === "admin" ? "Admin" : "Cashier"}</strong>{" "}
                successfully.
              </p>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-3 bg-gradient-to-r from-ocean-blue to-sky-blue text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                Done
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          title={`Remove ${deleteTarget.role === "admin" ? "Admin" : "Cashier"}`}
          onClose={() => setDeleteTarget(null)}
          size="sm"
        >
          <p className="text-gray mb-6">
            Are you sure you want to remove{" "}
            <strong className="text-dark-slate">{deleteTarget.name}</strong> (
            {deleteTarget.role === "admin" ? "Admin" : "Cashier"})? This action
            cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-error text-white rounded-xl hover:bg-red-600 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Removing…
                </>
              ) : (
                "Remove"
              )}
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-3 border-2 border-gray/30 text-gray rounded-xl hover:bg-gray/10 transition-all font-medium"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
