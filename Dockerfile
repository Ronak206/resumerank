# ──────────────────────────────────────────────────────────────
# ResumeRank Python Backend — Simple ONNX Docker image
#
# Only uses onnxruntime (~30MB) — no torch, no optimum.
# Total image: ~400MB. Model downloads at runtime (~80MB).
# ──────────────────────────────────────────────────────────────

FROM python:3.11-slim

WORKDIR /app

COPY python-backend/requirements-deploy.txt .

RUN pip install --no-cache-dir -r requirements-deploy.txt

COPY python-backend/encoder.py python-backend/scorer.py ./

ENV HF_HOME=/app/.hf_cache
RUN mkdir -p /app/.hf_cache

EXPOSE 8001

CMD ["uvicorn", "scorer:app", "--host", "0.0.0.0", "--port", "8001"]
