"use client";

import { useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { 
  Globe, HardDrive, Server, Plus, Zap, Activity, Clock, 
  TrendingUp, AlertCircle, CheckCircle, XCircle, Loader,
  Calendar, ExternalLink, BarChart3
} from "lucide-react";
import Link from "next/link";

interface Site {
  id: string;
  name: string;
  status: "live" | "building" | "error" | "paused";
  storage: number;
  lastDeployed?: string;
  url?: string;
  visits?: number;
}

interface Deployment {
  id: string;
  siteName: string;
  status: "success" | "failed" | "building";
  timestamp: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [recentDeployments, setRecentDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStorage, setTotalStorage] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);

  const STORAGE_LIMIT_GB = 10;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const firestore = db;
    if (!firestore) return;

    // Fetch sites
    const sitesQuery = query(
      collection(firestore, "sites"),
      where("ownerId", "==", user.uid)
    );

    const unsubSites = onSnapshot(sitesQuery, (snapshot) => {
      const userSites: Site[] = [];
      let storageSum = 0;
      let visitsSum = 0;

      snapshot.forEach((doc) => {
        const data = doc.data() as Site;
        userSites.push({ ...data, id: doc.id });
        storageSum += data.storage || 0;
        visitsSum += data.visits || 0;
      });

      setSites(userSites);
      setTotalStorage(storageSum);
      setTotalVisits(visitsSum);
      setLoading(false);
    });

    // Fetch recent deployments
    const deploymentsQuery = query(
      collection(firestore, "deployments"),
      where("ownerId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsubDeployments = onSnapshot(deploymentsQuery, (snapshot) => {
      const deploys: Deployment[] = [];
      snapshot.forEach((doc) => {
        deploys.push({ ...doc.data(), id: doc.id } as Deployment);
      });
      setRecentDeployments(deploys);
    });

    return () => {
      unsubSites();
      unsubDeployments();
    };
  }, [user]);

  const totalSites = sites.length;
  const liveSites = sites.filter(s => s.status === "live").length;
  const errorSites = sites.filter(s => s.status === "error").length;
  const buildingSites = sites.filter(s => s.status === "building").length;
  const storageUsedGB = (totalStorage / 1024).toFixed(2);
  const storagePercentage = Math.min((totalStorage / (STORAGE_LIMIT_GB * 1024)) * 100, 100);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "building": return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case "error": return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (!user) {
    return <div className="p-6 text-center">Please sign in to view your dashboard.</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, <span className="text-[#15803D]">{user.displayName || "Builder"}</span>!
            </h1>
            <p className="text-gray-600 mt-2">Here&apos;s what&apos;s happening with your projects today.</p>
          </div>
          <Link
            href="/sites/new"
            className="mt-6 sm:mt-0 inline-flex items-center gap-3 px-6 py-3 bg-[#15803D] text-white font-medium rounded-xl shadow-lg hover:bg-[#156e35] transform hover:scale-105 transition-all duration-200"
          >
            <Plus size={20} />
            Deploy New Site
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {/* Total Sites */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                {loading ? (
                  <p className="text-3xl font-bold text-gray-400 mt-2">—</p>
                ) : (
                  <p className="text-4xl font-bold text-gray-900 mt-2">{totalSites}</p>
                )}
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Globe className="w-8 h-8 text-[#15803D]" />
              </div>
            </div>
          </div>

          {/* Live Sites */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Live & Running</p>
                {loading ? (
                  <p className="text-3xl font-bold text-gray-400 mt-2">—</p>
                ) : (
                  <p className="text-4xl font-bold text-[#15803D] mt-2">{liveSites}</p>
                )}
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Zap className="w-8 h-8 text-[#15803D]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-600 font-medium">
                {errorSites > 0 ? `${errorSites} need attention` : "All systems operational"}
              </span>
            </div>
          </div>

          {/* Total Visits */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Visits</p>
                {loading ? (
                  <p className="text-3xl font-bold text-gray-400 mt-2">—</p>
                ) : (
                  <p className="text-4xl font-bold text-gray-900 mt-2">{totalVisits.toLocaleString()}</p>
                )}
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Across all sites</span>
            </div>
          </div>

          {/* Storage Used */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Storage Used</p>
                {loading ? (
                  <p className="text-3xl font-bold text-gray-400 mt-2">—</p>
                ) : (
                  <>
                    <p className="text-4xl font-bold text-gray-900 mt-2">{storageUsedGB} GB</p>
                    <p className="text-xs text-gray-500 mt-1">of {STORAGE_LIMIT_GB} GB</p>
                  </>
                )}
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <HardDrive className="w-8 h-8 text-[#FBBF24]" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ${
                    storagePercentage > 90 ? "bg-red-500" : storagePercentage > 70 ? "bg-yellow-500" : "bg-[#15803D]"
                  }`}
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          
          {/* Recent Sites - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Sites</h2>
              <Link href="/sites" className="text-sm text-[#15803D] hover:underline font-medium">
                View All
              </Link>
            </div>
            
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading sites...</div>
            ) : sites.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No sites yet. Ready to deploy your first project?</p>
                <Link
                  href="/sites/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#15803D] text-white rounded-lg hover:bg-[#156e35] transition"
                >
                  <Plus size={16} />
                  Create Site
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {sites.slice(0, 5).map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-[#15803D] hover:bg-green-50/50 transition group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getStatusIcon(site.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-[#15803D] transition">
                          {site.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(site.lastDeployed)}
                          </span>
                          <span>{(site.storage / 1024).toFixed(2)} GB</span>
                          {site.visits && <span>{site.visits} visits</span>}
                        </div>
                      </div>
                    </div>
                    {site.url && site.status === "live" && (
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-[#15803D] transition"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Server Status */}
            <div className="bg-linear-to-br from-[#15803D] to-[#156e35] rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">Server Status</p>
                  <p className="text-3xl font-bold mt-2">Online</p>
                  <p className="text-xs mt-2 opacity-80 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Uptime: 99.98%
                  </p>
                </div>
                <Server className="w-10 h-10 opacity-90" />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Deployments</h3>
              {recentDeployments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No deployments yet</p>
              ) : (
                <div className="space-y-3">
                  {recentDeployments.map((deploy) => (
                    <div key={deploy.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5">
                        {deploy.status === "success" && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {deploy.status === "failed" && <XCircle className="w-4 h-4 text-red-600" />}
                        {deploy.status === "building" && <Loader className="w-4 h-4 text-blue-600 animate-spin" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{deploy.siteName}</p>
                        <p className="text-xs text-gray-500">{formatDate(deploy.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            {buildingSites > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {buildingSites} {buildingSites === 1 ? "site" : "sites"} building
                    </p>
                    <p className="text-xs text-blue-700">Check back in a few minutes</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Motivation Banner */}
        <div className="mt-8 bg-linear-to-r from-[#15803D] to-green-600 text-white rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 backdrop-blur rounded-xl">
              <Zap className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Keep building amazing things!</h3>
              <p className="mt-1 opacity-90">
                {totalSites === 0
                  ? "Your first site is just one click away. Let's get started!"
                  : `You're managing ${totalSites} ${totalSites === 1 ? "project" : "projects"} with ${totalVisits} total visits — proud of you!`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}