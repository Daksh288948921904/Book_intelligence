from django.contrib import admin
from .models import Book,ChatHistory
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "category", "rating", "price", "is_embedded"]
    list_filter = ["category", "is_embedded", "rating"]
    search_fields = ["title", "author", "description"]
    readonly_fields = ["created_at", "updated_at"]
@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ["question", "created_at"]
    readonly_fields = ["created_at"]