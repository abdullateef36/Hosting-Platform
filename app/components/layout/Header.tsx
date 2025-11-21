"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, LayoutDashboard, Globe, Folder, Upload, Settings, LogOut, User } from "lucide-react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Sites", href: "/sites", icon: Globe },
    { name: "File Manager", href: "/files", icon: Folder },
    { name: "Deployments", href: "/deploy", icon: Upload },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <Image
                  src="/logo.png"
                  alt="StudentHost"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Student<span className="text-[#15803D]">Host</span>
                </h1>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
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

          {/* Right Side - User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 text-sm">
              <div className="text-right">
                <p className="font-semibold text-gray-900">John Doe</p>
                <p className="text-xs text-gray-500">student@school.edu.ng</p>
              </div>
              <div className="w-10 h-10 bg-[#FCD34D] rounded-full flex items-center justify-center text-[#0F172A] font-bold">
                JD
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Logout */}
            <button className="hidden md:block text-gray-500 hover:text-red-600 transition">
              <LogOut size={20} />
            </button>
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
              <div className="pt-4 border-t">
                <div className="flex items-center gap-3 px-3 py-3">
                  <User size={20} />
                  <div>
                    <p className="font-medium">John Doe</p>
                    <p className="text-xs text-gray-500">student@school.edu.ng</p>
                  </div>
                </div>
                <button className="flex items-center gap-3 w-full px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg">
                  <LogOut size={20} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}