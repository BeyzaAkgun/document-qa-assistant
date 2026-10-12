export interface DocumentListItem {
  id: number;
  filename: string;
  page_count: number;
  chunk_count: number;
  created_at: string;
}

export interface DocumentUploadResponse extends DocumentListItem {
  pages_without_text: number[];
}

export type AnswerLanguage = "tr" | "en";

export interface AskRequest {
  question: string;
  document_ids: number[];
  top_k: number;
  answer_language: AnswerLanguage;
}

export interface AnswerSource {
  source_id: string;
  chunk_id: number;
  document_id: number;
  filename: string;
  page_number: number;
  text: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  insufficient_evidence: boolean;
  sources: AnswerSource[];
}
