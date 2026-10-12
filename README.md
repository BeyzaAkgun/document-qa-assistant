# DocuMind — Document Q&A Assistant

A document question-answering application that retrieves relevant PDF passages and uses an LLM to generate answers with document names, PDF page numbers, and supporting text.

Built with FastAPI, PostgreSQL, pgvector, Sentence Transformers, Gemini API, React, and TypeScript.
![DocuMind interface showing a document-grounded answer and a citation to PDF page 2]
(docs/images/DocuMind.png)
## Features

- Upload text-based PDFs and extract text with PDF page numbers.
- Split text into overlapping, page-local chunks.
- Generate multilingual embeddings and store them in PostgreSQL with pgvector.
- Search only the documents selected by the user.
- Generate answers in Turkish or English.
- Display expandable source cards with filenames, page numbers, and retrieved passages.
- Ask the model to report insufficient evidence when the retrieved content cannot answer the question.
- Validate source IDs and their consistency with inline citations.
- Search the document list by filename.
- Show upload, loading, and API error states.

## How it works

### Document ingestion

1. Validate the uploaded PDF.
2. Extract text separately from each page using pypdf.
3. Split each page into overlapping chunks.
4. Encode chunks using `intfloat/multilingual-e5-small`.
5. Save document metadata, chunk text, page numbers, and embeddings.

### Question answering

1. Validate the question and selected document IDs.
2. Encode the question using the same embedding model.
3. Retrieve the nearest chunks using pgvector cosine distance.
4. Assign request-local source IDs such as `S1` and `S2`.
5. Send the question and retrieved passages to Gemini.
6. Validate the structured response and source IDs.
7. Attach source metadata from retrieved database records.

The embedding model runs on the application server's CPU.
Answer generation runs through the Gemini API. No model training is performed.

## Technology stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.12, FastAPI |
| Database | PostgreSQL 16, pgvector |
| ORM and migrations | SQLAlchemy, Alembic |
| PDF extraction | pypdf |
| Embeddings | Sentence Transformers, multilingual-e5-small |
| Generation | Gemini API, Google Gen AI SDK |
| Frontend | React 19, TypeScript, Vite 8 |
| Development infrastructure | Docker Compose, GitHub Codespaces |

### Retrieval configuration

- Embedding dimensions: `384`
- Chunk size: `150` tokens
- Chunk overlap: `40` tokens
- Document prefix: `passage:`
- Question prefix: `query:`
- Normalized embeddings
- Cosine distance search
- Frontend retrieval count: `top_k = 4`

Chunks do not cross PDF page boundaries.
The current implementation uses exact vector search without an approximate nearest-neighbor index.

## Setup

These instructions target Linux / GitHub Codespaces with Python 3.12
and an x86-64 CPU environment.

The pinned Python dependencies were successfully installed in a fresh
Python 3.12 virtual environment within the existing Linux Codespace.
Dependency checks and application imports passed. A complete setup
against a new, empty database has not yet been re-tested.

### Prerequisites

- Python 3.12 with venv support
- Node.js 22.12+ on the Node 22 line, or a compatible newer release
- npm
- Docker with Docker Compose
- A Gemini API key with access to the configured model

Internet access is required for dependency installation, the initial
embedding-model download, and Gemini requests.

### 1. Get the project

```bash
git clone https://github.com/BeyzaAkgun/document-qa-assistant.git
cd document-qa-assistant
```

If using an existing Codespace for this repository, use its current checkout.

### 2. Create the Python environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

If venv creation reports that `ensurepip` is unavailable, install the
matching venv package. On an Ubuntu environment providing Python 3.12:

```bash
sudo apt-get update
sudo apt-get install -y python3.12-venv
```

Then repeat the venv creation and activation commands.

### 3. Install dependencies

Install the CPU build of PyTorch first:

```bash
python -m pip install "torch==2.14.1+cpu" --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python -m pip check
```

The requirements file includes Linux-specific dependencies such as uvloop.
Native Windows and macOS installation have not been validated with this
dependency snapshot.

### 4. Configure environment variables

For a new setup:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
POSTGRES_USER=docqa
POSTGRES_PASSWORD=choose_a_local_development_password
POSTGRES_DB=docqa
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Do not overwrite an existing `.env` when restarting the project.
Do not commit API keys.

Model availability and quotas depend on the provider and account.
The model name is configurable through `GEMINI_MODEL`.

### 5. Start PostgreSQL and apply migrations

```bash
docker compose up -d
docker compose ps
```

Once the database is healthy:

```bash
python -m alembic upgrade head
```

PostgreSQL data is stored in the Docker volume defined in `compose.yaml`.
Changing the password in `.env` does not change the password of an
already initialized database.

### 6. Start the backend

