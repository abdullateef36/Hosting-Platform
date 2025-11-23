"use client";

import { useState } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Upload, FileCode, AlertCircle, CheckCircle, Loader } from "lucide-react";

export default function DeployNewSite() {
  const { user } = useUser();
  const router = useRouter();
  
  const [siteName, setSiteName] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setError("");
    
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Validate files
    const validExtensions = [".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico"];
    const invalidFiles = Array.from(selectedFiles).filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      return !validExtensions.includes(ext);
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid files: ${invalidFiles.map(f => f.name).join(", ")}`);
      return;
    }

    // Check for index.html
    const hasIndexHtml = Array.from(selectedFiles).some(
      file => file.name.toLowerCase() === "index.html"
    );

    if (!hasIndexHtml) {
      setError("Please include an index.html file as your site's entry point.");
      return;
    }

    setFiles(selectedFiles);
  };

  const handleDeploy = async () => {
    if (!user || !files || !siteName.trim()) {
      setError("Please provide a site name and select files.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      // Generate unique site ID
      const siteId = `${user.uid}_${Date.now()}`;
      const siteUrl = `${window.location.origin}/sites/${siteId}`;

      // Calculate total storage
      let totalStorage = 0;
      Array.from(files).forEach(file => {
        totalStorage += file.size;
      });

      // Upload files to Cloudinary (unsigned preset). Requires these env vars to be set:
      // NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      const uploadedFiles: { name: string; url: string; size: number }[] = [];
      const filesArray = Array.from(files);

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.");
      }

      for (let i = 0; i < filesArray.length; i++) {
  const file = filesArray[i];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `sites/${siteId}`);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  const dataJson = await res.json();
  console.log("Cloudinary upload:", dataJson);

  if (!res.ok || !dataJson.secure_url) {
    throw new Error(
      `Upload failed for ${file.name}: ${dataJson.error?.message || res.status}`
    );
  }

  uploadedFiles.push({
    name: file.name,
    url: dataJson.secure_url,
    size: file.size,
  });

  setUploadProgress(Math.round(((i + 1) / filesArray.length) * 100));
}

      // Create site document in Firestore
      await addDoc(collection(db, "sites"), {
        name: siteName,
        siteId,
        ownerId: user.uid,
        ownerEmail: user.email,
        status: "live",
        url: siteUrl,
        storage: totalStorage / (1024 * 1024), // Convert to MB
        files: uploadedFiles,
        visits: 0,
        lastDeployed: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // Create deployment record
      await addDoc(collection(db, "deployments"), {
        siteName,
        siteId,
        ownerId: user.uid,
        status: "success",
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // Redirect to the deployed site
      router.push(`/sites/${siteId}`);
      
    } catch (err) {
      console.error("Deployment error:", err);
      setError("Failed to deploy site. Please try again.");
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Please sign in to deploy a site.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Deploy New Site</h1>
          <p className="text-gray-600 mt-2">
            Upload your HTML, CSS, and JavaScript files to deploy your site instantly.
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          
          {/* Site Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Site Name *
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="my-awesome-portfolio"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent outline-none transition"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Choose a memorable name for your project
            </p>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Upload Files *
            </label>
            
            <div className="relative">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                accept=".html,.css,.js,.png,.jpg,.jpeg,.gif,.svg,.ico"
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition
                  ${files ? "border-[#15803D] bg-green-50" : "border-gray-300 hover:border-[#15803D] bg-gray-50"}
                  ${uploading ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {files ? (
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 text-[#15803D] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900">
                      {files.length} {files.length === 1 ? "file" : "files"} selected
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {Array.from(files).map(f => f.name).join(", ")}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      HTML, CSS, JS, and image files
                    </p>
                  </div>
                )}
              </label>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Important Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Must include an <code className="bg-blue-100 px-1 rounded">index.html</code> file</li>
                    <li>Supported formats: HTML, CSS, JS, PNG, JPG, GIF, SVG, ICO</li>
                    <li>All files should be in the root folder (no subfolders)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">Deploying...</span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-[#15803D] h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={uploading || !siteName.trim() || !files}
            className={`w-full py-4 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2
              ${uploading || !siteName.trim() || !files
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-[#15803D] hover:bg-[#156e35] shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              }
            `}
          >
            {uploading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Deploying Site...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Deploy Site
              </>
            )}
          </button>
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-linear-to-r from-[#15803D] to-green-600 text-white rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <FileCode className="w-8 h-8 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Quick Tips for Deployment</h3>
              <ul className="space-y-1 text-sm opacity-90">
                <li>• Make sure your main file is named <code className="bg-white/20 px-1 rounded">index.html</code></li>
                <li>• Use relative paths for CSS and JS files (e.g., <code className="bg-white/20 px-1 rounded">./style.css</code>)</li>
                <li>• Keep all files in the same folder for easy deployment</li>
                <li>• Your site will be live instantly after upload!</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}