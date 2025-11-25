"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc as firestoreDoc,
} from "firebase/firestore";
import { Loader, Upload, Trash2, Download, Edit, X, Save, Eye, Code, ChevronDown } from "lucide-react";

type SiteFile = {
  name: string;
  url: string;
  size?: number;
  path?: string;
  type?: string;
  public_id?: string;
  resource_type?: string;
};

type Site = {
  id: string;
  name?: string;
  siteId: string;
  ownerId: string;
  files?: SiteFile[];
  storage?: number;
  status?: string;
};

export default function FilesPage() {
  const { user, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteIndex, setSelectedSiteIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingFile, setEditingFile] = useState<{ siteIndex: number; fileIndex: number; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSaveFile = useCallback(async () => {
    if (!editingFile) return;
    setSavingFile(true);
    setError(null);

    try {
      const site = sites[editingFile.siteIndex];
      const file = site.files![editingFile.fileIndex];
      const blob = new Blob([editingFile.content], { type: file.type || 'text/plain' });
      const newFile = new File([blob], file.name, { type: file.type || 'text/plain' });

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Cloudinary not configured.");

      const formData = new FormData();
      formData.append("file", newFile);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", `sites/${site.siteId}`);
      if (file.public_id) formData.append("public_id", file.public_id);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || "Upload failed");

      const updatedFiles = [...(site.files || [])];
      updatedFiles[editingFile.fileIndex] = { ...file, url: data.secure_url, size: newFile.size };

      const totalStorageBytes = updatedFiles.reduce((s: number, f: SiteFile) => s + (f.size || 0), 0);
      const storageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));

      const siteRef = firestoreDoc(db!, "sites", site.id);
      await updateDoc(siteRef, { files: updatedFiles, storage: storageMB });

      const newSites = sites.slice();
      newSites[editingFile.siteIndex] = { ...site, files: updatedFiles, storage: storageMB };
      setSites(newSites);
      setEditingFile(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingFile(false);
    }
  }, [editingFile, sites]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editingFile) {
        e.preventDefault();
        handleSaveFile();
      }
    };
    if (editingFile) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingFile, handleSaveFile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const fetchSites = async () => {
      try {
        const q = query(collection(db!, "sites"), where("ownerId", "==", user!.uid));
        const snap = await getDocs(q);
        if (!mounted) return;
        const items: Site[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Site));
        setSites(items);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to load your sites.");
        setLoading(false);
      }
    };
    fetchSites();
    return () => { mounted = false; };
  }, [user, authLoading]);

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes || bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSelectSite = (index: number) => {
    setSelectedSiteIndex(index === selectedSiteIndex ? null : index);
    setMobileSidebarOpen(false);
  };

  const handleDownload = (file: SiteFile) => window.open(file.url, "_blank");

  const handleDelete = async (siteIndex: number, fileIndex: number) => {
    const site = sites[siteIndex];
    const file: SiteFile = site.files![fileIndex];
    if (!confirm(`Delete ${file.name}? This will remove it from the site listing.`)) return;

    try {
      const updatedFiles = (site.files || []).slice();
      updatedFiles.splice(fileIndex, 1);
      const totalStorageBytes = updatedFiles.reduce((s: number, f: SiteFile) => s + (f.size || 0), 0);
      const storageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));

      const siteRef = firestoreDoc(db!, "sites", site.id);
      await updateDoc(siteRef, { files: updatedFiles, storage: storageMB });

      const newSites = sites.slice();
      newSites[siteIndex] = { ...site, files: updatedFiles, storage: storageMB };
      setSites(newSites);
    } catch (err) {
      console.error(err);
      setError("Failed to delete file.");
    }
  };

  const handleUploadClick = (index: number) => {
    setSelectedSiteIndex(index);
    fileInputRef.current?.click();
  };

  const handleEditFile = async (siteIndex: number, fileIndex: number) => {
    const site = sites[siteIndex];
    const file = site.files![fileIndex];
    const editableTypes = ['html', 'css', 'js', 'json', 'txt', 'xml', 'svg'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!editableTypes.includes(fileExt)) {
      setError("This file type cannot be edited in the browser.");
      return;
    }

    try {
      const response = await fetch(file.url);
      const content = await response.text();
      setEditingFile({ siteIndex, fileIndex, content });
      setPreviewMode(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load file for editing.");
    }
  };

  const getFileLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'html': 'html', 'css': 'css', 'js': 'javascript', 'json': 'json',
      'xml': 'xml', 'svg': 'xml', 'txt': 'plaintext'
    };
    return langMap[ext] || 'plaintext';
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || selectedSiteIndex === null) return;
    const files = Array.from(e.target.files);
    const site = sites[selectedSiteIndex];
    if (!site) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Cloudinary not configured.");

      const uploadedFiles: SiteFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const formData = new FormData();
        formData.append("file", f);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", `sites/${site.siteId}`);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message || "Upload failed");

        uploadedFiles.push({
          name: f.name,
          url: data.secure_url,
          size: f.size,
          path: f.name,
          type: f.type || "application/octet-stream",
          public_id: data.public_id,
          resource_type: data.resource_type || "raw",
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      const merged = [...(site.files || []), ...uploadedFiles];
      const totalStorageBytes = merged.reduce((s: number, f: SiteFile) => s + (f.size || 0), 0);
      const storageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));

      const siteRef = firestoreDoc(db!, "sites", site.id);
      await updateDoc(siteRef, { files: merged, storage: storageMB });

      const newSites = sites.slice();
      newSites[selectedSiteIndex] = { ...site, files: merged, storage: storageMB };
      setSites(newSites);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        <p className="text-gray-600 text-center">Sign in to manage your files.</p>
      </div>
    );
  }

  const selectedSite = selectedSiteIndex !== null ? sites[selectedSiteIndex] : null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">File Manager</h1>
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
          </button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar + Mobile Dropdown */}
          <aside className="w-full lg:w-80 shrink-0">
            {/* Mobile: Dropdown */}
            <div className="lg:hidden mb-4">
              <div className="relative">
                <select
                  value={selectedSiteIndex ?? ""}
                  onChange={(e) => {
                    const idx = e.target.value === "" ? null : Number(e.target.value);
                    setSelectedSiteIndex(idx);
                  }}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#15803D] focus:border-[#15803D]"
                >
                  <option value="">Select a site...</option>
                  {sites.map((s, i) => (
                    <option key={s.id} value={i}>
                      {s.name || s.siteId} ({s.files?.length || 0} files)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-lg mb-4">Your Sites</h3>
              {sites.length === 0 ? (
                <p className="text-sm text-gray-500">No sites yet.</p>
              ) : (
                <ul className="space-y-2">
                  {sites.map((s, i) => (
                    <li key={s.id}>
                      <button
                        onClick={() => handleSelectSite(i)}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          selectedSiteIndex === i
                            ? "bg-[#15803D]/5 border-2 border-[#15803D]"
                            : "hover:bg-gray-50 border-2 border-transparent"
                        }`}
                      >
                        <div className="font-medium text-gray-900 truncate">{s.name || s.siteId}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {s.files?.length || 0} files • {s.storage ? `${s.storage} MB` : "0 MB"}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {selectedSite ? (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedSite.name || selectedSite.siteId}</h2>
                      <p className="text-sm text-gray-500">{selectedSite.files?.length || 0} files</p>
                    </div>
                    <div>
                      <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} className="hidden" />
                      <button
                        onClick={() => handleUploadClick(selectedSiteIndex!)}
                        disabled={uploading}
                        className="px-5 py-3 bg-[#15803D] text-white rounded-xl flex items-center gap-2 hover:bg-[#166534] disabled:opacity-50 transition"
                      >
                        <Upload className="w-5 h-5" />
                        {uploading ? "Uploading..." : "Upload"}
                      </button>
                    </div>
                  </div>

                  {uploading && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className="bg-[#15803D] h-3 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Files List */}
                <div className="overflow-x-auto">
                  {/* Desktop Table */}
                  <table className="w-full hidden lg:table text-left">
                    <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium">Name</th>
                        <th className="px-6 py-4 font-medium">Size</th>
                        <th className="px-6 py-4 font-medium">Type</th>
                        <th className="px-6 py-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedSite.files || []).map((f, idx) => (
                        <tr key={`${f.public_id || f.url}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900 truncate max-w-xs">{f.name}</div>
                            {f.path && f.path !== f.name && (
                              <div className="text-xs text-gray-500 truncate max-w-xs">{f.path}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatFileSize(f.size)}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-gray-100 rounded text-xs">
                              {f.type?.split("/")[1] || f.type || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleEditFile(selectedSiteIndex!, idx)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDownload(f)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                <Download className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(selectedSiteIndex!, idx)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile Cards */}
                  <div className="lg:hidden divide-y divide-gray-100">
                    {(selectedSite.files || []).length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        No files yet. Tap &ldquo;Upload&ldquo; to add files.
                      </div>
                    ) : (
                      (selectedSite.files || []).map((f, idx) => (
                        <div key={idx} className="p-5 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{f.name}</div>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                                <span>{formatFileSize(f.size)}</span>
                                <span>•</span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                  {f.type?.split("/")[1] || "file"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditFile(selectedSiteIndex!, idx)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg">
                                <Edit className="w-5 h-5" />
                              </button>
                              <button onClick={() => handleDownload(f)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                <Download className="w-5 h-5" />
                              </button>
                              <button onClick={() => handleDelete(selectedSiteIndex!, idx)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Select a site from the dropdown to manage files.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Modal – Fixed X button alignment */}
      {editingFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gray-50">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Code className="w-8 h-8 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 truncate">
                    {sites[editingFile.siteIndex].files![editingFile.fileIndex].name}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {getFileLanguage(sites[editingFile.siteIndex].files![editingFile.fileIndex].name)} • {formatFileSize(sites[editingFile.siteIndex].files![editingFile.fileIndex].size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {previewMode ? "Edit" : "Preview"}
                </button>
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-5 py-2 bg-[#15803D] text-white rounded-lg flex items-center gap-2 hover:bg-[#166534] disabled:opacity-50 transition"
                >
                  {savingFile ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-3 hover:bg-gray-200 rounded-xl transition ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {previewMode ? (
                <div className="h-full overflow-auto bg-gray-100 p-6">
                  {getFileLanguage(sites[editingFile.siteIndex].files![editingFile.fileIndex].name) === "html" ? (
                    <div className="h-full bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-200">
                      <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-xs text-gray-400 ml-2">Preview</span>
                      </div>
                      <iframe srcDoc={editingFile.content} className="w-full h-[calc(100%-40px)] bg-white" sandbox="allow-scripts allow-same-origin" />
                    </div>
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap font-mono p-6 bg-white rounded-2xl shadow-lg border-2 border-gray-200">
                      {editingFile.content}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex h-full bg-gray-900">
                  <div className="w-12 bg-gray-800 text-gray-500 text-right px-3 py-6 font-mono text-sm select-none border-r border-gray-700">
                    {editingFile.content.split("\n").map((_, i) => (
                      <div key={i} className="leading-7">{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={editingFile.content}
                    onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                    className="flex-1 p-6 bg-gray-900 text-gray-100 font-mono text-sm caret-green-400 focus:outline-none resize-none"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-4">
                <span>Ctrl + S to save</span>
                <span>•</span>
                <span>{editingFile.content.split("\n").length} lines • {editingFile.content.length.toLocaleString()} chars</span>
              </div>
              <span className="text-xs bg-white px-3 py-1 rounded border">Changes saved to live site</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}