From the repository root with the virtual environment active:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The first embedding operation may take longer while the model is downloaded
and loaded into memory.

### 7. Start the frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite forwards `/api/*` requests to FastAPI at `127.0.0.1:8000`,
removing the `/api` prefix.

For local development:

- Frontend: http://localhost:5173
- API documentation: http://localhost:8000/docs

In Codespaces, open ports `5173` and `8000` through the **Ports** panel.
Use the forwarded `app.github.dev` URLs rather than your computer's localhost.
Keep the forwarded ports private.

The Vite proxy is a development configuration. Production hosting requires
separate API routing configuration; building the frontend alone does not
configure that routing.

## Usage

1. Upload a text-based PDF.
2. Select one or more documents from the library.
3. Enter a question.
4. Choose Turkish or English as the answer language.
5. Open the source cards to inspect the retrieved passages and PDF pages.

Uploading a document does not automatically select it.
Repeated uploads currently create separate document records.

## Demo documents

The PDFs in [`examples/`](examples/) contain fictional company procedures.
They are provided for demonstration and manual evaluation.

| Document | Question | Expected information |
| --- | --- | --- |
| Access procedure | Who approves access requests? | Department manager — PDF page 1 |
| Access procedure | How long does an approved request take? | Two business days — PDF page 1 |
| Travel procedure | Seyahat masraf iadesine kaç iş günü içinde başvurmalıyım? | Five business days after the trip ends — PDF page 2 |
| Either procedure | What is the company's annual revenue? | Insufficient information |

Upload the demo PDFs through the interface and select the relevant documents.
Document IDs are assigned by your database and may differ from the examples
shown elsewhere in this README.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Application health |
| GET | `/health/db` | Database and pgvector availability |
| POST | `/documents/preview` | Extract and preview PDF pages and chunks without saving |
| POST | `/documents` | Process and save a PDF |
| GET | `/documents` | List documents and chunk counts |
| POST | `/search` | Retrieve relevant chunks |
| POST | `/ask` | Generate an answer with validated source references |

Example `/ask` request:

```json
{
  "question": "Who approves access requests?",
  "document_ids": [3],
  "top_k": 4,
  "answer_language": "en"
}
```

Replace `3` with an ID returned by your own document upload or listing.

## Development checks

```bash
python -m pip check
```

```bash
cd frontend
npm run build
npm run lint
```

Optional scripts, run from the repository root:

```bash
python benchmark_embeddings.py
python list_gemini_models.py
python check_gemini.py
python check_grounded_answer.py
```

The Gemini scripts require an API key. Generation scripts consume API quota.

### Manually checked scenarios

The following behaviors were observed with fictional procedure documents:

- Direct questions return the expected answer and source.
- Paraphrased questions retrieve supporting information.
- English questions can be answered using Turkish source text.
- The selected answer language is respected in the tested examples.
- Questions about missing information return insufficient-evidence responses.
- A travel reimbursement question cites PDF page 2 of the travel procedure.
- Excluding the travel document prevents it from being used as a source.
- The React interface supports upload, selection, questions, and source display.
- Blank PDFs are rejected with an informative extraction error.
- Image-only PDFs are rejected with a message explaining that OCR is unsupported.rm -r -- .venv-verify

These are manual scenario checks, not a comprehensive evaluation benchmark.
Frontend build and lint checks also passed in the development environment.

## Limitations and data handling

- Only text-based PDFs are supported; OCR is not implemented.
- Upload limits are 10 MiB and 50 pages.
- Pages without extractable text are skipped and reported during upload.
- Multi-column layouts and tables may produce an incorrect reading order.
- Token-based chunks can split sentences or words.
- Retrieval quality depends on document structure and the embedding model.
- Similarity scores are not answer-confidence probabilities.
- Source validation checks IDs and citation consistency, not factual entailment.
- LLMs can still misinterpret sources or fail to abstain.
- Prompt instructions are not a complete defense against prompt injection.
- Relevant retrieved passages and questions are sent to Gemini.
- Provider data policies and quotas apply; use fictional or non-sensitive
  documents for demonstrations.
- Original PDFs are not retained by the application; extracted text,
  metadata, and embeddings are stored in PostgreSQL.
- No authentication, per-user isolation, document deletion, conversation
  history, or background ingestion queue is implemented.
- This version is intended for private development and portfolio demonstrations,
  not an unrestricted public upload service.

## Project structure

- `backend/app/`: API routes, database models, schemas, and processing services
- `migrations/`: Alembic database migrations
- `frontend/src/`: React UI, API client, and TypeScript types
- `compose.yaml`: PostgreSQL and pgvector development service
- `.env.example`: configuration template
- `requirements.txt`: pinned Python environment dependencies