"""
ResumeRank Python Backend — FastAPI server for Railway deployment.

Uses ONNX Runtime (~100MB) instead of PyTorch (~2GB).
Same all-MiniLM-L6-v2 model, 384-dim embeddings, identical scoring.
"""

import io
import os
import re
import time
import logging
from typing import Optional

import numpy as np
import pdfplumber
import docx
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from encoder import get_encoder

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("resumerank")

app = FastAPI(title="ResumeRank Scoring Engine")

_encoder = None


def get_enc():
    global _encoder
    if _encoder is None:
        log.info("Loading ONNX encoder...")
        t0 = time.time()
        _encoder = get_encoder()
        log.info(f"Encoder ready in {time.time() - t0:.1f}s")
    return _encoder


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text(file_bytes: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
        return "\n".join(parts)
    elif name.endswith(".docx") or name.endswith(".doc"):
        d = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in d.paragraphs if p.text.strip())
    elif name.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"Unsupported format: {filename}")


# ---------------------------------------------------------------------------
# Preprocessing & scoring
# ---------------------------------------------------------------------------

STOP_WORDS = frozenset(
    "a an the i me my myself we our ours ourselves you your yours yourself yourselves "
    "he him his himself she her hers herself it its itself they them their theirs themselves "
    "about above across after against along among around at before behind below beneath "
    "beside between beyond by down during except for from in inside into near of off on "
    "out outside over past since through throughout to toward towards under underneath "
    "until up upon with within without and but or nor so yet both either neither not "
    "is am are was were be been being have has had having do does did doing will would "
    "shall should may might must can could also very too just then than now here there "
    "where when how why well really quite rather still already always never often sometimes "
    "usually again further once more most each every all any few many much some such no "
    "own same other another please thank thanks yes nope yeah yep okay ok like get got "
    "let make go going come came went take took see saw know knew think thought say said "
    "tell told give gave use used find found want wanted put set try tried ask ask need "
    "needed become became keep kept begin began show showed hear heard play run move live "
    "believe bring brought happen write wrote sit stand lose pay meet include continue "
    "change lead understand watch follow stop create speak read allow add spend grow open "
    "walk win offer remember love consider appear buy wait serve die send expect build "
    "stay fall cut reach kill remain suggest raise pass sell require report decide pull "
    "develop carry break receive agree support hit produce eat cover catch draw choose "
    "etc eg ie vs via per re ve ll d m s t".split()
)

PUNCT_RE = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@[\\\]^_`{|}~]')
WS_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"\b[a-z][\w+#.-]*[a-z0-9]\b", re.IGNORECASE)
EXTRA_STOP = frozenset(
    "the and for with that this from are was were been have has had not but they "
    "their will would could should can may also just than then more most other into "
    "over only very such when what about which each does did being where how all any "
    "both few many some these those through during before after above between under "
    "again further once here there why work team using used make made like new way "
    "well years year experience including".split()
)


def preprocess(text):
    if not text or not text.strip():
        return ""
    cleaned = PUNCT_RE.sub(" ", text)
    cleaned = WS_RE.sub(" ", cleaned).strip()
    return " ".join(w for w in cleaned.split(" ") if w.strip() and w.lower().strip() not in STOP_WORDS)


def key_terms(text):
    return set(
        m.group().lower()
        for m in WORD_RE.finditer(text)
        if len(m.group()) > 2 and m.group().lower() not in EXTRA_STOP
    )


def cosine_sim(a, b):
    d = np.dot(a, b)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(d / (na * nb)) if na > 0 and nb > 0 else 0.0


def jaccard(a, b):
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b) if (a | b) else 0.0


def score_resumes(jd_text, resumes):
    t0 = time.time()
    enc = get_enc()
    clean_jd = preprocess(jd_text)
    jd_emb = enc.encode([clean_jd])[0]

    valid = [r for r in resumes if r["text"].strip()]
    failed = [r for r in resumes if not r["text"].strip()]
    if not valid:
        return {"results": [], "totalProcessed": 0, "failedResumes": failed}

    clean_texts = [preprocess(r["text"][:5000]) for r in valid]
    resume_embs = enc.encode(clean_texts)

    results = []
    for i, r in enumerate(valid):
        sem = cosine_sim(jd_emb, resume_embs[i])
        rt, jt = key_terms(clean_texts[i]), key_terms(clean_jd)
        kw = jaccard(rt, jt)
        raw = round(min(100, max(0, (sem * 0.70 + kw * 0.30) * 100)))

        label = "exceptional" if raw >= 85 else "strong" if raw >= 70 else "moderate" if raw >= 55 else "weak" if raw >= 40 else "poor"

        results.append({
            "resumeName": r["name"],
            "rawScore": raw,
            "normalizedScore": 0,
            "matchSummary": f"This candidate shows {label} alignment. Semantic: {round(sem*100)}%, Keyword: {round(kw*100)}%. Score: {raw}/100.",
            "skillsMatched": sorted(rt & jt)[:20],
            "skillsMissing": sorted(jt - rt)[:20],
            "rank": 0,
            "method": "bert",
            "semanticScore": round(sem * 100),
            "keywordScore": round(kw * 100),
        })

    results.sort(key=lambda x: x["rawScore"], reverse=True)
    highest = results[0]["rawScore"] or 1
    for idx, r in enumerate(results):
        r["rank"] = idx + 1
        r["normalizedScore"] = round(r["rawScore"] / highest, 2)

    log.info(f"Scored {len(results)} resumes in {time.time()-t0:.1f}s")
    return {"results": results, "totalProcessed": len(results), "failedResumes": failed}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/analyze")
async def analyze(
    jobDescription: str = Form(...),
    jobTitle: Optional[str] = Form(None),
    resumes: list[UploadFile] = File(...),
):
    if not jobDescription.strip():
        return JSONResponse(status_code=400, content={"error": "Please provide a job description."})
    if len(resumes) > 50:
        return JSONResponse(status_code=400, content={"error": "Maximum 50 resumes per analysis."})

    parsed, failed = [], []
    for f in resumes:
        try:
            text = extract_text(await f.read(), f.filename)
            if text.strip():
                parsed.append({"name": f.filename, "text": text})
            else:
                failed.append({"name": f.filename, "error": "No text extracted"})
        except Exception as e:
            log.error(f"Failed {f.filename}: {e}")
            failed.append({"name": f.filename, "error": str(e)})

    if not parsed:
        return JSONResponse(status_code=400, content={"error": "Could not parse any resumes."})

    result = score_resumes(jobDescription, parsed)
    return {"success": True, "results": result["results"], "totalProcessed": result["totalProcessed"], "totalFailed": len(failed), "failedResumes": failed}


@app.get("/health")
async def health():
    return {"status": "ok", "engine": "onnxruntime"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))
