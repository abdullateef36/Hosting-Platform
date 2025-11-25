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
import { Loader, Upload, Trash2, Download, Edit, X, Save, Eye, Code } from "lucide-react";

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

  const handleSaveFile = useCallback(async () => {
    if (!editingFile) return;
    
    setSavingFile(true);
    setError(null);

    try {
      const site = sites[editingFile.siteIndex];
      const file = site.files![editingFile.fileIndex];
      
      // Create a new blob with the edited content
      const blob = new Blob([editingFile.content], { type: file.type || 'text/plain' });
      const newFile = new File([blob], file.name, { type: file.type || 'text/plain' });

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) throw new Error("Cloudinary not configured.");

      // Upload the updated file
      const formData = new FormData();
      formData.append("file", newFile);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", `sites/${site.siteId}`);
      
      // Use the same public_id to replace the file
      if (file.public_id) {
        formData.append("public_id", file.public_id);
      }

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || "Upload failed");

      // Update the file in Firestore
      const updatedFiles = [...(site.files || [])];
      updatedFiles[editingFile.fileIndex] = {
        ...file,
        url: data.secure_url,
        size: newFile.size,
      };

      const siteRef = firestoreDoc(db!, "sites", site.id);
      const totalStorageBytes = updatedFiles.reduce((s: number, f: SiteFile) => s + (f.size || 0), 0);
      const storageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));
      
      await updateDoc(siteRef, { 
        files: updatedFiles,
        storage: storageMB 
      });

      // Update local state
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

  // Keyboard shortcut for saving (Ctrl+S / Cmd+S)
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
        const items: Site[] = snap.docs.map((d) => ({ 
          id: d.id, 
          ...d.data() 
        } as Site));
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
    
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  };

  const handleSelectSite = (index: number) => {
    setSelectedSiteIndex(index === selectedSiteIndex ? null : index);
  };

  const handleDownload = (file: SiteFile) => {
    // open in new tab to trigger download/view
    window.open(file.url, "_blank");
  };

  const handleDelete = async (siteIndex: number, fileIndex: number) => {
    const site = sites[siteIndex];
    const file: SiteFile = site.files![fileIndex];
    if (!confirm(`Delete ${file.name}? This will remove it from the site listing.`)) return;

    try {
      // Remove file entry from Firestore (we do not attempt to delete from Cloudinary here)
      const updatedFiles = (site.files || []).slice();
      updatedFiles.splice(fileIndex, 1);

      // Recalculate storage
      const totalStorageBytes = updatedFiles.reduce((s: number, f: SiteFile) => s + (f.size || 0), 0);
      const storageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));

      const siteRef = firestoreDoc(db!, "sites", site.id);
      await updateDoc(siteRef, { 
        files: updatedFiles,
        storage: storageMB 
      });

      // Update local state
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
    
    // Only allow editing of text-based files
    const editableTypes = ['html', 'css', 'js', 'json', 'txt', 'xml', 'svg'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (!editableTypes.includes(fileExt)) {
      setError("This file type cannot be edited in the browser.");
      return;
    }

    try {
      // Fetch the file content
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
      'html': 'html',
      'css': 'css',
      'js': 'javascript',
      'json': 'json',
      'xml': 'xml',
      'svg': 'xml',
      'txt': 'plaintext'
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

      // merge files into site.files and update storage
      const merged = [...(site.files || []), ...uploadedFiles];
      const totalStorageBytes = merged.reduce((s: number, f: SiteFile) => s + (f.size || 0), 0);
      const storageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));

      const siteRef = firestoreDoc(db!, "sites", site.id);
      await updateDoc(siteRef, {
        files: merged,
        storage: storageMB,
      });

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Sign in to manage your files.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">File Manager</h1>
          <p className="text-sm text-gray-600">Manage files for your deployed sites</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Code Editor Modal */}
        {editingFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
              {/* Editor Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-linear-to-r from-gray-50 to-white">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-purple-100 rounded-xl">
                    <Code className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {sites[editingFile.siteIndex].files![editingFile.fileIndex].name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {getFileLanguage(sites[editingFile.siteIndex].files![editingFile.fileIndex].name)}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(sites[editingFile.siteIndex].files![editingFile.fileIndex].size)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-xl transition flex items-center gap-2 ${
                      previewMode 
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    {previewMode ? 'Edit Code' : 'Preview'}
                  </button>
                  <button
                    onClick={handleSaveFile}
                    disabled={savingFile}
                    className="px-5 py-2.5 bg-[#15803D] text-white font-medium rounded-xl hover:bg-[#166534] transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    {savingFile ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setEditingFile(null)}
                    className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-hidden flex">
                {previewMode ? (
                  <div className="w-full h-full overflow-auto bg-gray-100 p-6">
                    {getFileLanguage(sites[editingFile.siteIndex].files![editingFile.fileIndex].name) === 'html' ? (
                      <div className="h-full bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-200">
                        <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          </div>
                          <span className="text-xs text-gray-400 ml-2">Preview</span>
                        </div>
                        <iframe
                          srcDoc={editingFile.content}
                          className="w-full h-[calc(100%-40px)] bg-white"
                          title="Preview"
                          sandbox="allow-scripts allow-same-origin"
                        />
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 h-full overflow-hidden flex flex-col">
                        <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          </div>
                          <span className="text-xs text-gray-400 ml-2">Preview</span>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                          <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                            {editingFile.content}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex bg-gray-900">
                    {/* Line Numbers */}
                    <div className="bg-gray-800 text-gray-500 text-right select-none px-4 py-6 font-mono text-sm border-r border-gray-700 overflow-hidden">
                      {editingFile.content.split('\n').map((_, i) => (
                        <div key={i} className="leading-7 h-7">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    
                    {/* Code Editor */}
                    <div className="flex-1 relative">
                      <textarea
                        value={editingFile.content}
                        onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                        className="w-full h-full p-6 font-mono text-sm resize-none focus:outline-none border-0 bg-gray-900 text-gray-100 leading-7"
                        spellCheck={false}
                        style={{
                          tabSize: 2,
                          caretColor: '#10b981',
                        }}
                        placeholder="Start typing your code here..."
                      />
                      
                      {/* Syntax highlighting hint */}
                      <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-gray-400 font-medium pointer-events-none">
                        {getFileLanguage(sites[editingFile.siteIndex].files![editingFile.fileIndex].name).toUpperCase()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Editor Footer */}
              <div className="px-6 py-3 border-t border-gray-200 bg-linear-to-r from-gray-50 to-white flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                    <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono border border-gray-300">Ctrl</kbd>
                    <span className="text-gray-400">+</span>
                    <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono border border-gray-300">S</kbd>
                    <span className="text-gray-500 ml-2">to save</span>
                  </div>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <span className="text-gray-500">
                    {editingFile.content.split('\n').length} lines
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">
                    {editingFile.content.length.toLocaleString()} characters
                  </span>
                </div>
                <div className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                  Changes are saved to your live site
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-white rounded-2xl p-4 border border-gray-100">
            <h3 className="font-semibold mb-3">Your Sites</h3>
            <ul className="space-y-2">
              {sites.length === 0 && <li className="text-sm text-gray-500">No sites yet.</li>}
              {sites.map((s, i) => (
                <li 
                  key={s.id} 
                  className={`p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${selectedSiteIndex === i ? 'bg-gray-50 border border-gray-200' : ''}`} 
                  onClick={() => handleSelectSite(i)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{s.name || s.siteId}</div>
                      <div className="text-xs text-gray-500">{s.files?.length || 0} files • {s.storage ? `${s.storage} MB` : '0 MB'}</div>
                    </div>
                    {s.status && (
                      <div className="text-xs text-gray-400 ml-2 shrink-0">{s.status}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 bg-white rounded-2xl p-6 border border-gray-100">
            {selectedSiteIndex === null ? (
              <div className="text-center text-gray-500 py-12">Select a site to view files.</div>
            ) : (
              (() => {
                const site = sites[selectedSiteIndex];
                return (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{site.name || site.siteId}</h2>
                        <p className="text-xs text-gray-500">{site.files?.length || 0} files</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} className="hidden" />
                        <button 
                          className="px-4 py-2 bg-[#15803D] text-white rounded-lg flex items-center gap-2 hover:bg-[#166534] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                          onClick={() => handleUploadClick(selectedSiteIndex)} 
                          disabled={uploading}
                        >
                          <Upload className="w-4 h-4" />
                          <span className="text-sm">Upload</span>
                        </button>
                      </div>
                    </div>

                    {uploading && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm mb-2 text-blue-900 font-medium">Uploading... {uploadProgress}%</div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div className="bg-[#15803D] h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider">
                            <tr>
                              <th className="p-3 font-semibold">Name</th>
                              <th className="p-3 font-semibold w-24">Size</th>
                              <th className="p-3 font-semibold w-32">Type</th>
                              <th className="p-3 font-semibold w-56">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(site.files || []).map((f: SiteFile, idx: number) => (
                              <tr key={`${f.public_id || f.url}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                <td className="p-3">
                                  <div className="font-medium text-gray-900 truncate max-w-xs">{f.name}</div>
                                  {f.path && f.path !== f.name && (
                                    <div className="text-xs text-gray-500 truncate max-w-xs">{f.path}</div>
                                  )}
                                </td>
                                <td className="p-3 text-sm text-gray-600 whitespace-nowrap">
                                  {formatFileSize(f.size)}
                                </td>
                                <td className="p-3 text-sm text-gray-600">
                                  <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs truncate max-w-full">
                                    {f.type?.split('/')[1] || f.type || '—'}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditFile(selectedSiteIndex, idx)} 
                                      className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg flex items-center gap-1.5 text-sm hover:bg-purple-100 transition-colors"
                                      title="Edit file"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </button>
                                    <button 
                                      onClick={() => handleDownload(f)} 
                                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-1.5 text-sm hover:bg-blue-100 transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Open</span>
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(selectedSiteIndex, idx)} 
                                      className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg flex items-center gap-1.5 text-sm hover:bg-red-100 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {(site.files || []).length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-sm text-gray-500">
                                  No files uploaded for this site yet. Click &quot;Upload&quot; to add files.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </main>
  );
}