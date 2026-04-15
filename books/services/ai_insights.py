import json
import logging

from django.core.cache import cache

from .llm_client import LLMClient

logger = logging.getLogger(__name__)


class AIInsightsService:
   

    def __init__(self):
        self.llm = LLMClient()

    def _get_cache_key(self, book_id, insight_type):
        """Generate a cache key for a specific book insight."""
        return f"ai_insight_{insight_type}_{book_id}"

    def generate_summary(self, book):
        
        # Check cache first
        cache_key = self._get_cache_key(book.id, "summary")
        cached = cache.get(cache_key)
        if cached:
            logger.info(f"Cache hit for summary of '{book.title}'")
            return cached

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a literary analyst. Generate a concise, engaging summary "
                    "of the book based on available information. Keep it to 2-3 sentences. "
                    "If the description is limited, infer what you can from the title, "
                    "category, and any available details."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Generate a summary for this book:\n"
                    f"Title: {book.title}\n"
                    f"Author: {book.author}\n"
                    f"Category: {book.category}\n"
                    f"Description: {book.description or 'Not available'}\n"
                    f"Rating: {book.rating}/5"
                ),
            },
        ]

        try:
            summary = self.llm.chat_completion(messages, temperature=0.5, max_tokens=300)
            cache.set(cache_key, summary, timeout=86400)  # Cache for 24 hours
            return summary
        except Exception as e:
            logger.error(f"Failed to generate summary for '{book.title}': {e}")
            return ""

    def classify_genre(self, book):
        
        cache_key = self._get_cache_key(book.id, "genre")
        cached = cache.get(cache_key)
        if cached:
            return cached

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a book genre classifier. Based on the book's details, "
                    "predict the most likely genre(s). Return ONLY a short comma-separated "
                    "list of 1-3 genres (e.g., 'Science Fiction, Dystopian'). No explanation."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Classify the genre of this book:\n"
                    f"Title: {book.title}\n"
                    f"Author: {book.author}\n"
                    f"Category: {book.category}\n"
                    f"Description: {book.description or 'Not available'}"
                ),
            },
        ]

        try:
            genre = self.llm.chat_completion(messages, temperature=0.3, max_tokens=50)
            genre = genre.strip().strip('"').strip("'")
            cache.set(cache_key, genre, timeout=86400)
            return genre
        except Exception as e:
            logger.error(f"Failed to classify genre for '{book.title}': {e}")
            return book.category or ""

    def analyze_sentiment(self, book):
        
        cache_key = self._get_cache_key(book.id, "sentiment")
        cached = cache.get(cache_key)
        if cached:
            return cached

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a sentiment analyzer for book descriptions. "
                    "Analyze the tone and sentiment of the book based on available info. "
                    "Return ONLY a single word or short phrase describing the overall tone "
                    "(e.g., 'Positive', 'Dark and Suspenseful', 'Whimsical', 'Inspirational', "
                    "'Melancholic'). No explanation."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Analyze the sentiment of this book:\n"
                    f"Title: {book.title}\n"
                    f"Category: {book.category}\n"
                    f"Rating: {book.rating}/5\n"
                    f"Description: {book.description or 'Not available'}"
                ),
            },
        ]

        try:
            sentiment = self.llm.chat_completion(messages, temperature=0.3, max_tokens=30)
            sentiment = sentiment.strip().strip('"').strip("'")
            cache.set(cache_key, sentiment, timeout=86400)
            return sentiment
        except Exception as e:
            logger.error(f"Failed to analyze sentiment for '{book.title}': {e}")
            return ""

    def generate_all_insights(self, book):
        
        insights = {}

        logger.info(f"Generating AI insights for '{book.title}'...")

        # Generate summary
        summary = self.generate_summary(book)
        if summary:
            book.ai_summary = summary
            insights["summary"] = summary

        # Classify genre
        genre = self.classify_genre(book)
        if genre:
            book.ai_genre = genre
            insights["genre"] = genre

        # Analyze sentiment
        sentiment = self.analyze_sentiment(book)
        if sentiment:
            book.ai_sentiment = sentiment
            insights["sentiment"] = sentiment

        # Save updates to database
        book.save(update_fields=["ai_summary", "ai_genre", "ai_sentiment", "updated_at"])

        logger.info(f"Insights generated for '{book.title}': {list(insights.keys())}")
        return insights


# Singleton instance
ai_insights = AIInsightsService()