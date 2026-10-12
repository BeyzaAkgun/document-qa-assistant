import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { uploadDocument } from "../api";
import type { DocumentUploadResponse } from "../types";

interface UploadFormProps {
  onUploaded: (document: DocumentUploadResponse) => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function UploadForm({ onUploaded }: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (uploading) return;

    setError(null);
    setMessage(null);

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Please select a PDF.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setError("Please select a non-empty PDF up to 10 MiB.");
      return;
    }

    setUploading(true);

    try {
      const document = await uploadDocument(file);

      onUploaded(document);

      const skippedPages = document.pages_without_text;

      setMessage(
        skippedPages.length > 0
          ? `Uploaded successfully. No text was extracted from pages: ${skippedPages.join(", ")}.`
          : "Uploaded successfully. The document is ready for questions.",
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The upload could not be completed.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="upload-heading">
      <h2 id="upload-heading">Upload a PDF</h2>
      <p>Text-based PDFs only. Maximum 10 MiB and 50 pages. OCR is not supported.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="pdf-file">PDF file</label>

        <input
          ref={fileInputRef}
          id="pdf-file"
          type="file"
          accept=".pdf,application/pdf"
          disabled={uploading}
          required
        />

        <button type="submit" disabled={uploading}>
          {uploading ? "Processing PDF..." : "Upload PDF"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}