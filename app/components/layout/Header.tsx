"use client";

import { useState } from "react";
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
  // User as UserIcon,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { useUser } from "@/context/UserContext";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useUser(); // <-- comes from context
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "My Sites", href: "/sites", icon: Globe },
    { name: "File Manager", href: "/files", icon: Folder },
    { name: "Deployments", href: "/deploy", icon: Upload },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    if (!auth) {
      localStorage.removeItem("authUser");
      router.push("/login");
      return;
    }

    await signOut(auth);
    localStorage.removeItem("authUser");
    router.push("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative w-10 h-10">
              <Image src="/logo.png" alt="StudentHost" fill className="object-contain" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Student<span className="text-[#15803D]">Host</span>
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition
                    ${active ? "bg-[#15803D] text-white" : "text-gray-700 hover:bg-gray-100 hover:text-[#15803D]"}
                  `}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-4">
            {!loading && user && (
              <div className="hidden md:flex items-center gap-3 text-sm">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {user.displayName ?? "Student User"}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="w-10 h-10 bg-[#FCD34D] rounded-full flex items-center justify-center text-[#0F172A] font-bold">
                  {user.displayName
                    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase()
                    : "ST"}
                </div>
              </div>
            )}

            {/* Auth Links (when not logged in) */}
            {!loading && !user && (
              <Link
                href="/signup"
                className="hidden md:block px-4 py-2.5 text-sm font-medium bg-[#15803D] text-white rounded-lg hover:bg-[#138233] transition"
              >
                Sign Up
              </Link>
            )}

            {/* Mobile menu */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Logout (desktop) */}
            {!loading && user && (
              <button
                onClick={handleLogout}
                className="hidden md:block text-gray-500 hover:text-red-600 transition"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            {/* Authenticated user menu */}
            {!loading && user && (
              <>
                <div className="px-4 py-3 border-b border-gray-200 mb-4">
                  <p className="font-semibold text-gray-900">
                    {user.displayName ?? "Student User"}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <nav className="flex flex-col space-y-2">
                  {navItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition
                          ${active ? "bg-[#15803D] text-white" : "text-gray-700 hover:bg-gray-100"}
                        `}
                      >
                        <item.icon size={18} />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
                <button
                  onClick={handleLogout}
                  className="w-full mt-4 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </>
            )}

            {/* Unauthenticated user menu */}
            {!loading && !user && (
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2 text-sm font-medium bg-[#15803D] text-white rounded-lg hover:bg-[#138233] transition block w-full text-center"
              >
                Sign Up
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
