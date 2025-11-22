"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  LayoutDashboard,
  Globe,
  Folder,
  Upload,
  Settings,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Sites", href: "/sites", icon: Globe },
    { name: "File Manager", href: "/files", icon: Folder },
    { name: "Deployments", href: "/deploy", icon: Upload },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // 🔥 Listen for logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // 🚪 Logout
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <Image src="/logo.png" alt="StudentHost" fill className="object-contain" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Student<span className="text-[#15803D]">Host</span>
              </h1>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-[#15803D] rounded-lg transition"
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right side: User */}
          <div className="flex items-center gap-4">
            {/* Show logged-in user */}
            {user && (
              <div className="hidden md:flex items-center gap-3 text-sm">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {user.displayName ?? "Student User"}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="w-10 h-10 bg-[#FCD34D] rounded-full flex items-center justify-center text-[#0F172A] font-bold">
                  {user.displayName
                    ? user.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                    : "ST"}
                </div>
              </div>
            )}

            {/* Mobile menu icon */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Logout button (desktop only) */}
            {user && (
              <button
                onClick={handleLogout}
                className="hidden md:block text-gray-500 hover:text-red-600 transition"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              ))}

              {/* Mobile user info */}
              {user && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-3 px-3 py-3">
                    <UserIcon size={20} />
                    <div>
                      <p className="font-medium">
                        {user.displayName ?? "Student User"}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-red-600 transition px-3 py-2.5 w-full flex items-center gap-2"
                  >
                    <LogOut size={20} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
