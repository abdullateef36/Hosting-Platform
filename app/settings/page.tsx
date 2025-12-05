"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { auth } from "@/lib/firebase";
import {
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  AlertCircle,
  CheckCircle,
  Loader,
  Trash2,
  LogOut,
  Edit,
  Save,
  X,
} from "lucide-react";

export default function SettingsPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      setName(user.displayName || "");
      setEmail(user.email || "");
    }
  }, [user, authLoading]);

  useEffect(() => {
  if (!authLoading && !user) {
    router.push("/login");
  }
}, [authLoading, user, router]);

  const handleUpdateName = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProfile(user, { displayName: name });
      setSuccess("Name updated successfully!");
      setEditingName(false);
    } catch (err) {
      setError((err as Error).message || "Failed to update name.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword || newPassword !== confirmPassword) {
      setError("Passwords don't match or fields are empty.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Reauthenticate
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);
      setSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError((err as Error).message || "Failed to change password. Check current password.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !confirm("This will delete your account and all sites/deployments permanently. Continue?")) return;
    setDeleting(true);
    setError(null);

    try {
      // Delete all sites
      const sitesQuery = query(collection(db!, "sites"), where("ownerId", "==", user.uid));
      const sitesSnap = await getDocs(sitesQuery);
      const deleteSites = sitesSnap.docs.map(async (siteDoc) => {
        // Delete deployments for this site
        const deploymentsQuery = query(
          collection(db!, "deployments"),
          where("siteId", "==", siteDoc.data().siteId)
        );
        const deploymentsSnap = await getDocs(deploymentsQuery);
        await Promise.all(deploymentsSnap.docs.map((depDoc) => deleteDoc(depDoc.ref)));

        // Delete site
        await deleteDoc(siteDoc.ref);
      });
      await Promise.all(deleteSites);

      // Delete user
      await deleteUser(user);
      router.push("/signup");
    } catch (err) {
      setError((err as Error).message || "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth!.signOut();
      router.push("/login");
    } catch (err) {
        console.error("Logout failed:", err);
      setError("Failed to log out.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-12 h-12 text-[#15803D] animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Account Settings</h1>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Profile Section */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#FCD34D] rounded-full flex items-center justify-center text-[#0F172A] font-bold text-2xl">
                  {name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent"
                        placeholder="Your name"
                      />
                      <button
                        onClick={handleUpdateName}
                        disabled={saving}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      >
                        {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-900">{name}</h3>
                      <button
                        onClick={() => setEditingName(true)}
                        className="p-1 text-gray-500 hover:text-[#15803D] rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">Your display name</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                <Mail className="w-6 h-6 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">{email}</p>
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Security</h2>
            <div className="space-y-4 bg-gray-50 p-6 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={saving}
                className="mt-4 px-6 py-3 bg-[#15803D] text-white rounded-lg hover:bg-[#166534] transition flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                Change Password
              </button>
            </div>
          </section>

          {/* Account Actions */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Actions</h2>
            <div className="space-y-4">
              <button
                onClick={handleLogout}
                className="w-full px-6 py-4 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-gray-600" />
                  <span>Sign Out</span>
                </div>
              </button>

              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full px-6 py-4 bg-red-100 text-red-900 rounded-lg hover:bg-red-200 transition flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <span>Delete Account</span>
                </div>
                {deleting && <Loader className="w-5 h-5 animate-spin text-red-600" />}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}