"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { Loader, XCircle } from "lucide-react";

export default function SiteViewer() {
	const params = useParams();
	const siteId = params?.siteId as string | undefined;

	interface SiteFile {
		name: string;
		url: string;
		size?: number;
		path?: string;
		type?: string;
	}

	interface Site {
		id?: string;
		name?: string;
		siteId?: string;
		ownerId?: string;
		status?: string;
		url?: string;
		storage?: number;
		files?: SiteFile[];
		visits?: number;
		lastDeployed?: string;
	}

	const [loading, setLoading] = useState(true);
	const [site, setSite] = useState<Site | null>(null);
	const [error, setError] = useState<string | null>(null);

	// UI state must be declared unconditionally (avoid declaring after early returns)

	// compute indexFile early so hooks can reference it (it's undefined until site is loaded)
	const indexFile = (site?.files || []).find((f: SiteFile) => {
		const path = (f.path || f.name || "").toString().toLowerCase();
		return path.endsWith("/index.html") || path === "index.html" || path.endsWith("index.html");
	});

	useEffect(() => {
		if (!siteId) return;

		let mounted = true;

		const fetchSite = async () => {
			try {
				const q = query(collection(db!, "sites"), where("siteId", "==", siteId));
				const snap = await getDocs(q);

				if (!mounted) return;

				if (snap.empty) {
					setError("Site not found.");
					setLoading(false);
					return;
				}

				const doc = snap.docs[0];
				const data = { id: doc.id, ...(doc.data() as unknown as Site) } as Site;
				setSite(data);
				setLoading(false);

				// increment visits asynchronously (don't wait)
				try {
					await updateDoc(doc.ref, { visits: (data.visits || 0) + 1 });
				} catch (e) {
					// non-fatal
					console.warn("Failed to increment visits", e);
				}
			} catch (err) {
				console.error(err);
				setError("Failed to load site.");
				setLoading(false);
			}
		};

		fetchSite();

		return () => { mounted = false; };
	}, [siteId]);

	useEffect(() => {
		if (!indexFile || !indexFile.url) return;

		// Redirect to our server-side proxy which will re-serve the site's
		// index.html with proper headers to avoid download behavior.
		try {
			window.location.replace(`/api/proxy/${encodeURIComponent(siteId || '')}`);
		} catch (e) {
			console.warn('Redirect failed', e);
		}
	}, [indexFile, siteId]);

	if (!siteId) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<p className="text-gray-600">Invalid site URL.</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<Loader className="w-10 h-10 text-[#15803D] animate-spin" />
			</div>
		);
	}

	if (error || !site) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
					<XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
					<h3 className="text-lg font-semibold text-gray-900 mb-2">{error || "Site not found"}</h3>
					<p className="text-sm text-gray-600">The site you requested could not be found or is not available.</p>
				</div>
			</div>
		);
	}

	if (site.status !== "live") {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
					<XCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
					<h3 className="text-lg font-semibold text-gray-900 mb-2">Site is not live</h3>
					<p className="text-sm text-gray-600">This site is currently {site.status}. Try again later.</p>
				</div>
			</div>
		);
	}

	if (!indexFile) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
					<XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
					<h3 className="text-lg font-semibold text-gray-900 mb-2">No index.html found</h3>
					<p className="text-sm text-gray-600">This site has no index.html file to render.</p>
				</div>
			</div>
		);
	}
}
