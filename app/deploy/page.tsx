"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  Loader,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Globe,
  ExternalLink,
  Filter,
  Search,
  TrendingUp,
  Activity,
  Package,
  Zap,
  BarChart3,
} from "lucide-react";

type DeploymentStatus = "success" | "failed" | "pending" | "building";

interface Deployment {
  id: string;
  siteName: string;
  siteId: string;
  ownerId: string;
  status: DeploymentStatus;
  timestamp: string;
  duration?: number;
  error?: string;
}

interface Site {
  id: string;
  name: string;
  siteId: string;
  url: string;
  status: string;
}

export default function DeploymentsPage() {
  const { user, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [sites, setSites] = useState<Map<string, Site>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DeploymentStatus>("all");
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    avgDuration: 0,
    successRate: 0,
    last24h: 0,
    deploymentFrequency: [] as { date: string; count: number }[],
  });

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    setLoading(true);

    const fetchData = async () => {
      try {
        const deploymentsQuery = query(
          collection(db!, "deployments"),
          where("ownerId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(100)
        );
        const deploymentsSnap = await getDocs(deploymentsQuery);
        const deploymentsList: Deployment[] = deploymentsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Deployment));

        const sitesQuery = query(
          collection(db!, "sites"),
          where("ownerId", "==", user.uid)
        );
        const sitesSnap = await getDocs(sitesQuery);
        const sitesMap = new Map<string, Site>();
        sitesSnap.docs.forEach((doc) => {
          const siteData = { id: doc.id, ...doc.data() } as Site;
          sitesMap.set(siteData.siteId, siteData);
        });

        const successfulWithDuration = deploymentsList.filter(
          d => d.duration && d.status === "success"
        );
        
        const avgDur = successfulWithDuration.length > 0
          ? successfulWithDuration.reduce((acc, d) => acc + (d.duration || 0), 0) / successfulWithDuration.length
          : 0;

        const statsData = {
          total: deploymentsList.length,
          successful: deploymentsList.filter((d) => d.status === "success").length,
          failed: deploymentsList.filter((d) => d.status === "failed").length,
          pending: deploymentsList.filter(
            (d) => d.status === "pending" || d.status === "building"
          ).length,
          avgDuration: avgDur,
          successRate: deploymentsList.length > 0 
            ? (deploymentsList.filter((d) => d.status === "success").length / deploymentsList.length) * 100
            : 0,
          last24h: deploymentsList.filter(d => {
            const deployTime = new Date(d.timestamp).getTime();
            const now = new Date().getTime();
            return (now - deployTime) < 24 * 60 * 60 * 1000;
          }).length,
          deploymentFrequency: generateDeploymentFrequency(deploymentsList),
        };

        setDeployments(deploymentsList);
        setSites(sitesMap);
        setStats(statsData);
      } catch (err) {
        console.error("Failed to fetch deployments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading]);

  const generateDeploymentFrequency = (deployments: Deployment[]) => {
    const last7Days: { date: string; count: number }[] = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const count = deployments.filter(d => {
        const deployDate = new Date(d.timestamp);
        return deployDate.toDateString() === date.toDateString();
      }).length;
      
      last7Days.push({ date: dateStr, count });
    }
    
    return last7Days;
  };

  const getStatusIcon = (status: DeploymentStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "building":
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: DeploymentStatus) => {
    const styles = {
      success: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
      building: "bg-blue-100 text-blue-700",
      pending: "bg-yellow-100 text-yellow-700",
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          styles[status] || "bg-gray-100 text-gray-700"
        }`}
      >
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDuration = (duration?: number, status?: DeploymentStatus) => {
    if (duration) {
      if (duration < 60) {
        return `${duration}s`;
      }
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    }
    
    if (status === "success") {
      return <span className="text-gray-400">{"< 1s"}</span>;
    }
    
    return <span className="text-gray-400">—</span>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredDeployments = deployments.filter((deployment) => {
    const matchesSearch =
      deployment.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deployment.siteId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      statusFilter === "all" || deployment.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-12 h-12 text-[#15803D] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-600 text-center">Sign in to view your deployments.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Deployments</h1>
              <p className="text-gray-600 mt-1">
                Track all your site deployments and their status
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#15803D]" />
              <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              <span className="text-gray-600">Total</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.last24h} in last 24h</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Successful</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.successful}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.successRate.toFixed(1)}% success rate</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Avg Duration</span>
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {stats.avgDuration < 60 
                ? `${stats.avgDuration.toFixed(1)}s`
                : `${(stats.avgDuration / 60).toFixed(1)}m`}
            </p>
            <p className="text-xs text-gray-500 mt-1">Build time</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Failed</span>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.pending} pending</p>
          </div>
        </div>

        {/* Deployment Frequency Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Deployment Activity</h3>
              <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
            </div>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="flex items-end justify-between gap-2 h-48">
            {stats.deploymentFrequency.map((day, idx) => {
              const maxCount = Math.max(...stats.deploymentFrequency.map(d => d.count), 1);
              const height = (day.count / maxCount) * 100;
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end flex-1">
                    <div
                      className="w-full bg-[#15803D] rounded-t-lg transition-all hover:bg-[#166534] cursor-pointer group relative"
                      style={{ height: `${height}%`, minHeight: day.count > 0 ? '8px' : '0' }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                        {day.count} deployment{day.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{day.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent outline-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="building">Building</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deployments List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredDeployments.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No deployments found
              </h3>
              <p className="text-gray-600">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Deploy your first site to see it here"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Site
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Deployed
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDeployments.map((deployment) => {
                      const site = sites.get(deployment.siteId);
                      return (
                        <tr key={deployment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#15803D]/10 flex items-center justify-center">
                                <Globe className="w-5 h-5 text-[#15803D]" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {deployment.siteName}
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                  {deployment.siteId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(deployment.status)}
                            {deployment.error && (
                              <p className="text-xs text-red-600 mt-1">
                                {deployment.error}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(deployment.timestamp)}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDateTime(deployment.timestamp)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDuration(deployment.duration, deployment.status)}
                          </td>
                          <td className="px-6 py-4">
                            {site && deployment.status === "success" && (
                              <a
                                href={`/sites/${deployment.siteId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#15803D] text-white rounded-lg hover:bg-[#166534] transition text-sm font-medium"
                              >
                                <ExternalLink className="w-4 h-4" />
                                View Site
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {filteredDeployments.map((deployment) => {
                  const site = sites.get(deployment.siteId);
                  return (
                    <div key={deployment.id} className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#15803D]/10 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5 text-[#15803D]" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {deployment.siteName}
                            </div>
                            <div className="text-xs text-gray-500 font-mono truncate">
                              {deployment.siteId}
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(deployment.status)}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDateTime(deployment.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(deployment.duration, deployment.status)}</span>
                        </div>
                        {deployment.error && (
                          <p className="text-xs text-red-600 mt-2">
                            {deployment.error}
                          </p>
                        )}
                      </div>

                      {site && deployment.status === "success" && (
                        <a
                          href={`/sites/${deployment.siteId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-4 py-2 bg-[#15803D] text-white rounded-lg hover:bg-[#166534] transition text-sm font-medium mt-4"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Site
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}