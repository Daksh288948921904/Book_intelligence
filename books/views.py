import logging
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Book, ChatHistory
from .serializers import (
    BookDetailSerializer,
    BookListSerializer,
    BookUploadSerializer,
    ChatHistorySerializer,
    QuestionSerializer,
)
from .services.ai_insights import ai_insights
from .services.rag_pipeline import rag_pipeline
from .services.scraper import scrape_all_books, scrape_single_book
from .services.vector_store import vector_store
 
logger = logging.getLogger(__name__)
@api_view(["GET"])
def book_list(request):
    books=Book.objects.all()
    search=request.query_params.get("search","").strip()
    if search:
        books = books.filter(title__icontains=search) | books.filter(
            author__icontains=search
        ) | books.filter(category__icontains=search)
        books = books.distinct()
    category = request.query_params.get("category", "").strip()
    if category:
        books = books.filter(category__icontains=category)
 
    serializer = BookListSerializer(books, many=True)
    return Response({
        "count": books.count(),
        "results": serializer.data,
    })
@api_view(["GET"])
def book_detail(request, pk):
    try:
        book = Book.objects.get(pk=pk)
    except Book.DoesNotExist:
        return Response(
            {"error": "Book not found"}, status=status.HTTP_404_NOT_FOUND
        )
    serializer = BookDetailSerializer(book)
    return Response(serializer.data)


@api_view(["GET"])
def book_recommendations(request, pk):
    try:
        book = Book.objects.get(pk=pk)
    except Book.DoesNotExist:
        return Response(
            {"error": "Book not found"}, status=status.HTTP_404_NOT_FOUND
        )

    cache_key = f"recommendations_{pk}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    similar_results = vector_store.get_similar_books(book, n_results=5)

    recommendations = []
    for result in similar_results:
        try:
            rec_book = Book.objects.get(pk=result["metadata"]["book_id"])
            rec_serializer = BookListSerializer(rec_book)
            recommendations.append({
                "book": rec_serializer.data,
                "reason": (
                    f"Similar to '{book.title}' based on content and category. "
                    f"Both are in the {rec_book.category or 'same'} genre area."
                ),
                "similarity_score": round(1 - (result.get("distance") or 0), 3),
            })
        except Book.DoesNotExist:
            continue

    response_data = {
        "book_id": pk,
        "book_title": book.title,
        "recommendations": recommendations,
    }

    cache.set(cache_key, response_data, timeout=3600)
    return Response(response_data)
@api_view(["POST"])
def book_upload(request):
    serializer = BookUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
 
    url = serializer.validated_data.get("url")
    scrape_all_flag = serializer.validated_data.get("scrape_all", False)
    max_pages = serializer.validated_data.get("max_pages", 5)
 
    if scrape_all_flag:
        # Bulk scrape
        try:
            books_data = scrape_all_books(max_pages=max_pages, with_details=True)
        except Exception as e:
            return Response(
                {"error": f"Scraping failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
 
        created_count = 0
        for data in books_data:
            book_url = data.get("book_url", "")
            if not book_url:
                continue
 
            book, created = Book.objects.update_or_create(
                book_url=book_url,
                defaults={
                    "title": data.get("title", "Unknown"),
                    "author": data.get("author", "Unknown"),
                    "description": data.get("description", ""),
                    "rating": data.get("rating"),
                    "price": data.get("price", ""),
                    "availability": data.get("availability", ""),
                    "image_url": data.get("image_url", ""),
                    "category": data.get("category", ""),
                    "upc": data.get("upc", ""),
                    "num_reviews": data.get("num_reviews", 0),
                },
            )
            if created:
                created_count += 1
 
            # Embed in vector store
            try:
                vector_store.add_book(book)
                book.is_embedded = True
                book.save(update_fields=["is_embedded"])
            except Exception as e:
                logger.warning(f"Failed to embed book '{book.title}': {e}")
 
        return Response({
            "message": f"Scraped {len(books_data)} books, {created_count} new",
            "total_in_db": Book.objects.count(),
        }, status=status.HTTP_201_CREATED)
 
    elif url:
        # Single book scrape
        try:
            data = scrape_single_book(url)
        except Exception as e:
            return Response(
                {"error": f"Failed to scrape URL: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
 
        book, created = Book.objects.update_or_create(
            book_url=url,
            defaults={
                "title": data.get("title", "Unknown"),
                "author": data.get("author", "Unknown"),
                "description": data.get("description", ""),
                "rating": data.get("rating"),
                "price": data.get("price", ""),
                "availability": data.get("availability", ""),
                "image_url": data.get("image_url", ""),
                "category": data.get("category", ""),
                "upc": data.get("upc", ""),
                "num_reviews": data.get("num_reviews", 0),
            },
        )
 
        # Generate insights and embed
        try:
            ai_insights.generate_all_insights(book)
        except Exception as e:
            logger.warning(f"Failed to generate insights: {e}")
 
        try:
            vector_store.add_book(book)
            book.is_embedded = True
            book.save(update_fields=["is_embedded"])
        except Exception as e:
            logger.warning(f"Failed to embed: {e}")
 
        serializer = BookDetailSerializer(book)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
 
    return Response(
        {"error": "Provide either 'url' or set 'scrape_all' to true"},
        status=status.HTTP_400_BAD_REQUEST,
    )
@api_view(["POST"])
def book_ask(request):
    serializer = QuestionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
 
    question = serializer.validated_data["question"]
 
    try:
        result = rag_pipeline.answer_question(question)
    except Exception as e:
        logger.error(f"RAG pipeline error: {e}")
        return Response(
            {"error": f"Failed to process question: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
 
    # Save to chat history 
    ChatHistory.objects.create(
        question=result["question"],
        answer=result["answer"],
        sources=[s.get("book_id") for s in result.get("sources", [])],
    )
 
    return Response(result)
@api_view(["GET"])
def chat_history(request):
    history = ChatHistory.objects.all()[:50]
    serializer = ChatHistorySerializer(history, many=True)
    return Response(serializer.data)
@api_view(["GET"])
def stats(request):
    return Response({
        "total_books": Book.objects.count(),
        "books_with_insights": Book.objects.exclude(ai_summary="").count(),
        "books_embedded": Book.objects.filter(is_embedded=True).count(),
        "vector_store": vector_store.get_stats(),
        "total_questions": ChatHistory.objects.count(),
    })
@api_view(["POST"])
def generate_insights(request, pk):
    try:
        book = Book.objects.get(pk=pk)
    except Book.DoesNotExist:
        return Response(
            {"error": "Book not found"}, status=status.HTTP_404_NOT_FOUND
        )
 
    try:
        insights = ai_insights.generate_all_insights(book)
        return Response({
            "book_id": pk,
            "insights_generated": insights,
        })
    except Exception as e:
        return Response(
            {"error": f"Insight generation failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )