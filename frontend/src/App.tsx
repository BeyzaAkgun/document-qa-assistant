import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { askQuestion, getDocuments, uploadDocument } from "./api";
import type { AnswerLanguage, AskResponse, DocumentListItem } from "./types";

type IconName =
  "file" | "upload" | "search" | "spark" | "arrow" | "check" | "help" | "book";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    file: "M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5m-5 4h5",
    upload: "M12 16V4m-4 4 4-4 4 4M5 15v5h14v-5",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    spark: "m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z",
    arrow: "m4 12 16-8-6 16-3-7-7-1Zm7 1 9-9",
    check: "m5 12 4 4L19 6",
    help: "M9 9a3 3 0 1 1 4 2.8c-1 .4-1 1.2-1 2.2M12 17v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    book: "M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4V4Zm10 3a3 3 0 0 1 3-3h4v14h-3a4 4 0 0 0-4 3",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<AnswerLanguage>("tr");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const askRef = useRef<AbortController | null>(null);
  const uploadRef = useRef<AbortController | null>(null);
  const busy = asking || uploading;
  const uploadDisabled = busy || loading || Boolean(loadError);

  useEffect(() => {
    const controller = new AbortController();
    getDocuments(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDocuments(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadCount]);

  useEffect(
    () => () => {
      askRef.current?.abort();
      uploadRef.current?.abort();
    },
    [],
  );

  function clearAnswer() {
    setResult(null);
    setAskError("");
  }

  function toggleDocument(id: number) {
    if (busy) return;
    clearAnswer();
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 20
          ? [...current, id]
          : current,
    );
  }

  function chooseFile(file?: File) {
    if (!file || uploadDisabled) return;
    setFileError("");
    setUploadMessage("");
    setPendingFile(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Please choose a PDF file.");
    } else if (!file.size || file.size > 10 * 1024 * 1024) {
      setFileError("Choose a non-empty PDF up to 10 MiB.");
    } else {
      setPendingFile(file);
    }
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadDisabled) return;
    if (!pendingFile) {
      inputRef.current?.click();
      return;
    }
    const controller = new AbortController();
    uploadRef.current = controller;
    setUploading(true);
    setFileError("");
    setUploadMessage("");
    try {
      const document = await uploadDocument(pendingFile, controller.signal);
      if (controller.signal.aborted) return;
      setDocuments((current) => [document, ...current]);
      setPendingFile(null);
      const skipped = document.pages_without_text;
      setUploadMessage(
        skipped.length
          ? `Uploaded. No text was extracted from pages ${skipped.join(", ")}. Select the document in your library to ask questions.`
          : "Uploaded and ready. Select the document in your library to ask questions.",
      );
    } catch (error) {
      if (!controller.signal.aborted) setFileError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) {
        setUploading(false);
        uploadRef.current = null;
      }
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !query.trim() || !selectedIds.length) return;
    const controller = new AbortController();
    askRef.current = controller;
    setAsking(true);
    clearAnswer();
    try {
      const answer = await askQuestion(
        {
          question: query.trim(),
          document_ids: [...selectedIds],
          top_k: 4,
          answer_language: language,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(answer);
    } catch (error) {
      if (!controller.signal.aborted) setAskError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) {
        setAsking(false);
        askRef.current = null;
      }
    }
  }

  const visibleDocuments = documents.filter((document) =>
    document.filename
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <main className="workspace">
      <aside className="library" aria-labelledby="library-heading">
        <a className="brand" href="#question-heading">
          <span className="brand-icon">
            <Icon name="book" size={23} />
          </span>
          <span>
            <strong>DocuMind</strong>
            <small>Knowledge workspace</small>
          </span>
        </a>
        <div className="library-heading">
          <div>
            <p className="eyebrow">Your library</p>
            <h2 id="library-heading">Documents</h2>
          </div>
          <span className="file-count">{documents.length} files</span>
        </div>
        <label className="search-box">
          <Icon name="search" size={17} />
          <span className="sr-only">Search documents by filename</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search documents"
            type="search"
          />
        </label>
        <div className="document-list" aria-busy={loading}>
          {loading && (
            <p className="library-note" role="status">
              Loading your documents...
            </p>
          )}
          {loadError && (
            <div className="library-error" role="alert">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError("");
                  setLoading(true);
                  setReloadCount((n) => n + 1);
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !loadError && !documents.length && (
            <p className="library-note">
              Your library is empty. Upload a PDF to get started.
            </p>
          )}
          {!loading &&
            !loadError &&
            documents.length > 0 &&
            !visibleDocuments.length && (
              <p className="library-note">No documents match your search.</p>
            )}
          {!loadError &&
            visibleDocuments.map((document) => {
              const selected = selectedIds.includes(document.id);
              return (
                <button
                  type="button"
                  key={document.id}
                  className={`document-item${selected ? " selected" : ""}`}
                  aria-pressed={selected}
                  disabled={busy || (!selected && selectedIds.length >= 20)}
                  onClick={() => toggleDocument(document.id)}
                  title={document.filename}
                >
                  <span className="document-icon">
                    <Icon name="file" size={19} />
                  </span>
                  <span className="document-info">
                    <strong>{document.filename}</strong>
                    <small>
                      {document.page_count}{" "}
                      {document.page_count === 1 ? "page" : "pages"} ·{" "}
                      {document.chunk_count}{" "}
                      {document.chunk_count === 1 ? "chunk" : "chunks"} · ID{" "}
                      {document.id}
                    </small>
                  </span>
                  <span className="selection-indicator">
                    {selected && <Icon name="check" size={12} />}
                  </span>
                </button>
              );
            })}
        </div>
        <div className="selection-footer">
          <div>
            <small>Documents selected</small>
            <strong>{selectedIds.length} of 20</strong>
          </div>
          <button
            type="button"
            className="clear-button"
            disabled={busy || !selectedIds.length}
            onClick={() => {
              setSelectedIds([]);
              clearAnswer();
            }}
          >
            Clear all
          </button>
        </div>
      </aside>

      <section className="main-panel" aria-label="Document question workspace">
        <header className="topbar">
          <div>
            <strong>Document Q&A</strong>
            <p>Answers with document citations</p>
          </div>
          <div className="topbar-actions">
            <span className="language-badge">TR / EN</span>
            <button
              type="button"
              className="help-button"
              aria-label="How to use this assistant"
              onClick={() => helpRef.current?.showModal()}
            >
              <Icon name="help" size={18} />
            </button>
          </div>
        </header>
        <div className="main-content">
          <div className="intro">
            <span className="intro-badge">
              <Icon name="spark" size={13} /> AI-powered research
            </span>
            <h1>
              Ask your documents.
              <br />
              <span>Find what matters.</span>
            </h1>
            <p>
              Upload your PDFs, select your sources, and get clear answers
              grounded in your content.
            </p>
          </div>

          <div className="action-grid">
            <section
              className="card upload-card"
              aria-labelledby="upload-heading"
            >
              <div className="card-heading">
                <div>
                  <p className="step">Step 01</p>
                  <h2 id="upload-heading">Upload a PDF</h2>
                </div>
                <span className="upload-badge">
                  <Icon name="upload" size={19} />
                </span>
              </div>
              <form onSubmit={submitUpload}>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  disabled={uploadDisabled}
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <div
                  className={`drop-zone${dragging ? " dragging" : ""}${pendingFile ? " has-file" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!uploadDisabled) setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    )
                      setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (uploadDisabled) return;
                    if (event.dataTransfer.files.length !== 1) {
                      setFileError("Please drop one PDF at a time.");
                      return;
                    }
                    chooseFile(event.dataTransfer.files[0]);
                  }}
                >
                  <span className="drop-icon">
                    <Icon name={pendingFile ? "file" : "upload"} size={24} />
                  </span>
                  <strong>
                    {pendingFile ? pendingFile.name : "Drop your PDF here"}
                  </strong>
                  <span>
                    {pendingFile
                      ? `${(pendingFile.size / 1024 / 1024).toFixed(2)} MiB · Ready to upload`
                      : "or choose a file below"}
                  </span>
                  {pendingFile && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={uploadDisabled}
                      onClick={() => inputRef.current?.click()}
                    >
                      Change file
                    </button>
                  )}
                </div>
                <div className="upload-footer">
                  <p>
                    Text-based PDF · Max 10 MiB
                    <br />
                    Up to 50 pages · No OCR
                  </p>
                  <button
                    type="submit"
                    className="button dark-button"
                    disabled={uploadDisabled}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner" /> Processing...
                      </>
                    ) : pendingFile ? (
                      "Upload PDF"
                    ) : (
                      "Choose a PDF"
                    )}
                  </button>
                </div>
              </form>
              {fileError && (
                <p className="error-message" role="alert">
                  {fileError}
                </p>
              )}
              {uploadMessage && (
                <p className="success-message" role="status">
                  {uploadMessage}
                </p>
              )}
              {uploading && (
                <p className="fine-print" role="status">
                  Extracting text and preparing your PDF for search...
                </p>
              )}
            </section>

            <section
              className="card question-card"
              aria-labelledby="question-heading"
            >
              <div className="card-heading">
                <div>
                  <p className="step">Step 02</p>
                  <h2 id="question-heading">Ask your documents</h2>
                </div>
                <span className="selected-badge">
                  {selectedIds.length} selected
                </span>
              </div>
              <form onSubmit={submitQuestion}>
                <label className="field-label" htmlFor="question">
                  Your question
                </label>
                <div className="question-input">
                  <textarea
                    id="question"
                    placeholder="Ask anything about your selected documents..."
                    value={query}
                    maxLength={1000}
                    rows={4}
                    required
                    disabled={asking}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      clearAnswer();
                    }}
                  />
                  <div className="question-meta">
                    <span>
                      <Icon name="file" size={13} /> Grounded in selected files
                    </span>
                    <span>{query.length}/1000</span>
                  </div>
                </div>
                <div className="question-footer">
                  <div>
                    <label className="field-label" htmlFor="language">
                      Answer language
                    </label>
                    <select
                      id="language"
                      value={language}
                      disabled={asking}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "tr" || value === "en") {
                          setLanguage(value);
                          clearAnswer();
                        }
                      }}
                    >
                      <option value="tr">Türkçe</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="button lime-button"
                    disabled={
                      busy ||
                      loading ||
                      Boolean(loadError) ||
                      !query.trim() ||
                      !selectedIds.length
                    }
                  >
                    {asking ? (
                      <>
                        <span className="spinner" /> Thinking...
                      </>
                    ) : (
                      <>
                        Ask question <Icon name="arrow" size={17} />
                      </>
                    )}
                  </button>
                </div>
              </form>
              {!selectedIds.length && (
                <p className="selection-hint">
                  Select at least one document from your library.
                </p>
              )}
              <p className="privacy-note">
                Relevant passages from selected files are sent to Gemini. Use
                fictional or non-sensitive documents.
              </p>
              {asking && (
                <p className="fine-print" role="status">
                  Finding relevant passages and generating your answer...
                </p>
              )}
              {askError && (
                <p className="error-message" role="alert">
                  {askError}
                </p>
              )}
            </section>
          </div>

          {result && (
            <section className="answer-card" aria-labelledby="answer-heading">
              <div className="answer-heading">
                <div>
                  <span className="answer-icon">
                    <Icon name="spark" size={18} />
                  </span>
                  <h2 id="answer-heading">Answer</h2>
                </div>
                <span>{language === "tr" ? "Türkçe" : "English"}</span>
              </div>
              {result.insufficient_evidence && (
                <p className="insufficient-notice" role="status">
                  Insufficient information in the selected documents.
                </p>
              )}
              <p className="answer-text">{result.answer}</p>
              {result.sources.length > 0 && (
                <div className="sources">
                  <h3>Sources</h3>
                  {result.sources.map((source) => (
                    <details className="source-card" key={source.source_id}>
                      <summary>
                        <span className="source-id">[{source.source_id}]</span>
                        <span className="source-filename">
                          {source.filename}
                        </span>
                        <span className="source-page">
                          PDF page {source.page_number}
                        </span>
                      </summary>
                      <div className="source-body">
                        <p className="source-caption">Supporting passage</p>
                        <p className="source-text">{source.text}</p>
                      </div>
                    </details>
                  ))}
                </div>
              )}
              <p className="answer-footnote">
                Check the supporting passages. AI-generated answers can contain
                errors.
              </p>
            </section>
          )}
          {!result && !asking && (
            <p className="workspace-footnote">
              <Icon name="book" size={15} /> Your answer and supporting passages
              will appear here.
            </p>
          )}
        </div>
      </section>
      <dialog
        ref={helpRef}
        className="help-dialog"
        aria-labelledby="help-title"
      >
        <h2 id="help-title">Your documents, with context.</h2>
        <ol>
          <li>Upload a text-based PDF.</li>
          <li>Select up to 20 documents in the library.</li>
          <li>Ask a question and choose Turkish or English.</li>
          <li>Open each source to inspect the passage and PDF page.</li>
        </ol>
        <p>
          Scanned PDFs need OCR, which this version does not support. Citations
          identify retrieved passages; they do not guarantee that the answer
          interpreted them correctly.
        </p>
        <form method="dialog">
          <button className="button dark-button">Got it</button>
        </form>
      </dialog>
    </main>
  );
}
