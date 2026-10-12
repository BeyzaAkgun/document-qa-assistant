from sqlalchemy.orm import Session
from sqlalchemy import func, select

from backend.app.chunking import TextChunk
from backend.app.database import engine
from backend.app.embedding_service import embed_passages
from backend.app.models import Chunk, Document
from backend.app.pdf_service import PDFPreview
from backend.app.schemas import DocumentResponse
from backend.app.schemas import DocumentListItem


def save_document(
    preview: PDFPreview,
    chunks: list[TextChunk],
) -> DocumentResponse:
    if not chunks:
        raise ValueError("No text chunks were produced.")

    vectors = embed_passages([chunk.text for chunk in chunks])

    with Session(engine) as session:
        with session.begin():
            document = Document(
                filename=preview.filename,
                page_count=preview.page_count,
            )

            session.add(document)
            session.flush()

            for chunk, vector in zip(chunks, vectors, strict=True):
                session.add(
                    Chunk(
                        document_id=document.id,
                        page_number=chunk.page_number,
                        chunk_index=chunk.chunk_index,
                        text=chunk.text,
                        embedding=vector,
                    )
                )

            response = DocumentResponse(
                id=document.id,
                filename=document.filename,
                page_count=document.page_count,
                chunk_count=len(chunks),
                created_at=document.created_at,
                pages_without_text=preview.pages_without_text,
            )

        return response

def list_documents() -> list[DocumentListItem]:
    statement = (
        select(
            Document.id,
            Document.filename,
            Document.page_count,
            Document.created_at,
            func.count(Chunk.id).label("chunk_count"),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .group_by(
            Document.id,
            Document.filename,
            Document.page_count,
            Document.created_at,
        )
        .order_by(Document.created_at.desc(), Document.id.desc())
    )

    with Session(engine) as session:
        rows = session.execute(statement).mappings().all()

    return [
        DocumentListItem.model_validate(dict(row))
        for row in rows
    ]