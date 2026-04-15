# BookIntel — Document Intelligence Platform

A full-stack web application with AI/RAG integration that processes book data and enables intelligent querying. The system scrapes book data using Selenium, stores it in a database, generates AI-based insights, and supports question-answering over books using a RAG (Retrieval-Augmented Generation) pipeline.

---

## Screenshots

### Dashboard - Book Listing Page
![Dashboard](screenshots/dashboard.png)

### Book Detail Page with AI Insights
![Detail](screenshots/detail.png)

### Q&A Interface (RAG-Powered)
![QA](screenshots/qa.png)

### Scrape Books Feature
![Scrape](screenshots/scrape.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django REST Framework, Python |
| Database | SQLite (metadata), ChromaDB (vector embeddings) |
| Frontend | ReactJS + Vite, Tailwind CSS |
| AI/LLM | OpenAI API (GPT-4o-mini for generation, text-embedding-3-small for embeddings) |
| Automation | Selenium + BeautifulSoup |

---

## Project Structure
book_intelligence/
├── manage.py                          # Django entry point
├── .env.example                       # Environment variable template
├── requirements.txt                   # Python dependencies
│
├── book_intelligence/                 # Django project configuration
│   ├── settings.py                    # App settings - DB, CORS, OpenAI, ChromaDB config
│   ├── urls.py                        # Root URL config - routes /api/ to books app
│   ├── wsgi.py                        # WSGI application entry point
│   └── asgi.py                        # ASGI application entry point
│
├── books/                             # Main Django application
│   ├── models.py                      # Database models (Book + ChatHistory)
│   ├── serializers.py                 # DRF serializers for API request/response
│   ├── views.py                       # API endpoint logic (8 endpoints)
│   ├── urls.py                        # App-level URL routing
│   ├── admin.py                       # Django admin panel registration
│   ├── apps.py                        # App configuration
│   │
│   ├── services/                      # Core business logic layer
│   │   ├── llm_client.py              # OpenAI API client for chat completions
│   │   ├── vector_store.py            # ChromaDB wrapper + OpenAI embeddings
│   │   ├── ai_insights.py             # AI insight generation (summary, genre, sentiment)
│   │   ├── rag_pipeline.py            # Full RAG pipeline for Q&A
│   │   └── scraper.py                 # Selenium web scraper for books.toscrape.com
│   │
│   └── management/commands/
│       └── scrape_books.py            # CLI command: python manage.py scrape_books
│
└── frontend/                          # React + Tailwind frontend
├── src/
│   ├── App.jsx                    # Main React app (Dashboard, Detail, Q&A pages)
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Tailwind CSS imports
├── index.html                     # HTML entry point
├── package.json                   # Node.js dependencies
├── vite.config.js                 # Vite dev server + API proxy config
├── tailwind.config.js             # Tailwind CSS configuration
└── postcss.config.js              # PostCSS configuration

---

## Backend Architecture — File-by-File Breakdown

### `book_intelligence/settings.py`
Central Django configuration. Loads environment variables from `.env` using `python-dotenv`. Configures Django REST Framework with pagination, CORS headers for frontend communication, OpenAI API key and model settings, ChromaDB persistence directory, and in-memory caching for AI response deduplication.

### `book_intelligence/urls.py`
Root URL router. Delegates all `/api/` routes to the `books` app and serves Django admin at `/admin/`.

### `books/models.py`
Defines two database models:
- **Book**: Stores scraped metadata (title, author, description, rating, price, availability, book_url, image_url, category, UPC, num_reviews) plus AI-generated fields (ai_summary, ai_genre, ai_sentiment) and an `is_embedded` flag tracking ChromaDB status.
- **ChatHistory**: Stores Q&A sessions with question, answer, source book IDs, and timestamp for the chat history feature.

### `books/serializers.py`
DRF serializers that convert model instances to/from JSON:
- `BookListSerializer` — lightweight fields for the listing page
- `BookDetailSerializer` — all fields including AI insights
- `BookUploadSerializer` — validates scrape requests (url or scrape_all flag)
- `QuestionSerializer` — validates Q&A questions
- `AnswerSerializer` — structures RAG responses
- `ChatHistorySerializer` — for chat history records
- `RecommendationSerializer` — for book recommendations with similarity scores

### `books/views.py`
Contains 8 API endpoint functions:
- `book_list` — GET all books with optional search/category filters
- `book_detail` — GET single book details, triggers lazy AI insight generation
- `book_recommendations` — GET similar books using ChromaDB vector similarity
- `book_upload` — POST to scrape books (single URL or bulk scrape)
- `book_ask` — POST question to RAG pipeline, returns AI answer with source citations
- `generate_insights` — POST to trigger AI insight generation for a specific book
- `chat_history` — GET past Q&A sessions
- `stats` — GET database and vector store statistics

### `books/urls.py`
Maps URL patterns to view functions. All endpoints are prefixed with `/api/` via the root URL config.

### `books/services/llm_client.py`
Unified OpenAI API client. Sends chat completion requests to GPT-4o-mini with configurable temperature and max_tokens. Includes a `generate_json` method that instructs the model to return valid JSON and handles common formatting issues (markdown code blocks, etc.). Used by both the AI insights service and the RAG pipeline.

### `books/services/vector_store.py`
ChromaDB wrapper with a custom `OpenAIEmbeddingFunction` that calls OpenAI's `text-embedding-3-small` model. Key features:
- **Smart chunking**: Splits book text into 500-character chunks with 100-character overlap, breaking at sentence boundaries for better retrieval quality.
- **Deterministic IDs**: Uses MD5 hashing for idempotent upserts (re-embedding the same book doesn't create duplicates).
- **Similarity search**: Queries ChromaDB with cosine similarity, returns chunks with metadata and distance scores.
- **Book recommendations**: Finds similar books by querying with a book's title + category + description, filtering out same-book chunks.

### `books/services/ai_insights.py`
Generates three types of AI insights per book using GPT-4o-mini:
1. **Summary Generation** — 2-3 sentence concise summary based on title, author, category, and description
2. **Genre Classification** — Predicts 1-3 genres as a comma-separated list
3. **Sentiment Analysis** — Analyzes tone/mood (e.g., "Dark and Suspenseful", "Whimsical")

All insights are cached for 24 hours to avoid repeated API calls (bonus feature). The `generate_all_insights` method runs all three and saves results to the database.

### `books/services/rag_pipeline.py`
Complete RAG (Retrieval-Augmented Generation) pipeline:
1. **Embed question** — ChromaDB handles this via the OpenAI embedding function
2. **Similarity search** — Retrieves top 8 relevant chunks from the vector store
3. **Context construction** — Groups chunks by book, builds a structured context string with book titles and authors
4. **LLM generation** — Sends context + question to GPT-4o-mini with instructions to cite sources
5. **Response caching** — Caches answers for 1 hour to avoid repeated processing

### `books/services/scraper.py`
Selenium-based web scraper for books.toscrape.com:
- `get_driver()` — Creates a headless Chrome WebDriver
- `scrape_books_listing()` — Scrapes book cards from catalogue pages (title, price, rating, image)
- `scrape_book_detail()` — Visits individual book pages for description, UPC, availability, category
- `scrape_all_books()` — Iterates through multiple catalogue pages with configurable page count
- `scrape_single_book()` — Scrapes a single book from its URL

### `books/management/commands/scrape_books.py`
Django management command (`python manage.py scrape_books`) that orchestrates the full pipeline:
1. Scrapes books from the web using Selenium
2. Saves/updates book records in the database
3. Optionally generates AI insights (with `--generate-insights` flag)
4. Embeds all books in ChromaDB for vector search

---

## API Documentation

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/books/` | List all books | `?search=query&category=thriller` |
| GET | `/api/books/<id>/` | Book detail + AI insights | — |
| GET | `/api/books/<id>/recommend/` | Similar book recommendations | — |
| POST | `/api/books/upload/` | Scrape books | `{"scrape_all": true, "max_pages": 3}` or `{"url": "https://..."}` |
| POST | `/api/books/ask/` | Ask a question (RAG) | `{"question": "What thriller books are available?"}` |
| POST | `/api/books/<id>/insights/` | Generate AI insights | — |
| GET | `/api/books/chat-history/` | View past Q&A | — |
| GET | `/api/books/stats/` | DB & vector stats | — |

---

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- Google Chrome (for Selenium)
- OpenAI API key

### Backend Setup
```bash
cd book_intelligence
cp .env.example .env              # Add your OPENAI_API_KEY
pip3 install -r requirements.txt
python3 manage.py migrate
python3 manage.py scrape_books --pages 3    # Scrape & embed books
python3 manage.py runserver                 # Starts at localhost:8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev                                 # Starts at localhost:3000
```

### Running Both
Open two terminals:
- Terminal 1: `cd book_intelligence && python3 manage.py runserver`
- Terminal 2: `cd book_intelligence/frontend && npm install && npm run dev`

Then open http://localhost:3000

---

## Sample Questions & Answers

**Q: What are the highest rated books?**
> Based on the book database, several titles have received 5-star ratings including "Sophie's World" in the Philosophy category and "The Elephant Tree" in the Thriller category. These books stand out with perfect ratings among the collection. [Source: Sophie's World, The Elephant Tree]

**Q: Recommend a mystery novel**
> "In a Dark, Dark Wood" is a compelling mystery novel in the collection. The story follows Nora who receives an unexpected invitation from her estranged friend Clare after ten years of silence, leading to a suspenseful weekend in a remote countryside house. [Source: In a Dark, Dark Wood]

**Q: Which books are about philosophy?**
> The collection includes "Sophie's World" by Jostein Gaarder, described as a page-turning novel that is also an exploration of great philosophical questions. It has received a 5-star rating and is priced at £15.94. [Source: Sophie's World]

**Q: What poetry books are available?**
> "You can't bury them all: Poems" is a poetry collection available in the database. It is described as a work that is at once harrowing, angry, and achingly beautiful. The book is rated 2 stars and priced at £33.63. [Source: You can't bury them all: Poems]

---

## Bonus Features Implemented

- ✅ **Caching AI responses** — Uses Django's cache framework to avoid repeated OpenAI calls (24hr for insights, 1hr for RAG answers)
- ✅ **Embedding-based similarity** — ChromaDB vector search with OpenAI text-embedding-3-small
- ✅ **Advanced chunking** — Overlapping windows (500 chars, 100 overlap) with sentence boundary detection
- ✅ **Multi-page scraping** — Configurable page count for bulk scraping
- ✅ **Saving chat history** — All Q&A sessions stored in database with source references
- ✅ **Loading states + UX polish** — Skeleton loaders, fade-in animations, toast notifications
- ✅ **Search & filter** — Search books by title, author, or category
- ✅ **Lazy insight generation** — AI insights generated on-demand when viewing book details
- ✅ **Smart recommendations** — Vector similarity-based "You Might Also Like" feature

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Django secret key | `any-random-string-123` |
| `DEBUG` | Debug mode | `True` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `OPENAI_MODEL` | LLM model to use | `gpt-4o-mini` |
