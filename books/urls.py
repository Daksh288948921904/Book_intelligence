from django.urls import path
 
from . import views
 
urlpatterns = [
    # Book CRUD
    path("books/", views.book_list, name="book-list"),
    path("books/<int:pk>/", views.book_detail, name="book-detail"),
    path("books/<int:pk>/recommend/", views.book_recommendations, name="book-recommend"),
 
    # Actions
    path("books/upload/", views.book_upload, name="book-upload"),
    path("books/ask/", views.book_ask, name="book-ask"),
    path("books/<int:pk>/insights/", views.generate_insights, name="book-insights"),
 
    # History & stats
    path("books/chat-history/", views.chat_history, name="chat-history"),
    path("books/stats/", views.stats, name="stats"),
]
 