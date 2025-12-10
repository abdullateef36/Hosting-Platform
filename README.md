# 🚀 Hosting Platform (School Project)

A simple static hosting platform built as a school project that allows users to upload and host front-end websites (HTML, CSS, and JavaScript) and preview them live.  
This project demonstrates core hosting concepts (file upload, proxy-based routing, and live preview) without requiring DNS or custom domain management.

---

## 🔎 Features

- User authentication (Sign up & Login — Firebase)
- Upload static websites (HTML, CSS, JS) as a folder
- Live preview of uploaded sites via a proxy route
- Unique site IDs for each upload
- Dashboard-style UI for managing uploads
- Proxy-based file serving (path-based hosting)

---

## 🧭 Why this approach?

This project uses path-based routing and a server-side proxy instead of giving each user a custom DNS/subdomain.  
That makes it easy to provide live previews/hosting in a school project environment without the complexity and cost of domain registrars, SSL wildcard certs, and DNS automation.

---

## 🛠️ Built With

- **Next.js** (App Router) — frontend + API routes  
- **TypeScript** — type safety  
- **Firebase** — Authentication & Storage (optional / can be swapped)  
- **Vercel** — deployment for frontend & API (note: Vercel has filesystem write limitations; see Deployment below)

---

## 📁 Project Structure (example)
---

## ⚙️ How It Works

1. User registers and logs in.
2. User uploads a folder containing `index.html` and static assets.
3. Server stores the files and returns a unique site ID.
4. The platform serves the files through a proxy route:https://your-app.com/api/proxy/{site-id}
5. Anyone with the link can view the uploaded site live.

---

## 🚀 Quick Start (Local Development)

> These instructions assume a Next.js + TypeScript project scaffold.

1. **Clone the repository**
```bash
git clone https://github.com/abdullateef36/Hosting-Platform.git
cd Hosting-Platform
