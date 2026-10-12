from fastapi import FastAPI, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.app.database import engine

from backend.app.pdf_service import (
    MAX_FILE_BYTES,
    PDFPreview,
    PDFProcessingError,
    extract_pdf,
)

from backend.app.chunking import TextChunk, chunk_pages
import logging

from backend.app.document_service import save_document
from backend.app.schemas import DocumentResponse,AskRequest

from backend.app.retrieval_service import (
    DocumentNotFoundError,
    retrieve_chunks,
)
from backend.app.schemas import SearchRequest, SearchResponse
from backend.app.document_service import list_documents
from backend.app.schemas import DocumentListItem,AskResponse, SearchRequest

import httpx
from google.genai import errors as genai_errors
from backend.app.llm_service import (
    InvalidLLMResponseError,
    LLMConfigurationError,
)
from backend.app.qa_service import (
    NoSearchResultsError,
    answer_question,
)


logger = logging.getLogger(__name__)

class PDFChunkPreview(PDFPreview):
    chunks: list[TextChunk]

app = FastAPI(
    title="Document Q&A Assistant",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def database_health_check() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            version = connection.execute(
                text(
                    "SELECT extversion FROM pg_extension "
                    "WHERE extname = 'vector'"
                )
            ).scalar_one_or_none()
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed.",
        ) from None

    if version is None:
        raise HTTPException(
            status_code=503,
            detail="pgvector extension is not enabled.",
        )

    return {
        "status": "ok",
        "database": "connected",
        "pgvector_version": version,
    }

@app.post("/documents/preview", response_model=PDFChunkPreview)
def preview_document(file: UploadFile) -> PDFChunkPreview:
    filename = (file.filename or "").replace("\\", "/").split("/")[-1]

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=415,
            detail="Please upload a PDF file.",
        )

    data = file.file.read(MAX_FILE_BYTES + 1)

    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="PDF size must not exceed 10 MiB.",
        )

    try:
        preview = extract_pdf(data, filename)
    except PDFProcessingError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    chunks = chunk_pages(preview.pages)

    return PDFChunkPreview(
        **preview.model_dump(),
        chunks=chunks,
    )


@app.post(
    "/documents",
    response_model=DocumentResponse,
    status_code=201,
)
def upload_document(file: UploadFile) -> DocumentResponse:
    preview = preview_document(file)

    try:
        return save_document(preview, preview.chunks)
    except SQLAlchemyError:
        logger.exception("Failed to save document")
        raise HTTPException(
            status_code=503,
            detail="Document could not be saved. Please try again.",
        ) from None


@app.post("/search", response_model=SearchResponse)
def search_documents(request: SearchRequest) -> SearchResponse:
    try:
        results = retrieve_chunks(request)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
    except SQLAlchemyError:
        logger.exception("Document search failed")
        raise HTTPException(
            status_code=503,
            detail="Document search is temporarily unavailable.",
        ) from None

    return SearchResponse(
        question=request.question,
        results=results,
    )

@app.get("/documents", response_model=list[DocumentListItem])
def get_documents():
    try:
        return list_documents()
    except SQLAlchemyError:
        logger.exception("Failed to list documents")
        raise HTTPException(
            status_code=503,
            detail="Documents could not be listed. Please try again.",
        )


@app.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest):
    try:
        return answer_question(request)

    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    except NoSearchResultsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except LLMConfigurationError:
        raise HTTPException(
            status_code=503,
            detail="The answer service is not configured.",
        ) from None

    except InvalidLLMResponseError:
        raise HTTPException(
            status_code=502,
            detail="The model returned an invalid or unverified answer. Please retry.",
        ) from None

    except genai_errors.APIError as exc:
        logger.warning("Gemini request failed with code %s", exc.code)

        if exc.code == 429:
            raise HTTPException(
                status_code=503,
                detail="The answer service quota or rate limit was reached. Please try later.",
            ) from None

        raise HTTPException(
            status_code=502,
            detail="The answer provider could not complete the request.",
        ) from None

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="The answer provider timed out. Please retry.",
        ) from None

    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="The answer provider could not be reached.",
        ) from None

    except SQLAlchemyError:
        logger.exception("Database operation failed while answering")
        raise HTTPException(
            status_code=503,
            detail="The document database is temporarily unavailable.",
        ) from None

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc