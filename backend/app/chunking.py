from functools import lru_cache

from pydantic import BaseModel
from transformers import AutoTokenizer

from backend.app.pdf_service import PageText


MODEL_NAME = "intfloat/multilingual-e5-small"
CHUNK_TOKENS = 150
OVERLAP_TOKENS = 40


class TextChunk(BaseModel):
    chunk_index: int
    page_number: int
    text: str
    token_count: int


@lru_cache(maxsize=1)
def get_tokenizer():
    return AutoTokenizer.from_pretrained(
        MODEL_NAME,
        use_fast=True,
    )


def chunk_pages(pages: list[PageText]) -> list[TextChunk]:
    tokenizer = get_tokenizer()
    chunks: list[TextChunk] = []

    for page in pages:
        encoded = tokenizer(
            page.text,
            add_special_tokens=False,
            return_offsets_mapping=True,
            truncation=False,
        )

        offsets = encoded["offset_mapping"]
        start = 0

        while start < len(offsets):
            end = min(start + CHUNK_TOKENS, len(offsets))

            char_start = offsets[start][0]
            char_end = offsets[end - 1][1]
            chunk_text = page.text[char_start:char_end].strip()

            if chunk_text:
                token_count = len(
                    tokenizer(
                        f"passage: {chunk_text}",
                        add_special_tokens=True,
                        truncation=False,
                    )["input_ids"]
                )

                if token_count > 512:
                    raise ValueError(
                        "Chunk exceeds the embedding model's token limit."
                    )

                chunks.append(
                    TextChunk(
                        chunk_index=len(chunks),
                        page_number=page.page_number,
                        text=chunk_text,
                        token_count=token_count,
                    )
                )

            if end == len(offsets):
                break

            start = end - OVERLAP_TOKENS

    return chunks