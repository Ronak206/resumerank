"""
Lightweight ONNX encoder — pure onnxruntime + transformers tokenizer.

No optimum, no sentence-transformers, no torch.
~30MB (onnxruntime) instead of ~2GB (torch).

Uses all-MiniLM-L6-v2 ONNX model from HuggingFace Hub.
"""

import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer
from huggingface_hub import hf_hub_download

import warnings
warnings.filterwarnings("ignore")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_encoder = None


def get_encoder():
    """Lazy-load singleton encoder. Downloads ONNX model on first call (~80MB)."""
    global _encoder
    if _encoder is None:
        _encoder = _ONNXEncoder()
    return _encoder


class _ONNXEncoder:
    def __init__(self, model_name: str = MODEL_NAME):
        import logging
        self.log = logging.getLogger("resumerank")
        self.log.info(f"Loading ONNX encoder: {model_name} ...")
        t0 = __import__("time").time()

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Download the pre-exported ONNX model file
        onnx_path = hf_hub_download(
            repo_id=model_name,
            filename="onnx/model.onnx"
        )

        self.session = ort.InferenceSession(
            onnx_path,
            providers=["CPUExecutionProvider"]
        )

        self.log.info(f"ONNX encoder ready in {__import__('time').time() - t0:.1f}s")

    def encode(self, texts: list[str], normalize: bool = True, batch_size: int = 16) -> np.ndarray:
        """Encode texts into embeddings. Returns (N, 384) float32 array."""
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            inputs = self.tokenizer(
                batch, padding=True, truncation=True, max_length=512, return_tensors="np"
            )

            # Build feed dict from model's expected inputs
            feed = {}
            for inp in self.session.get_inputs():
                name = inp.name
                if name in inputs:
                    feed[name] = inputs[name].astype(np.int64)

            outputs = self.session.run(None, feed)

            # Mean pooling
            token_emb = outputs[0]
            mask = inputs["attention_mask"][:, :, np.newaxis].astype(np.float32)
            emb = np.sum(token_emb * mask, axis=1) / np.maximum(np.sum(mask, axis=1), 1e-9)

            if normalize:
                norms = np.linalg.norm(emb, axis=1, keepdims=True)
                emb = emb / np.maximum(norms, 1e-9)

            all_embeddings.append(emb.astype(np.float32))

        return np.vstack(all_embeddings) if all_embeddings else np.zeros((0, 384), dtype=np.float32)
