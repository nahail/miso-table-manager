# 🍜 MISO — Restaurant Floor & Table Manager

A real-time, 5-story restaurant table seating software built for **MISO**. 
Designed to be **100% free to host and operate**:
- **Frontend**: Deployed on [Vercel](https://vercel.com) (Free Tier)
- **Backend & Database**: [Supabase](https://supabase.com) (Free Tier PostgreSQL + Realtime WebSockets)

---

## ⚡ Features
- **Visual Green/Red Table Cards**:
  - 🟢 **Green (Available)**: Table is free and ready for seating.
  - 🔴 **Red (Occupied)**: Click when guests arrive; shows elapsed seating timer (e.g., "Seated 25m ago").
  - Waiters or receptionists click again when guests leave to turn it back to **Green**.
- **5-Story Floor Navigator**:
  - Filter by **Floor 1, 2, 3, 4, 5**, or see an **All Floors** overview.
  - Floor tabs display live badges of free tables and available seats (e.g. `Floor 2: 3/5 free (12 seats)`), so receptionists know where to seat guests instantly.
- **Party Size & Status Filters**:
  - Instantly filter tables for arriving party sizes (2+, 4+, 6+, 8+).
  - Filter only Available or Occupied tables.
- **Dynamic Table Management**:
  - Add new tables on any floor with custom names and chair capacities.
  - Edit table names, floors, or capacities.
  - Delete/remove tables with safety confirmation.
- **Real-Time Multi-Device Sync**:
  - When receptionist seats guests on the ground floor, waiters on floors 1–5 see the table turn Red instantly on their phones or tablets without refreshing.

---

## 🚀 Quick Start (Local Testing)

To test the application locally on your machine:

```bash
cd /Users/nahailirfan/.gemini/antigravity/scratch/miso-table-manager
npm run dev
```

Open your browser at `http://localhost:5173`.
*Even without Supabase configured yet, the app works immediately in offline mode using localStorage!*

---

## ☁️ Step 1: Set Up Backend on Supabase (100% Free)

1. Sign up or log in at **[supabase.com](https://supabase.com)** (Free Tier).
2. Click **New Project** and name it `miso-restaurant`. Set a secure database password and choose your nearest region.
3. Once the project is created, click on the **SQL Editor** tab in the left sidebar.
4. Click **New Query**, copy the entire contents of [`supabase-schema.sql`](./supabase-schema.sql), paste it into the editor, and click **Run**.
   - *This creates the `tables` table, sets up security rules, enables real-time synchronization, and seeds all 5 floors with 25 default tables!*
5. Go to **Project Settings** (gear icon) ➜ **API**.
6. Copy your:
   - **Project URL** (`https://xyzcompany.supabase.co`)
   - **Project API Keys ➜ `anon` / `public`**

---

## 🌐 Step 2: Deploy Frontend on Vercel (100% Free)

### Option A: Using the Vercel Dashboard (Recommended)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for MISO Table Manager"
   # Create a repo on GitHub and push:
   # git remote add origin https://github.com/your-username/miso-table-manager.git
   # git branch -M main
   # git push -u origin main
   ```
2. Log in to **[vercel.com](https://vercel.com)**.
3. Click **Add New...** ➜ **Project**, and import your `miso-table-manager` GitHub repository.
4. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL`: (your Supabase project URL)
   - `VITE_SUPABASE_ANON_KEY`: (your Supabase anon key)
5. Click **Deploy**. In under a minute, your website will be live with a free URL like `https://miso-table-manager.vercel.app`!

### Option B: Direct Testing via On-Screen UI
You can also open the deployed Vercel site or local dev server, click the **Settings (gear icon)** at the top right, and paste your Supabase URL & Key directly into the browser. It will connect immediately!

---

## 📱 Using on Phones & Tablets
Simply bookmark the Vercel URL on:
- Receptionist's iPad or desktop PC at the front door.
- Floor waiters' smartphones (iPhone / Android) on each floor.

Whenever any staff member taps a table, the color changes everywhere in real-time.
