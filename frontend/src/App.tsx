import { useEffect, useState } from "react";

import { getDocuments } from "./api";
import UploadForm from "./components/UploadForm";
import type {
  DocumentListItem,
  DocumentUploadResponse,
} from "./types";
import QuestionForm from "./components/QuestionForm";

function App() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      try {
        const data = await getDocuments(controller.signal);

        if (!controller.signal.aborted) {
          setDocuments(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => controller.abort();
  }, []);

  function handleUploaded(document: DocumentUploadResponse) {
    setDocuments((current) => [document, ...current]);
  }

  function toggleDocument(id: number) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }

      if (current.length >= 20) {
        return current;
      }

      return [...current, id];
    });
  }

  return (
    <main>
      <header>
        <h1>Document Q&A Assistant</h1>
        <p>Ask questions about your PDFs and inspect the sources.</p>
      </header>

      {loading && <p role="status">Loading documents...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <UploadForm onUploaded={handleUploaded} />

          <section aria-labelledby="documents-heading">
            <h2 id="documents-heading">Documents</h2>
            <p>
              Select up to 20 documents to use for your question.
              {" "}Selected: {selectedIds.length}
            </p>

            {documents.length === 0 ? (
              <p>No documents uploaded yet.</p>
            ) : (
              <ul className="document-list">
                {documents.map((document) => {
                  const selected = selectedIds.includes(document.id);

                  return (
                    <li key={document.id} className="document-card">
                      <label className="document-option">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!selected && selectedIds.length >= 20}
                          onChange={() => toggleDocument(document.id)}
                        />

                        <span>
                          <strong>{document.filename}</strong>
                          <span className="document-meta">
                            ID: {document.id} · Pages: {document.page_count}
                            {" · "}Chunks: {document.chunk_count}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <QuestionForm
          key={selectedIds.join(",")}
          documentIds={selectedIds}
          />
        </>
      )}
    </main>
  );
}

export default App;