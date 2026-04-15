import logging

from django.core.cache import cache

from .llm_client import LLMClient
from .vector_store import vector_store

logger = logging.getLogger(__name__)


class RAGPipeline:
    
    def __init__(self):
        self.llm = LLMClient()
        self.vector_store = vector_store

    def _build_context(self, search_results, max_context_length=3000):
       
        # Group chunks by book for cleaner context
        books_context = {}
        for result in search_results:
            book_id = result["metadata"]["book_id"]
            book_title = result["metadata"]["book_title"]
            book_author = result["metadata"]["book_author"]

            if book_id not in books_context:
                books_context[book_id] = {
                    "title": book_title,
                    "author": book_author,
                    "chunks": [],
                }
            books_context[book_id]["chunks"].append(result["text"])

        # Build the context string
        context_parts = []
        sources = []
        current_length = 0

        for book_id, info in books_context.items():
            book_context = f"\n--- {info['title']} by {info['author']} ---\n"
            book_context += "\n".join(info["chunks"])

            if current_length + len(book_context) > max_context_length:
                break

            context_parts.append(book_context)
            current_length += len(book_context)
            sources.append({
                "book_id": book_id,
                "title": info["title"],
                "author": info["author"],
            })

        return "\n".join(context_parts), sources

    def answer_question(self, question, n_chunks=8):
        
        # Check cache for repeated questions (bonus feature)
        cache_key = f"rag_answer_{hash(question)}"
        cached = cache.get(cache_key)
        if cached:
            logger.info(f"Cache hit for question: '{question[:50]}...'")
            return cached

        # Step 1 & 2: Embed question and perform similarity search
        logger.info(f"RAG query: '{question}'")
        search_results = self.vector_store.search(query=question, n_results=n_chunks)

        if not search_results:
            return {
                "question": question,
                "answer": (
                    "I don't have enough information in the book database to answer "
                    "this question. Please try uploading more books first."
                ),
                "sources": [],
            }

        # Step 3: Construct context from retrieved chunks
        context, sources = self._build_context(search_results)

        # Step 4: Generate answer with citations using LLM
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a knowledgeable book assistant. Answer the user's question "
                    "based ONLY on the provided context from the book database. "
                    "Be specific and cite which book(s) your answer comes from. "
                    "If the context doesn't contain enough information to fully answer "
                    "the question, say so honestly.\n\n"
                    "Format your citations like: [Source: Book Title by Author]\n\n"
                    "Keep your answer concise but informative (2-4 paragraphs max)."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Context from book database:\n{context}\n\n"
                    f"Question: {question}"
                ),
            },
        ]

        try:
            answer = self.llm.chat_completion(
                messages, temperature=0.4, max_tokens=800
            )
        except Exception as e:
            logger.error(f"LLM failed during RAG answer generation: {e}")
            answer = (
                "I encountered an error while generating the answer. "
                "Please check that your LLM provider (OpenAI/LM Studio) is configured correctly."
            )

        result = {
            "question": question,
            "answer": answer,
            "sources": sources,
        }

        # Cache the result for 1 hour
        cache.set(cache_key, result, timeout=3600)

        return result


# Singleton instance
rag_pipeline = RAGPipeline()