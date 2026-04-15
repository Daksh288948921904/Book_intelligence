import hashlib
import logging

import chromadb
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class OpenAIEmbeddingFunction:

    def name(self):
        return "openai-text-embedding-3-small"

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = "text-embedding-3-small"
        self.base_url = "https://api.openai.com/v1/embeddings"

    def embed_query(self, input):
        return self.__call__(input)

    def embed_documents(self, input):
        return self.__call__(input)

    def __call__(self, input):
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        payload = {
            "model": self.model,
            "input": input,
        }

        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()

            # Sort by index to maintain order, then extract embeddings
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in sorted_data]

        except requests.exceptions.HTTPError as e:
            logger.error(f"OpenAI Embedding API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise


class VectorStore:
    

    def __init__(self):
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.embedding_fn = OpenAIEmbeddingFunction()
        self.collection = self.client.get_or_create_collection(
            name="books",
            metadata={"hnsw:space": "cosine"},
            embedding_function=self.embedding_fn,
        )

    def _chunk_text(self, text, chunk_size=500, overlap=100):
        
        if not text or len(text) <= chunk_size:
            return [text] if text else []

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size

            # Try to break at a sentence boundary
            if end < len(text):
                # Look for sentence-ending punctuation near the end
                for sep in [". ", ".\n", "! ", "? "]:
                    last_sep = text[start:end].rfind(sep)
                    if last_sep > chunk_size // 2:
                        end = start + last_sep + len(sep)
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap

        return chunks

    def add_book(self, book):
        # Build the full text to embed from available book data
        text_parts = []
        if book.title:
            text_parts.append(f"Title: {book.title}")
        if book.author and book.author != "Unknown":
            text_parts.append(f"Author: {book.author}")
        if book.category:
            text_parts.append(f"Category: {book.category}")
        if book.description:
            text_parts.append(f"Description: {book.description}")
        if book.ai_summary:
            text_parts.append(f"Summary: {book.ai_summary}")
        if book.ai_genre:
            text_parts.append(f"Genre: {book.ai_genre}")

        full_text = "\n".join(text_parts)
        if not full_text.strip():
            logger.warning(f"Book '{book.title}' has no content to embed, skipping")
            return

        chunks = self._chunk_text(full_text)

        # Prepare data for ChromaDB
        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            # Create a deterministic ID so re-embedding is idempotent
            chunk_id = hashlib.md5(f"{book.id}_{i}_{chunk[:50]}".encode()).hexdigest()
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append({
                "book_id": book.id,
                "book_title": book.title,
                "book_author": book.author,
                "chunk_index": i,
                "total_chunks": len(chunks),
            })

        # Upsert to ChromaDB (handles duplicates gracefully)
        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(f"Embedded book '{book.title}' with {len(chunks)} chunks")

    def search(self, query, n_results=5):
        
        if self.collection.count() == 0:
            return []

        results = self.collection.query(
            query_texts=[query],
            n_results=min(n_results, self.collection.count()),
        )

        # Format results into a clean list
        formatted = []
        for i in range(len(results["ids"][0])):
            formatted.append({
                "id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i] if results.get("distances") else None,
            })

        return formatted

    def get_similar_books(self, book, n_results=5):
        
        query = f"{book.title} {book.category} {book.description[:200] if book.description else ''}"
        results = self.search(query, n_results=n_results + 5)

        # Filter out chunks from the same book and deduplicate by book_id
        seen_book_ids = {book.id}
        similar = []
        for result in results:
            bid = result["metadata"]["book_id"]
            if bid not in seen_book_ids:
                seen_book_ids.add(bid)
                similar.append(result)
            if len(similar) >= n_results:
                break

        return similar

    def delete_book(self, book_id):
        
        # Get all chunks for this book
        results = self.collection.get(
            where={"book_id": book_id},
        )
        if results["ids"]:
            self.collection.delete(ids=results["ids"])
            logger.info(f"Deleted {len(results['ids'])} chunks for book_id={book_id}")

    def get_stats(self):
        """Return collection statistics."""
        return {
            "total_chunks": self.collection.count(),
        }


# Singleton instance
vector_store = VectorStore()