from django.db import models


class Book(models.Model):
    

    title = models.CharField(max_length=500)
    author = models.CharField(max_length=300, default="Unknown")
    description = models.TextField(blank=True, default="")
    rating = models.FloatField(null=True, blank=True)
    price = models.CharField(max_length=50, blank=True, default="")
    availability = models.CharField(max_length=100, blank=True, default="")
    book_url = models.URLField(max_length=1000, unique=True)
    image_url = models.URLField(max_length=1000, blank=True, default="")
    category = models.CharField(max_length=200, blank=True, default="")
    upc = models.CharField(max_length=50, blank=True, default="")
    num_reviews = models.IntegerField(default=0)

    # AI-generated fields (populated after scraping)
    ai_summary = models.TextField(blank=True, default="")
    ai_genre = models.CharField(max_length=200, blank=True, default="")
    ai_sentiment = models.CharField(max_length=100, blank=True, default="")

    # Tracks whether the book has been embedded in ChromaDB
    is_embedded = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} by {self.author}"


class ChatHistory(models.Model):
    """Stores Q&A chat history for the RAG pipeline (bonus feature)."""

    question = models.TextField()
    answer = models.TextField()
    sources = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Chat histories"

    def __str__(self):
        return self.question[:80]