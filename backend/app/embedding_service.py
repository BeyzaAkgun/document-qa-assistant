from functools import lru_cache
from threading import Lock

import torch
from sentence_transformers import SentenceTransformer

from backend.app.chunking import MODEL_NAME


_model_lock = Lock()


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    torch.set_num_threads(2)
    return SentenceTransformer(MODEL_NAME, device="cpu")


def embed_passages(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    with _model_lock:
        model = get_embedding_model()

        vectors = model.encode(
            [f"passage: {text}" for text in texts],
            batch_size=4,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

    return vectors.tolist()

def embed_query(question: str) -> list[float]:
    with _model_lock:
        model = get_embedding_model()
        query_text = f"query: {question}"

        token_count = len(
            model.tokenizer(
                query_text,
                add_special_tokens=True,
                truncation=False,
            )["input_ids"]
        )

        if token_count > model.max_seq_length:
            raise ValueError("Question is too long. Please shorten it.")

        vector = model.encode(
            query_text,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

    return vector.tolist()