import type {
  AskRequest,
  AskResponse,
  DocumentListItem,
  DocumentUploadResponse,
} from "./types";

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? body.detail
        : null;
    // FastAPI may return a string or an array of validation errors.
    const message =
      typeof detail === "string"
        ? detail
        : response.status === 422
          ? "Please check your input and try again."
          : `The request could not be completed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getDocuments(
  signal?: AbortSignal,
): Promise<DocumentListItem[]> {
  return readResponse<DocumentListItem[]>(
    await fetch("/api/documents", { signal }),
  );
}

export async function uploadDocument(
  file: File,
  signal?: AbortSignal,
): Promise<DocumentUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  return readResponse<DocumentUploadResponse>(
    await fetch("/api/documents", { method: "POST", body, signal }),
  );
}

export async function askQuestion(
  request: AskRequest,
  signal?: AbortSignal,
): Promise<AskResponse> {
  return readResponse<AskResponse>(
    await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    }),
  );
}
