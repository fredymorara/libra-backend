# Smart Library OS: AI-Powered RAG Catalog

An enterprise-grade, full-stack library management system that modernizes traditional library catalogs. Instead of relying purely on exact title matching (OPAC), this system builds an **Agentic Retrieval-Augmented Generation (RAG)** pipeline. It dynamically ingests book metadata from multiple academic APIs, enriches it using LLMs, vectorizes it, and provides a conversational AI interface for users to query the library's physical/digital knowledge base.

---

## 🏗️ Tech Stack

### Frontend (User Interface & Integration)
- **Framework:** Next.js (App Router), React
- **Styling:** Tailwind CSS (Vanilla CSS focus, modern glassmorphism and bento grids)
- **Icons:** Lucide-React
- **State Management:** React Hooks (`useState`, `useEffect`)
- **API Communication:** Native `fetch` with REST endpoints

### Backend (Core Logic & Queueing)
- **Framework:** NestJS (Node.js, TypeScript)
- **Task Scheduling:** `@nestjs/schedule` (Cron jobs for rate-limit protection)
- **File Parsing:** `multer` (File Interceptors) & `csv-parser`
- **Security:** `@nestjs/throttler` (Rate Limiting), custom API Key Guards, JWT/bcrypt (Auth scaffolded)

### Database & Vector Storage
- **Database:** Neon Serverless PostgreSQL
- **ORM:** Drizzle ORM (`drizzle-kit` for migrations)
- **Vector Database:** `pgvector` extension for storing and querying semantic embeddings
- **Schema:** UUID primary keys, JSONB for unstructured metadata, Enum statuses.

### AI & Enrichment APIs
- **LLM Engine:** Google Gemini API (`gemini-3.5-flash` for synthesis, `text-embedding-004` for vectors)
- **Metadata Sources:** 
  - Google Books API (Descriptions, Authors)
  - OpenLibrary API (Table of Contents)
  - Semantic Scholar Graph API (Academic Abstracts, Citations, Fields of Study)

---

## 📂 Project Structure

### Backend Architecture (`/smart-library-backend`)
```text
src/
├── app.module.ts           # Root module wiring Schedule, Throttler, DB, and sub-modules
├── auth/                   # Authentication module (JWT, bcrypt, API Keys)
├── catalog/                # Book Ingestion & Management
│   ├── catalog.controller  # Endpoints: POST /ingest, POST /upload/csv, DELETE /:id
│   ├── catalog.service     # Fetches external APIs, chunks text, interacts with RagService
│   └── catalog.worker      # Cron background worker processing the ingestion queue
├── database/               # Neon + Drizzle setup
│   ├── drizzle.provider    # Database connection logic
│   └── schema/             
│       ├── documents.ts    # Parent books and LLM enriched text
│       ├── chunks.ts       # Vector embeddings (pgvector) mapped to parent docs
│       ├── queue.ts        # Pending CSV bulk upload jobs
│       └── users.ts        # Auth users
├── rag/                    # AI & Vector Search Engine
│   └── rag.service         # Gemini LLM generation, Embedding creation, Hybrid Search
└── search/                 # Standard REST search endpoints
```

### Frontend Architecture (`/smart-library-frontend`)
```text
src/app/
├── page.tsx                # "Library Control Center" - Dashboard for viewing Active Catalog, Bulk CSV Uploading, and Manual Ingest
├── chat/
│   └── page.tsx            # "Testing Sandbox" - Full-screen conversational AI interface to query the catalog
├── embed/
│   └── page.tsx            # "Intranet Integration" - Demo of the floating library chat widget for campus websites
└── layout.tsx              # Root layout injecting fonts and global Tailwind styles
```

---

## ⚙️ The RAG Flow & Core Mechanics

The true power of this system lies in its ingestion pipeline and hybrid search mechanics.

### 1. Multi-API LLM Enrichment (The Ingestion Pipeline)
When a book is ingested (either manually or via CSV), the `CatalogService` executes a highly choreographed data fetch:
1. **Google Books API:** Fetches the foundational metadata (Title, Author, Description).
2. **OpenLibrary API:** Attempts to fetch the book's Table of Contents.
3. **Semantic Scholar API:** If academic, fetches the paper abstract, citation counts, and fields of study.
4. **LLM Synthesis:** `RagService.synthesizeEnrichment()` injects all raw JSON data (and any custom CSV columns) into `gemini-3.5-flash`. The LLM reads the disparate data and writes a dense, cohesive semantic profile for the book.
5. **Vectorization:** The enriched profile is split into semantic paragraphs (chunks). `RagService.generateEmbedding()` hits the Gemini embedding model, converting chunks into floats.
6. **Storage:** The parent metadata is saved to `documents`, and the vectors are saved to `document_chunks` in Postgres using `pgvector`.

### 2. Rate-Limited Bulk CSV Ingestion
Because the Gemini Free Tier limits requests to 15 Requests Per Minute (RPM), synchronously processing a CSV of 5,000 books would instantly crash the system. 
- **The Queue:** Uploading a CSV (`POST /catalog/upload/csv`) parses the file and inserts every row into the `ingestion_queue` table as `PENDING`.
- **The Worker:** `CatalogWorker` runs a Cron job (`@Cron('*/5 * * * * *')`) every 5 seconds. It picks the oldest `PENDING` job, processes it through the pipeline, and marks it `COMPLETED`. This mathematically caps the system at 12 RPM, running safely 24/7.

### 3. Hybrid Semantic Search
When a user asks a question in the `/chat` sandbox:
1. `RagService.hybridSearch(query)` is triggered.
2. **Vector Search:** Converts the user query into an embedding and calculates the cosine distance (`<=>`) against all `document_chunks` in Postgres.
3. **Full-Text Search:** Falls back to text matching (`ILIKE`) on the `documents` table to catch exact title/author matches.
4. **Context Injection:** Fuses the top N results into a prompt template: *"You are an expert librarian... Use the following catalog context to answer the user..."*
5. **Generation:** Gemini reads the contextual chunks and provides a highly accurate, hallucination-free answer with specific book recommendations.

---

## 🚀 How to Run

1. **Database:** Ensure you have a Neon Postgres connection string and run migrations:
   ```bash
   cd smart-library-backend
   pnpm db:generate
   pnpm db:push
   ```
2. **Backend:** Provide `.env` with `DATABASE_URL` and `GOOGLE_BOOKS_API_KEY`.
   ```bash
   pnpm run start:dev
   ```
3. **Frontend:** Provide `.env.local` with `NEXT_PUBLIC_API_URL` pointing to backend port 3000.
   ```bash
   cd smart-library-frontend
   pnpm dev
   ```

## 🛠️ Reverse Engineering & Future Scaling
For a developer taking over this project:
- **Changing Vector DBs:** All vector logic is isolated in `src/rag/rag.service.ts` and `src/database/schema/chunks.ts`. You can swap `pgvector` for Pinecone or Milvus by altering these two files.
- **Adding MARC 21 Support:** The `ingestion_queue` schema relies on an `isbn` and `customMetadata`. To add binary `.mrc` support, simply add a `POST /upload/marc` endpoint, use `marcjs` to parse the ISBNs, and dump them into the same Postgres queue. The `CatalogWorker` will handle the rest.
- **Auth:** The auth module exists but is purposefully detached from controllers for rapid local testing. Secure the endpoints by enabling `@UseGuards(JwtAuthGuard)` on the catalog controllers.
