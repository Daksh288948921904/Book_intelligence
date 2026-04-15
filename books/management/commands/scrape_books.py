from django.core.management.base import BaseCommand
 
from books.models import Book
from books.services.ai_insights import ai_insights
from books.services.scraper import scrape_all_books
from books.services.vector_store import vector_store
 
 
class Command(BaseCommand):
    help = "Scrape books from books.toscrape.com and store in database"
 
    def add_arguments(self, parser):
        parser.add_argument(
            "--pages",
            type=int,
            default=5,
            help="Number of catalogue pages to scrape (default: 5, 20 books/page)",
        )
        parser.add_argument(
            "--no-details",
            action="store_true",
            help="Skip scraping individual detail pages (faster but less data)",
        )
        parser.add_argument(
            "--generate-insights",
            action="store_true",
            help="Generate AI insights (summary, genre, sentiment) for each book",
        )
 
    def handle(self, *args, **options):
        max_pages = options["pages"]
        with_details = not options["no_details"]
        generate_insights = options["generate_insights"]
 
        self.stdout.write(
            self.style.NOTICE(
                f"Starting scrape: {max_pages} pages, "
                f"details={'yes' if with_details else 'no'}, "
                f"insights={'yes' if generate_insights else 'no'}"
            )
        )
 
        # Step 1: Scrape books
        books_data = scrape_all_books(max_pages=max_pages, with_details=with_details)
        self.stdout.write(f"Scraped {len(books_data)} books from the web")
 
        # Step 2: Save to database
        created_count = 0
        updated_count = 0
 
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
            else:
                updated_count += 1
 
            # Step 3: Generate AI insights (if requested)
            if generate_insights:
                try:
                    self.stdout.write(f"  Generating insights for: {book.title[:50]}...")
                    ai_insights.generate_all_insights(book)
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f"  Failed to generate insights: {e}")
                    )
 
            # Step 4: Embed in ChromaDB
            try:
                vector_store.add_book(book)
                book.is_embedded = True
                book.save(update_fields=["is_embedded"])
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f"  Failed to embed: {e}")
                )
 
        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created: {created_count}, Updated: {updated_count}, "
                f"Total in DB: {Book.objects.count()}"
            )
        )
        self.stdout.write(
            f"Vector store stats: {vector_store.get_stats()}"
        )
 