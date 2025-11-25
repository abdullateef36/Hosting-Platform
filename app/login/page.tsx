"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Image from "next/image";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
        if (!auth) {
          alert("Authentication is not available right now. Please try again in a moment.");
          setLoading(false);
          return;
        }

        await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Login failed");
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 via-yellow-50 to-green-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
                <div className="text-center mb-8">
                <div className="inline-block p-4 bg-linear-to-br from-yellow-400 to-green-500 rounded-3xl shadow-lg mb-4">
                    <div className="relative w-16 h-16 bg-white rounded-full">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        fill
                        className="object-contain p-2"
                    />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Sign In</h1>
                <p className="text-gray-600">Welcome Back</p>
                </div>
        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-3xl shadow-2xl space-y-6 border border-gray-100"
        >
          {/* Email Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-green-700 focus:outline-none transition-colors text-gray-800"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:border-green-700 focus:outline-none transition-colors text-gray-800"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-green-700 to-green-800 text-white py-4 rounded-xl font-bold text-lg hover:from-green-800 hover:to-green-900 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing in...
              </span>
            ) : (
              "Log In"
            )}
          </button>

          {/* Signup Link */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-gray-600">
              Don’t have an account?{" "}
              <a
                href="/signup"
                className="text-green-700 font-bold hover:text-green-800 transition-colors"
              >
                Sign Up
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}