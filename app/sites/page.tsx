"use client";

import { useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDocs  } from "firebase/firestore";
import { 
  Globe, Trash2, ExternalLink, Search, Plus, 
  CheckCircle, XCircle, Loader, Calendar, HardDrive,
  Eye, Pause, Play
} from "lucide-react";
import Link from "next/link";

interface Site {
  id: string;
  name: string;
  siteId: string;
  status: "live" | "building" | "error" | "paused";
  storage: number;
  lastDeployed?: string;
  url: string;
  visits: number;
  files: { name: string; url: string; path: string; type: string }[];
}

export default function MySites() {
  const { user } = useUser();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "paused" | "error">("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db!, "sites"),
      where("ownerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userSites: Site[] = [];
      snapshot.forEach((doc) => {
        userSites.push({ id: doc.id, ...doc.data() } as Site);
      });
      
      // Sort by most recent first
      userSites.sort((a, b) => {
        const dateA = new Date(a.lastDeployed || 0).getTime();
        const dateB = new Date(b.lastDeployed || 0).getTime();
        return dateB - dateA;
      });

      setSites(userSites);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const deleteSiteDeployments = async (siteId: string) => {
  const deploymentsRef = collection(db!, "deployments");
  const q = query(deploymentsRef, where("siteId", "==", siteId));

  const results = await getDocs(q);

  const promises: Promise<void>[] = [];

  results.forEach((docSnap) => {
    promises.push(deleteDoc(doc(db!, "deployments", docSnap.id)));
  });

  await Promise.all(promises);
};

  const handleDelete = async (site: Site) => {
  if (!confirm(`Are you sure you want to delete "${site.name}"? This action cannot be undone.`)) {
    return;
  }

  setDeleting(site.id);

  try {

    // 1️⃣ DELETE ALL DEPLOYMENTS FIRST
    await deleteSiteDeployments(site.siteId);

    // 2️⃣ THEN DELETE THE SITE ITSELF
    await deleteDoc(doc(db!, "sites", site.id));

    setDeleting(null);
  } catch (err) {
    console.error("Error deleting site:", err);
    alert("Failed to delete site. Please try again.");
    setDeleting(null);
  }
};

  const toggleSiteStatus = async (site: Site) => {
    const newStatus = site.status === "live" ? "paused" : "live";
    
    try {
      await updateDoc(doc(db!, "sites", site.id), {
        status: newStatus
      });
    } catch (err) {
      console.error("Error updating site status:", err);
      alert("Failed to update site status.");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Live
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            <Pause className="w-3 h-3" />
            Paused
          </span>
        );
      case "building":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <Loader className="w-3 h-3 animate-spin" />
            Building
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || site.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Please sign in to view your sites.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Sites</h1>
            <p className="text-gray-600 mt-2">
              {loading ? "Loading..." : `${sites.length} total ${sites.length === 1 ? "site" : "sites"}`}
            </p>
          </div>
          <Link
            href="/sites/new"
            className="mt-6 sm:mt-0 inline-flex items-center gap-3 px-6 py-3 bg-[#15803D] text-white font-medium rounded-xl shadow-lg hover:bg-[#156e35] transform hover:scale-105 transition-all duration-200"
          >
            <Plus size={20} />
            Deploy New Site
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {["all", "live", "paused", "error"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status as typeof filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize
                    ${filter === status
                      ? "bg-[#15803D] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }
                  `}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sites Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader className="w-12 h-12 text-[#15803D] animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your sites...</p>
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || filter !== "all" ? "No sites found" : "No sites yet"}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filter !== "all"
                ? "Try adjusting your search or filters"
                : "Deploy your first site to get started!"}
            </p>
            {!searchQuery && filter === "all" && (
              <Link
                href="/sites/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#15803D] text-white rounded-lg hover:bg-[#156e35] transition"
              >
                <Plus size={18} />
                Deploy First Site
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group"
              >
                
                {/* Status Badge */}
                <div className="flex items-start justify-between mb-4">
                  {getStatusBadge(site.status)}
                  <button
                    onClick={() => handleDelete(site)}
                    disabled={deleting === site.id}
                    className="text-gray-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50"
                  >
                    {deleting === site.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Site Info */}
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#15803D] transition">
                  {site.name}
                </h3>

                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(site.lastDeployed)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    <span>{(site.storage).toFixed(2)} MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>{site.visits} visits</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  {site.status === "live" && (
                    <a
                      href={`/sites/${site.siteId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#15803D] text-white rounded-lg hover:bg-[#156e35] transition text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Site
                    </a>
                  )}
                  
                  <button
                    onClick={() => toggleSiteStatus(site)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    {site.status === "live" ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Resume
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}