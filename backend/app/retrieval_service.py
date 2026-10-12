from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database import engine
from backend.app.embedding_service import embed_query
from backend.app.models import Chunk, Document
from backend.app.schemas import SearchRequest, SearchResult


class DocumentNotFoundError(ValueError):
    pass


def retrieve_chunks(request: SearchRequest) -> list[SearchResult]:
    document_ids = sorted(set(request.document_ids))

    with Session(engine) as session:
        existing_ids = set(
            session.scalars(
                select(Document.id).where(
                    Document.id.in_(document_ids)
                )
            ).all()
        )

    missing_ids = set(document_ids) - existing_ids

    if missing_ids:
        raise DocumentNotFoundError(
            f"Documents not found: {sorted(missing_ids)}"
        )

    query_vector = embed_query(request.question)

    distance = Chunk.embedding.cosine_distance(query_vector)

    statement = (
        select(
            Chunk,
            Document.filename,
            distance.label("distance"),
        )
        .join(Document, Document.id == Chunk.document_id)
        .where(Chunk.document_id.in_(document_ids))
        .order_by(distance, Chunk.id)
        .limit(request.top_k)
    )

    with Session(engine) as session:
        rows = session.execute(statement).all()

        return [
            SearchResult(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                filename=filename,
                page_number=chunk.page_number,
                text=chunk.text,
                similarity=1.0 - float(cosine_distance),
            )
            for chunk, filename, cosine_distance in rows
        ]