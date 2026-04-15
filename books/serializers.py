from rest_framework import serializers

from .models import Book, ChatHistory


class BookListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the book listing endpoint."""

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "author",
            "rating",
            "num_reviews",
            "price",
            "description",
            "book_url",
            "image_url",
            "category",
        ]


class BookDetailSerializer(serializers.ModelSerializer):
    """Full serializer with AI insights for book detail endpoint."""

    class Meta:
        model = Book
        fields = "__all__"


class BookUploadSerializer(serializers.Serializer):
    """Serializer for the book upload/scrape endpoint."""

    url = serializers.URLField(
        required=False,
        help_text="URL of a book page to scrape",
    )
    scrape_all = serializers.BooleanField(
        required=False,
        default=False,
        help_text="If true, scrape all books from books.toscrape.com",
    )
    max_pages = serializers.IntegerField(
        required=False,
        default=5,
        help_text="Number of pages to scrape (when scrape_all=true)",
    )


class QuestionSerializer(serializers.Serializer):
    """Serializer for the RAG Q&A endpoint."""

    question = serializers.CharField(
        max_length=1000,
        help_text="Question to ask about the books in the database",
    )


class AnswerSerializer(serializers.Serializer):
    """Response serializer for Q&A answers."""

    question = serializers.CharField()
    answer = serializers.CharField()
    sources = serializers.ListField(child=serializers.DictField())


class ChatHistorySerializer(serializers.ModelSerializer):
    """Serializer for chat history records."""

    class Meta:
        model = ChatHistory
        fields = "__all__"


class RecommendationSerializer(serializers.Serializer):
    """Response serializer for book recommendations."""

    book = BookListSerializer()
    reason = serializers.CharField()
    similarity_score = serializers.FloatField()