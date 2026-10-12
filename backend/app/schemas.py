from datetime import datetime

from pydantic import BaseModel

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, PositiveInt, StringConstraints
from typing import Literal

class DocumentResponse(BaseModel):
    id: int
    filename: str
    page_count: int
    chunk_count: int
    created_at: datetime
    pages_without_text: list[int]

class SearchRequest(BaseModel):
    question: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=1000,
        ),
    ]
    document_ids: list[PositiveInt] = Field(
        min_length=1,
        max_length=20,
    )
    top_k: int = Field(default=4, ge=1, le=10)


class SearchResult(BaseModel):
    chunk_id: int
    document_id: int
    filename: str
    page_number: int
    text: str
    similarity: float


class SearchResponse(BaseModel):
    question: str
    results: list[SearchResult]

class DocumentListItem(BaseModel):
    id: int
    filename: str
    page_count: int
    chunk_count: int
    created_at: datetime

class GeneratedAnswer(BaseModel):
    answer: str = Field(
        min_length=1,
        description=(
            "Answer in the explicitly requested answer language. "
            "When evidence is sufficient, include inline citations "
            "such as [S1] after supported statements. "
            "When evidence is insufficient, explain this without citations."
        ),
    )
    source_ids: list[str] = Field(
        description=(
            "Exactly the source IDs cited inline in answer, "
            "without brackets, for example ['S1']. "
            "Empty when evidence is insufficient."
        ),
    )
    insufficient_evidence: bool = Field(
        description="True when the sources cannot sufficiently answer the question."
    )

class AnswerSource(BaseModel):
    source_id: str
    chunk_id: int
    document_id: int
    filename: str
    page_number: int
    text: str


class AskResponse(BaseModel):
    question: str
    answer: str
    insufficient_evidence: bool
    sources: list[AnswerSource]

class AskRequest(SearchRequest):
    answer_language: Literal["tr", "en"] = "tr"