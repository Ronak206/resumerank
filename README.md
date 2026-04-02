<div align="center">

# ResumeRank

**BERT-powered resume ranking engine for HR professionals**

Paste a job description → upload candidate resumes → get an AI-ranked shortlist with CSV export.

[Features](#-features) · [Architecture](#-architecture) · [Deploy](#-deploy) · [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| **BERT Hybrid Scoring** | 70% semantic similarity (all-MiniLM-L6-v2, 384-dim) + 30% keyword overlap (Jaccard) |
| **Batch Processing** | Upload up to 50 resumes at once, ranked in seconds |
| **Top-N & Top-X% Filters** | Quick shortlisting by absolute rank or percentile |
| **CSV Export** | Download ranked results for your ATS or spreadsheet |
| **Performance Dashboard** | Benchmark charts, accuracy metrics, and custom dataset test results |
| **100% Free & Private** | All computation runs on your server. No external API calls. No data leaves your infrastructure |
| **Drag & Drop Upload** | Drag resumes or click to browse — supports PDF, DOCX, and TXT |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 16 (TypeScript)                │
│                                                          │
│   Landing Page → Upload → Analyzing → Results            │
│         │            │                                   │
│         │       API Routes                               │
│         │            │                                   │
│         │    ┌───────▼────────┐                          │
│         │    │ /api/analyze   │  Receives FormData       │
│         │    └───────┬────────┘                          │
│         │            │                                   │
│         │     Dual Mode:                                 │
│         │     ┌──────▼──────────────────────┐           │
│         │     │ PYTHON_BACKEND_URL set?     │           │
│         │     │  YES → HTTP call to Railway │           │
│         │     │  NO  → subprocess locally   │           │
│         │     └──────┬──────────────────────┘           │
│         │            │                                   │
└─────────│────────────│───────────────────────────────────┘
          │            │
          │   ┌────────▼───────────────────────────────────┐
          │   │    Python Backend (FastAPI)                 │
          │   │    Runs on Railway / Render / Self-host     │
          │   │                                             │
          │   │  ┌──────────────┐  ┌────────────────┐     │
          │   │  │ pdfplumber   │  │ python-docx    │     │
          │   │  │ (PDF parse)  │  │ (DOCX parse)   │     │
          │   │  └──────┬───────┘  └───────┬────────┘     │
          │   │         └────────┬─────────┘               │
          │   │                  ▼                          │
          │   │  ┌──────────────────────────────┐         │
          │   │  │  onnxruntime                 │         │
          │   │  │  all-MiniLM-L6-v2 (384-dim)  │         │
          │   │  │  Pure ONNX, no PyTorch       │         │
          │   │  └──────────────┬───────────────┘         │
          │   │                 ▼                           │
          │   │  ┌──────────────────────────────┐         │
          │   │  │  Hybrid Scorer               │         │
          │   │  │  0.70 × cosine + 0.30 × jacc │         │
          │   │  └──────────────────────────────┘         │
          │   └───────────────────────────────────────────┘
          │
          │   ┌───────────────────────────────────────────┐
          │   │    Python CLI (scorer_cli.py)             │
          │   │    For local development / self-host       │
          │   └───────────────────────────────────────────┘
```

### Data Flow

1. User pastes job description and uploads resumes (PDF/DOCX/TXT)
2. **Remote mode** (Vercel → Railway): Next.js sends files via HTTP POST to Python backend
3. **Local mode** (self-host): Next.js saves files to temp dir and calls Python CLI via `child_process.execFile`
4. Python extracts text using `pdfplumber` (PDF) or `python-docx` (DOCX)
5. Text is preprocessed — stop words and punctuation removed, tech terms preserved
6. Job description and each resume are encoded into 384-dim BERT embeddings via ONNX Runtime
7. Cosine similarity + Jaccard keyword overlap produces a hybrid 0–100 score
8. Results are ranked, normalized, and returned as JSON

---

## 🚀 Deploy (Free)

### Option 1: Vercel + Railway (Recommended)

**Best for:** Easiest setup, automatic HTTPS, generous free tiers.

#### Step 1 — Push to GitHub

```bash
git clone https://github.com/Ronak206/ResumeRank.git
cd ResumeRank
git remote set-url origin https://github.com/YOUR_USERNAME/resumerank.git
git push -u origin master
```

#### Step 2 — Deploy Python Backend on Railway

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `ResumeRank` repo
4. Railway will auto-detect the `Dockerfile` at repo root
5. **Do NOT set a PORT env variable** — Railway assigns it automatically
6. Railway gives you a URL like `https://your-app.up.railway.app`
7. The BERT model (~80MB) downloads on the first request and gets cached

> **Important:** The Dockerfile uses ONNX Runtime (not PyTorch), so the image is only ~400MB — well under Railway's free tier limit.

#### Step 3 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **"New Project"** → Import your `ResumeRank` repo
3. Framework Preset: **Next.js** (auto-detected)
4. Click **Deploy** — frontend is live in ~60 seconds

#### Step 4 — Connect Frontend to Backend

1. Copy your Railway URL (e.g. `https://gallant-delight-production.up.railway.app`)
2. Go to **Vercel** → your project → **Settings** → **Environment Variables**
3. Add:
   ```
   PYTHON_BACKEND_URL=https://your-app.up.railway.app
   ```
4. **Redeploy** Vercel (Deployments → ⋯ → Redeploy)

> ✅ Done! Upload resumes on your Vercel site, they get scored by the Railway backend.

---

### Option 2: Self-Host (VPS / Local Machine)

**Best for:** Full control, no vendor lock-in, unlimited usage, no cold starts.

#### Prerequisites

```bash
# Node.js 18+
node --version

# Python 3.10+
python3 --version

# Create virtual environment and install Python deps
python3 -m venv .venv
source .venv/bin/activate
pip install onnxruntime transformers huggingface_hub \
    pdfplumber python-docx numpy \
    fastapi uvicorn python-multipart
```

#### Run in Development

```bash
# Terminal 1 — Next.js frontend
npm install
npm run dev

# Terminal 2 — Python scorer (if using FastAPI mode)
cd python-backend
uvicorn scorer:app --host 0.0.0.0 --port 8001
```

Open `http://localhost:3000`

#### Run in Production (subprocess mode — no separate server needed)

```bash
# Build and start Next.js
npm run build
npx pm2 start npm --name "resumerank" -- start
```

The `/api/analyze` route calls `python-backend/scorer_cli.py` directly via subprocess. No separate Python server needed — just make sure the Python deps are installed.

---

### Option 3: Render (Free Tier)

**Best for:** Single platform, 750 hours/month free.

#### Python Backend on Render

1. Go to [render.com](https://render.com) → **New Web Service** → Connect repo
2. Set **Root Directory** to `python-backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn scorer:app --host 0.0.0.0 --port $PORT`

> **Note:** Render may pull in PyTorch via `sentence-transformers`, making the image large. Use `requirements-deploy.txt` (ONNX-only) for a smaller build.

---

## 🔬 Scoring Methodology

```
score = 0.70 × cosine_similarity(jd_embedding, resume_embedding)
      + 0.30 × jaccard_similarity(resume_terms, jd_terms)
```

| Step | Description |
|---|---|
| **Preprocess** | Remove 200+ English stop words and punctuation. Preserve tech terms, abbreviations, numbers. |
| **Embed** | Encode text into 384-dim vectors using `all-MiniLM-L6-v2` (22M params, 80MB ONNX, trained on 1B+ sentence pairs) |
| **Semantic** | Cosine similarity between JD and resume embeddings — catches synonyms and contextual meaning |
| **Keyword** | Jaccard set overlap of extracted key terms — catches exact skill/tool matches |
| **Scale** | Multiply by 100 → 0–100 score range |
| **Normalize** | `normalized = raw_score / highest_score` — top candidate always gets 1.0 |
| **Rank** | Sort descending, assign 1-based ranks |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui |
| **State** | Zustand (client), in-memory Map (server, auto-cleanup every 5 min) |
| **NLP Engine** | Python 3.11, ONNX Runtime, Transformers tokenizer (no PyTorch needed) |
| **Model** | `sentence-transformers/all-MiniLM-L6-v2` (384-dim embeddings, ~80MB) |
| **PDF Parsing** | pdfplumber |
| **DOCX Parsing** | python-docx |
| **Math** | NumPy (cosine similarity) |
| **Charts** | Recharts |
| **Toast** | Sonner |
| **Storage** | In-memory only — no database required. Sessions expire after 1 hour. |

---

## 📁 Project Structure

```
resumerank/
├── python-backend/
│   ├── encoder.py              # ONNX encoder (loads BERT model, encodes text)
│   ├── scorer_cli.py           # CLI scorer (called by Next.js via subprocess)
│   ├── scorer.py               # FastAPI server (for Railway/Render deployment)
│   ├── requirements.txt         # Local dev dependencies (full)
│   ├── requirements-deploy.txt # Deployment deps (ONNX-only, no PyTorch)
│   └── .dockerignore
├── Dockerfile                  # Railway/Render deployment (ONNX-only, ~400MB)
├── .dockerignore
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts   # Upload → Python scorer (dual mode)
│   │   │   ├── benchmark/route.ts # Benchmark data API
│   │   │   └── share/[code]/route.ts  # Shared shortlink handler
│   │   ├── page.tsx               # Main app page
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── upload-view.tsx        # JD input + drag & drop file upload
│   │   ├── analyzing-view.tsx     # Progress animation
│   │   ├── results-view.tsx       # Ranked results + filters + CSV export
│   │   ├── performance-view.tsx   # Benchmark dashboard
│   │   ├── drag-drop-provider.tsx # Global drag & drop event handler
│   │   └── ui/                    # shadcn/ui components
│   └── lib/
│       ├── store.ts               # Zustand state
│       └── storage.ts             # In-memory session storage
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## ⚡ Quick Start (Local)

```bash
# 1. Clone the repo
git clone https://github.com/Ronak206/ResumeRank.git
cd ResumeRank

# 2. Install frontend dependencies
npm install

# 3. Install Python dependencies (ONNX-only, no PyTorch)
python3 -m venv .venv
source .venv/bin/activate
pip install onnxruntime transformers huggingface_hub \
    pdfplumber python-docx numpy

# 4. Run
npm run dev

# 5. Open http://localhost:3000
```

The BERT model (~80MB) downloads automatically on first use and is cached locally.

---

## 🔑 Environment Variables

| Variable | Where | Description |
|---|---|---|
| `PYTHON_BACKEND_URL` | Vercel | Railway/Render URL (e.g. `https://your-app.up.railway.app`). If not set, uses local subprocess. |
| `PYTHON_BIN` | Vercel | Path to Python binary (default: auto-detected) |
| `PORT` | Railway/Render | **Do NOT set manually** — assigned automatically by the platform |
| `TRANSFORMERS_CACHE` | Any | Cache directory for BERT model downloads (default: `~/.cache/huggingface`) |

---

## 📜 License

MIT

---

<div align="center">
Built with ❤️ by <a href="https://github.com/Ronak206">Ronak</a>
</div>
