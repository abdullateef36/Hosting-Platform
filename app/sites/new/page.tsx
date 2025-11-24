"use client";

import { useState, useRef } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Upload, FileCode, AlertCircle, CheckCircle, Loader } from "lucide-react";

// Type augmentation for non-standard directory attributes
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
    mozdirectory?: string;
    allowdirs?: string;
  }
}

export default function DeployNewSite() {
  const { user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteName, setSiteName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setError("");
    setFiles([]);

    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileArray = Array.from(selectedFiles);

    // Validate file extensions
    const validExtensions = [
      ".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg",
      ".ico", ".json", ".xml", ".txt", ".webmanifest", ".webp", ".mp3"
    ];

    const invalidFiles = fileArray.filter(file => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      return !validExtensions.includes(ext);
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid files: ${invalidFiles.map(f => f.name).join(", ")}`);
      return;
    }

    // Check for index.html (in root or subfolder)
    const hasIndexHtml = fileArray.some(file => {
      const path = ((file as unknown) as { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return path.toLowerCase().endsWith("/index.html") || file.name.toLowerCase() === "index.html";
    });

    if (!hasIndexHtml) {
      setError("Please include an index.html file in your project folder.");
      return;
    }

    setFiles(fileArray);
  };

  const handleDeploy = async () => {
    if (!user || files.length === 0 || !siteName.trim()) {
      setError("Please enter a site name and select your website folder.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const siteId = `${user.uid}_${Date.now()}`;
      const siteUrl = `${window.location.origin}/sites/${siteId}`;

      let totalStorage = 0;
      files.forEach(f => totalStorage += f.size);

      const uploadedFiles: {
        name: string;
        url: string;
        size: number;
        path: string;
        type: string;
      }[] = [];

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing!");
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = ((file as unknown) as { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const publicId = relativePath.replace(/\\/g, "/"); // Normalize Windows paths

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", `sites/${siteId}`);
        formData.append("public_id", publicId.split("/").slice(0, -1).join("/") === "" 
          ? file.name 
          : publicId.replace(/^.*\//, "") // filename only if in subfolder
        );

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(`Upload failed: ${data.error?.message || "Unknown error"}`);
        }

        uploadedFiles.push({
          name: file.name,
          url: data.secure_url,
          size: file.size,
          path: relativePath,
          type: file.type || "application/octet-stream",
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Save to Firestore
      await addDoc(collection(db, "sites"), {
        name: siteName,
        siteId,
        ownerId: user.uid,
        ownerEmail: user.email,
        status: "live",
        url: siteUrl,
        storage: Number((totalStorage / (1024 * 1024)).toFixed(2)),
        files: uploadedFiles,
        visits: 0,
        lastDeployed: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "deployments"), {
        siteName,
        siteId,
        ownerId: user.uid,
        status: "success",
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      router.push(`/sites/${siteId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Deploy error:", err);
      setError(errorMessage || "Deployment failed. Please try again.");
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Deploy New Site</h1>
          <p className="text-gray-600 mt-2">
            Upload your complete website folder — structure will be preserved!
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Site Name *
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="my-awesome-site"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#15803D] focus:border-transparent outline-none transition"
              disabled={uploading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Upload Your Website Folder *
            </label>

            <input
              ref={fileInputRef}
              type="file"
              // These 3 lines are CRITICAL for folder selection
              webkitdirectory=""
              directory=""
              mozdirectory=""
              allowdirs=""
              multiple
              onChange={handleFileChange}
              accept=".html,.css,.js,.png,.jpg,.jpeg,.gif,.svg,.ico,.json,.xml,.txt,.webmanifest,.webp,.mp3,.mp4,.wav,.ogg"
              className="hidden"
              id="folder-upload"
              disabled={uploading}
            />

            <label
              htmlFor="folder-upload"
              className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all
                ${files.length > 0 ? "border-[#15803D] bg-green-50" : "border-gray-300 hover:border-[#15803D] bg-gray-50"}
                ${uploading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {files.length > 0 ? (
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 text-[#15803D] mx-auto mb-4" />
                  <p className="text-lg font-bold text-gray-900">
                    {files.length} files selected
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Ready to deploy!
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-bold text-gray-900">
                    Click to select a folder
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Choose your entire website project folder
                  </p>
                </div>
              )}
            </label>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">How to upload:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs">
                    <li>Click above and <strong>select your website folder</strong> (not files)</li>
                    <li>Must contain <code className="bg-blue-100 px-1 rounded">index.html</code> in the root</li>
                    <li>Subfolders like <code className="bg-blue-100 px-1 rounded">css/</code>, <code className="bg-blue-100 px-1 rounded">js/</code>, <code className="bg-blue-100 px-1 rounded">assets/</code> are fully supported</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">Uploading & Deploying...</span>
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

          <button
            onClick={handleDeploy}
            disabled={uploading || !siteName.trim() || files.length === 0}
            className={`w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-3 transition-all
              ${uploading || !siteName.trim() || files.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#15803D] hover:bg-[#156e35] shadow-lg hover:shadow-xl"
              }`}
          >
            {uploading ? (
              <>
                <Loader className="w-6 h-6 animate-spin" />
                Deploying Your Site...
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                Deploy Site Now
              </>
            )}
          </button>
        </div>

        <div className="mt-8 bg-linear-to-r from-[#15803D] to-green-600 text-white rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <FileCode className="w-8 h-8 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">Your site goes live instantly!</h3>
              <p className="text-sm opacity-90">
                Full folder structure preserved • Works with React, Vite, plain HTML • Free & fast hosting
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}