from backend.app.llm_service import generate_answer
from backend.app.retrieval_service import retrieve_chunks
from backend.app.schemas import (
    AnswerSource,
    AskResponse,
    AskRequest,
)


class NoSearchResultsError(RuntimeError):
    pass


def answer_question(request: AskRequest) -> AskResponse:
    chunks = retrieve_chunks(request)

    if not chunks:
        raise NoSearchResultsError(
            "No searchable content was found in the selected documents."
        )

    source_map = {
        f"S{index}": chunk
        for index, chunk in enumerate(chunks, start=1)
    }

    source_texts = {
        source_id: chunk.text
        for source_id, chunk in source_map.items()
    }

    generated = generate_answer(
        question=request.question,
        sources=source_texts,
        answer_language=request.answer_language,
    )

    sources = []

    for source_id in generated.source_ids:
        chunk = source_map[source_id]

        sources.append(
            AnswerSource(
                source_id=source_id,
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                filename=chunk.filename,
                page_number=chunk.page_number,
                text=chunk.text,
            )
        )

    return AskResponse(
        question=request.question,
        answer=generated.answer,
        insufficient_evidence=generated.insufficient_evidence,
        sources=sources,
    )