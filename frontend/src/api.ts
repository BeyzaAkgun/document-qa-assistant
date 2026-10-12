import type {
  AskRequest,
  AskResponse,
  DocumentListItem,
  DocumentUploadResponse,
} from "./types";

export async function getDocuments(
  signal?: AbortSignal,
): Promise<DocumentListItem[]> {
  const response = await fetch("/api/documents", { signal });

  if (!response.ok) {
    throw new Error(
      `Documents could not be loaded. HTTP ${response.status}`,
    );
  }

  return response.json();
}

export async function uploadDocument(
  file: File,
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed. HTTP ${response.status}`;

    try {
      const body: unknown = await response.json();

      if (
        typeof body === "object" &&
        body !== null &&
        "detail" in body &&
        typeof body.detail === "string"
      ) {
        message = body.detail;
      }
    } catch {
      // A proxy error may return a non-JSON response.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function askQuestion(
  request: AskRequest,
  signal?: AbortSignal,
): Promise<AskResponse> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);

    const message =
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : `The question could not be answered. HTTP ${response.status}`;

    throw new Error(message);
  }

  return response.json();
}