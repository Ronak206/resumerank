"""
ResumeRank Python CLI — called from Next.js /api/analyze via subprocess.

Usage:
  python3 scorer_cli.py <input_json_file> <output_json_file>

Input JSON:
{
  "jobDescription": "...",
  "resumes": [
    {"name": "file.pdf", "path": "/tmp/uploaded_file_1"},
    {"name": "file.docx", "path": "/tmp/uploaded_file_2"}
  ]
}

Output JSON:
{
  "results": [...],
  "totalProcessed": 5,
  "totalFailed": 1,
  "failedResumes": [{"name": "...", "error": "..."}]
}

Uses ONNX Runtime (~100MB) instead of PyTorch (~2GB) for Railway compatibility.
Same all-MiniLM-L6-v2 model, 384-dim embeddings, identical scoring.
"""

import sys
import os
import re
import json
import time
import logging
import numpy as np

# Set cache dir before any HF imports
os.environ.setdefault("HF_HOME", "/tmp/hf_cache")

import pdfplumber
import docx
from encoder import get_encoder

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("resumerank")

# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_pdf(path):
    parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)


def extract_docx(path):
    d = docx.Document(path)
    return "\n".join(p.text for p in d.paragraphs if p.text.strip())


def extract_text(path, filename):
    name = filename.lower()
    if name.endswith(".pdf"):
        return extract_pdf(path)
    elif name.endswith(".docx") or name.endswith(".doc"):
        return extract_docx(path)
    elif name.endswith(".txt"):
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    else:
        raise ValueError(f"Unsupported format: {filename}")


# ---------------------------------------------------------------------------
# Text preprocessing
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


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def cosine_sim(a, b):
    d = np.dot(a, b)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(d / (na * nb)) if na > 0 and nb > 0 else 0.0


def jaccard(a, b):
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union > 0 else 0.0


def match_label(score):
    if score >= 85: return "exceptional"
    if score >= 70: return "strong"
    if score >= 55: return "moderate"
    if score >= 40: return "weak"
    return "poor"


def score_resumes(jd_text, resumes):
    t0 = time.time()
    encoder = get_encoder()

    clean_jd = preprocess(jd_text)
    log.info(f"Preprocessed JD: {len(clean_jd.split())} words")

    jd_emb = encoder.encode([clean_jd])[0]
    log.info(f"JD embedding: {jd_emb.shape}")

    valid = [r for r in resumes if r["text"].strip()]
    failed = [r for r in resumes if not r["text"].strip()]

    if not valid:
        return {"results": [], "totalProcessed": 0, "failedResumes": failed}

    clean_texts = [preprocess(r["text"][:5000]) for r in valid]
    resume_embs = encoder.encode(clean_texts)
    log.info(f"Encoded {len(valid)} resumes in {time.time() - t0:.1f}s")

    results = []
    for i, r in enumerate(valid):
        sem = cosine_sim(jd_emb, resume_embs[i])
        rt = key_terms(clean_texts[i])
        jt = key_terms(clean_jd)
        kw = jaccard(rt, jt)
        combined = sem * 0.70 + kw * 0.30
        raw = round(min(100, max(0, combined * 100)))

        matched = sorted(rt & jt)[:20]
        missing = sorted(jt - rt)[:20]

        results.append({
            "resumeName": r["name"],
            "rawScore": raw,
            "normalizedScore": 0,
            "matchSummary": (
                f"This candidate shows {match_label(raw)} alignment with the job requirements. "
                f"Semantic match: {round(sem * 100)}% (contextual understanding), "
                f"Keyword match: {round(kw * 100)}% (exact skill overlap). "
                f"Overall score: {raw}/100."
            ),
            "skillsMatched": matched,
            "skillsMissing": missing,
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

    elapsed = time.time() - t0
    log.info(f"Scored {len(results)} resumes in {elapsed:.1f}s ({elapsed / max(len(results), 1):.2f}s/resume)")
    return {"results": results, "totalProcessed": len(results), "failedResumes": failed}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 scorer_cli.py <input.json> <output.json>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r") as f:
        data = json.load(f)

    jd = data["jobDescription"]
    resume_entries = data["resumes"]

    parsed = []
    failed = []
    for entry in resume_entries:
        try:
            text = extract_text(entry["path"], entry["name"])
            if text.strip():
                parsed.append({"name": entry["name"], "text": text})
            else:
                failed.append({"name": entry["name"], "error": "No text extracted"})
        except Exception as e:
            log.error(f"Failed {entry['name']}: {e}")
            failed.append({"name": entry["name"], "error": str(e)})

    if not parsed:
        output = {"results": [], "totalProcessed": 0, "totalFailed": len(failed), "failedResumes": failed}
    else:
        result = score_resumes(jd, parsed)
        output = {
            "results": result["results"],
            "totalProcessed": result["totalProcessed"],
            "totalFailed": len(failed),
            "failedResumes": failed,
        }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(json.dumps({"success": True, "totalProcessed": output["totalProcessed"]}))


if __name__ == "__main__":
    main()
