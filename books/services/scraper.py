import logging
import re
import time

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)

BASE_URL = "https://books.toscrape.com"

# Rating text to number mapping
RATING_MAP = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
}


def get_driver():
    """Create and return a headless Chrome WebDriver instance."""
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(30)
    return driver


def scrape_book_detail(driver, detail_url):
    
    details = {}

    try:
        driver.get(detail_url)
        time.sleep(1)  # Polite delay

        soup = BeautifulSoup(driver.page_source, "lxml")

        # Extract description
        desc_tag = soup.select_one("#product_description ~ p")
        if desc_tag:
            details["description"] = desc_tag.get_text(strip=True)

        # Extract product information table
        table = soup.select_one("table.table-striped")
        if table:
            rows = table.select("tr")
            for row in rows:
                header = row.select_one("th")
                value = row.select_one("td")
                if header and value:
                    key = header.get_text(strip=True).lower()
                    val = value.get_text(strip=True)

                    if "upc" in key:
                        details["upc"] = val
                    elif "availability" in key:
                        details["availability"] = val
                        # Extract number of copies
                        match = re.search(r"\((\d+) available\)", val)
                        if match:
                            details["availability"] = f"{match.group(1)} in stock"
                    elif "number of reviews" in key:
                        details["num_reviews"] = int(val)

        # Extract category from breadcrumb
        breadcrumbs = soup.select("ul.breadcrumb li")
        if len(breadcrumbs) >= 3:
            details["category"] = breadcrumbs[2].get_text(strip=True)

    except Exception as e:
        logger.error(f"Error scraping detail page {detail_url}: {e}")

    return details


def scrape_books_listing(driver, page_url):
    
    books = []

    try:
        driver.get(page_url)
        time.sleep(1)

        soup = BeautifulSoup(driver.page_source, "lxml")
        articles = soup.select("article.product_pod")

        for article in articles:
            book = {}

            # Title and detail URL
            title_tag = article.select_one("h3 a")
            if title_tag:
                book["title"] = title_tag.get("title", title_tag.get_text(strip=True))
                relative_url = title_tag.get("href", "")
                # Build absolute URL
                if relative_url.startswith("catalogue/"):
                    book["book_url"] = f"{BASE_URL}/{relative_url}"
                elif relative_url.startswith("../"):
                    book["book_url"] = f"{BASE_URL}/catalogue/{relative_url.lstrip('../')}"
                else:
                    book["book_url"] = f"{BASE_URL}/catalogue/{relative_url}"

            # Price
            price_tag = article.select_one("p.price_color")
            if price_tag:
                book["price"] = price_tag.get_text(strip=True)

            # Rating
            rating_tag = article.select_one("p.star-rating")
            if rating_tag:
                classes = rating_tag.get("class", [])
                for cls in classes:
                    if cls.lower() in RATING_MAP:
                        book["rating"] = RATING_MAP[cls.lower()]
                        break

            # Image URL
            img_tag = article.select_one("img.thumbnail")
            if img_tag:
                img_src = img_tag.get("src", "")
                if img_src.startswith(".."):
                    book["image_url"] = f"{BASE_URL}/{img_src.lstrip('../')}"
                else:
                    book["image_url"] = f"{BASE_URL}/{img_src}"

            # Availability
            avail_tag = article.select_one("p.instock, p.availability")
            if avail_tag:
                book["availability"] = avail_tag.get_text(strip=True)

            if book.get("title"):
                books.append(book)

    except Exception as e:
        logger.error(f"Error scraping listing page {page_url}: {e}")

    return books


def scrape_all_books(max_pages=5, with_details=True):
    
    driver = get_driver()
    all_books = []

    try:
        for page_num in range(1, max_pages + 1):
            if page_num == 1:
                page_url = f"{BASE_URL}/catalogue/page-1.html"
            else:
                page_url = f"{BASE_URL}/catalogue/page-{page_num}.html"

            logger.info(f"Scraping page {page_num}: {page_url}")
            books = scrape_books_listing(driver, page_url)

            if not books:
                logger.info(f"No books found on page {page_num}, stopping.")
                break

            # Scrape detail pages for each book
            if with_details:
                for i, book in enumerate(books):
                    detail_url = book.get("book_url")
                    if detail_url:
                        logger.info(
                            f"  Scraping details ({i+1}/{len(books)}): {book['title'][:40]}..."
                        )
                        details = scrape_book_detail(driver, detail_url)
                        book.update(details)

            all_books.extend(books)
            logger.info(f"Page {page_num}: scraped {len(books)} books (total: {len(all_books)})")

    finally:
        driver.quit()

    return all_books


def scrape_single_book(url):
    
    driver = get_driver()

    try:
        driver.get(url)
        time.sleep(1)

        soup = BeautifulSoup(driver.page_source, "lxml")
        book = {"book_url": url}

        # Title
        title_tag = soup.select_one("div.product_main h1")
        if title_tag:
            book["title"] = title_tag.get_text(strip=True)

        # Price
        price_tag = soup.select_one("p.price_color")
        if price_tag:
            book["price"] = price_tag.get_text(strip=True)

        # Rating
        rating_tag = soup.select_one("p.star-rating")
        if rating_tag:
            classes = rating_tag.get("class", [])
            for cls in classes:
                if cls.lower() in RATING_MAP:
                    book["rating"] = RATING_MAP[cls.lower()]
                    break

        # Image
        img_tag = soup.select_one("div.item img")
        if img_tag:
            img_src = img_tag.get("src", "")
            if img_src.startswith(".."):
                book["image_url"] = f"{BASE_URL}/{img_src.lstrip('../')}"
            else:
                book["image_url"] = img_src

        # Details from the page
        details = scrape_book_detail(driver, url)
        book.update(details)

        return book

    finally:
        driver.quit()