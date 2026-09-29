# SHEQ Inspection Management System — Zero-Billing Deployment Guide

This guide documents how to deploy the entire production application with **$0 monthly cloud spend** while preserving full enterprise security, private photographic records, and role-based access control.

---

## Architecture Overview

| Component | Service | Cost Tier | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | Firebase Hosting | Spark (Free) | Global CDN hosting for React/Vite application |
| **Backend API** | Render Web Service | Free Web Service | Express server for photo processing, signed URLs, and PDF generation |
| **Database** | Firebase Firestore | Spark (Free) | Inspections, findings, corrective actions, users, and audit logs |
| **Authentication** | Firebase Authentication | Spark (Free) | User credentials, session tokens, and role identification |
| **Photo Storage** | Supabase Storage | Free Tier (1 GB) | Private, encrypted photographic evidence & inspection photos |

**Zero Google Cloud Billing Guarantee:**
- No Google Cloud billing account is linked.
- Firebase project remains strictly on the **Spark tier**.
- Cloud Run, Firebase App Hosting, and Firebase Cloud Functions are **not used**.

---

## 1. Supabase Storage Setup (Free Tier)

Supabase provides 1 GB of free private object storage per project.

1. Create a free project at [supabase.com](https://supabase.com).
2. Navigate to **Storage** > **New Bucket**:
   - **Name:** `sheq-photos`
   - **Public bucket:** `OFF` (Must be **Private**; files must never be publicly readable)
3. Navigate to **Project Settings** > **API**:
   - Note the **Project URL** (`https://<project-ref>.supabase.co`).
   - Note the **service_role secret key** (`ey...`).
   - ⚠️ **Security Warning:** The `service_role` key bypasses all Row Level Security. **Never** put it into client `.env` files or commit it to GitHub. It is set exclusively in the Render backend environment.

---

## 2. Backend Deployment: Render Free Web Service

The backend handles private photo uploads, temporary 1-hour signed URL generation, cascading photo deletions, and server-side PDF report rendering.

### Step 2.1: Create Render Web Service
1. Push your repository to GitHub or GitLab.
2. Sign in to [render.com](https://render.com) and click **New** > **Web Service**.
3. Select your repository.
4. Configure the service settings:
   - **Name:** `sheq-api`
   - **Environment:** `Node`
   - **Plan:** `Free`
   - **Root Directory:** Leave **BLANK** (or `.`). **Do NOT set to `src`!** `package.json` is at the repository root.
   - **Build Command:** `npm install && npm run build:server`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`

### Step 2.2: Set Render Environment Variables
In the Render dashboard under **Environment**, add:

| Environment Variable | Value / Description | Sensitive? |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | No |
| `PORT` | `10000` *(Render sets this automatically)* | No |
| `SUPABASE_URL` | Your Supabase project URL (`https://xyz.supabase.co`) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Your private Supabase `service_role` secret | **YES** |
| `FRONTEND_ORIGIN` | Your Firebase Hosting URL (e.g. `https://gen-lang-client-0206733447.web.app`) | No |
| `FIREBASE_PROJECT_ID` | `gen-lang-client-0206733447` | No |
| `FIREBASE_FIRESTORE_DATABASE_ID` | `ai-studio-sheqinspectionma-4abefbf2-9ba0-4a2c-b1b2-e5df5e3a2729` | No |

*Note on Firebase Authentication Verification:*
The backend verifies user Firebase ID tokens cryptographically using Google's public X.509 certificates (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`). No `FIREBASE_API_KEY` is needed on Render, ensuring photo uploads and PDF generation succeed with zero Google Cloud billing and no API key restriction issues.

### Step 2.3: Verify Backend
The live backend service is deployed at:
`https://sheq-inspection-app.onrender.com`

Verify by opening `https://sheq-inspection-app.onrender.com/api/health` in your browser.
Expected output:
```json
{"status":"ok","timestamp":"2026-..."}
```

*Note on Free Tier Spin-Down:* Free instances on Render spin down after 15 minutes of inactivity. The frontend includes automatic handling informing the user to allow up to 30 seconds for initial cold-start wake-up.

---

## 3. Frontend Deployment: Firebase Hosting (Spark Tier)

Firebase Hosting provides zero-cost static hosting with custom domain and SSL support.

### Option A: Automated Deployment via GitHub Actions (Zero Local Installs)

Because deployment is handled in CI, **no Node.js or Firebase CLI is required on your local computer**.

The repository includes `.github/workflows/firebase-hosting.yml` which automatically builds `dist/` with `VITE_API_BASE_URL=https://sheq-inspection-app.onrender.com` and deploys it to Firebase Hosting.

#### Step 1: Download Service Account Key from Firebase Console
1. Open [Firebase Project Settings > Service Accounts](https://console.firebase.google.com/project/gen-lang-client-0206733447/settings/serviceaccounts/adminsdk).
2. Ensure **Firebase Admin SDK** is selected.
3. Click the **Generate new private key** button, then confirm by clicking **Generate key**.
4. A JSON file (e.g. `gen-lang-client-0206733447-firebase-adminsdk-....json`) will download to your computer.
5. Open this JSON file in Notepad and copy its entire text contents.

#### Step 2: Add the Secret to GitHub
1. In your browser, open your GitHub repository:
   `https://github.com/Dalesheq/SHEQ-Inspection-App/settings/secrets/actions`
2. Click **New repository secret**.
3. Set **Name** to:
   ```text
   FIREBASE_SERVICE_ACCOUNT_GEN_LANG_CLIENT_0206733447
   ```
   *(Or simply `FIREBASE_SERVICE_ACCOUNT`)*
4. In the **Secret** field, paste the full JSON contents you copied from the downloaded file.
5. Click **Add secret**.

#### Step 3: Trigger the Deployment
- Whenever you push code to `main` or `master`, the workflow will run automatically.
- Or, manually trigger it at any time:
  1. Go to `https://github.com/Dalesheq/SHEQ-Inspection-App/actions`
  2. Click **Deploy Frontend to Firebase Hosting** in the left sidebar.
  3. Click **Run workflow** -> Select `main` -> Click **Run workflow**.

Once complete, your app is live at:
- `https://gen-lang-client-0206733447.web.app`
- `https://gen-lang-client-0206733447.firebaseapp.com`

---

### Option B: Local CLI Deployment (Optional)
If you ever have Node.js and Firebase CLI available locally:
```bash
npm run build:frontend
npx firebase login
npx firebase deploy --only hosting --project gen-lang-client-0206733447
```

---

## 4. Verification Checklist

1. **Frontend App:** Visit `https://gen-lang-client-0206733447.web.app`. Log in as Admin.
2. **Inspection & Photo Flow:** Create an inspection, capture/upload a photo, verify it uploads and generates an immediate signed thumbnail.
3. **Actioner Portal:** Log in as an assigned Actioner, navigate to an assigned corrective action, upload photo evidence, verify the action status updates.
4. **PDF Generation:** Download a formal SHEQ inspection report PDF from the Inspection Details view.
5. **Security Verification:**
   - In DevTools Network tab, confirm no Supabase `service_role` key is ever transferred.
   - Confirm photo URLs expire after 1 hour.
   - Confirm non-admin users cannot download administrative inspection collections or trigger unauthorized reports.
