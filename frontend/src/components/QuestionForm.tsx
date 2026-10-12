import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { askQuestion } from "../api";
import type { AnswerLanguage, AskResponse } from "../types";

interface QuestionFormProps {
  documentIds: number[];
}

export default function QuestionForm({
  documentIds,
}: QuestionFormProps) {
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<AnswerLanguage>("tr");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (asking || !trimmedQuestion || documentIds.length === 0) {
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;

    setAsking(true);
    setError(null);
    setResult(null);

    try {
      const response = await askQuestion(
        {
          question: trimmedQuestion,
          document_ids: documentIds,
          top_k: 4,
          answer_language: language,
        },
        controller.signal,
      );

      if (!controller.signal.aborted) {
        setResult(response);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof Error
            ? err.message
            : "The question could not be answered.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setAsking(false);
        requestRef.current = null;
      }
    }
  }

  return (
    <section className="panel" aria-labelledby="question-heading">
      <h2 id="question-heading">Ask your documents</h2>

      <p className="muted">
        Relevant passages from the selected documents will be sent
        to Gemini to generate an answer.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="question">Your question</label>

        <textarea
          id="question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setResult(null);
            setError(null);
          }}
          placeholder="Who approves access requests?"
          rows={4}
          maxLength={1000}
          disabled={asking}
          required
        />

        <label htmlFor="answer-language">Answer language</label>

        <select
          id="answer-language"
          value={language}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "tr" || value === "en") {
              setLanguage(value);
              setResult(null);
              setError(null);
            }
          }}
          disabled={asking}
        >
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>

        {documentIds.length === 0 && (
          <p className="muted">
            Select at least one document above.
          </p>
        )}

        <button
          type="submit"
          disabled={
            asking ||
            documentIds.length === 0 ||
            question.trim().length === 0
          }
        >
          {asking ? "Finding an answer..." : "Ask question"}
        </button>
      </form>

      {asking && (
        <p role="status">
          Searching the selected documents and generating an answer...
        </p>
      )}

      {error && <p role="alert">{error}</p>}

      {result && (
        <section className="answer-section" aria-labelledby="answer-heading">
          <h3 id="answer-heading">Answer</h3>

          {result.insufficient_evidence && (
            <p className="notice">
              Insufficient information in the selected documents.
            </p>
          )}

          <p className="answer-text">{result.answer}</p>

          {result.sources.length > 0 && (
            <div>
              <h3>Sources</h3>

              {result.sources.map((source) => (
                <details
                  key={source.source_id}
                  className="source-card"
                >
                  <summary>
                    [{source.source_id}] {source.filename}
                    {" — "}PDF page {source.page_number}
                  </summary>

                  <p className="source-text">{source.text}</p>
                </details>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}