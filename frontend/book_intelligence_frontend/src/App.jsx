import { useState, useEffect, useCallback, useRef } from "react";

// ─── Config ──────────────────────────────────────────────────────
const API = "http://localhost:8000/api";

// ─── API Helper ──────────────────────────────────────────────────
async function api(endpoint, opts = {}) {
  try {
    const res = await fetch(`${API}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`API ${endpoint}:`, e);
    throw e;
  }
}

// ─── Icons (inline SVGs to avoid deps) ───────────────────────────
const Icon = ({ d, size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const Icons = {
  book: (p) => <Icon {...p} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />,
  search: (p) => <Icon {...p} d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />,
  chat: (p) => <Icon {...p} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />,
  star: (p) => <Icon {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  arrow: (p) => <Icon {...p} d="M19 12H5M12 5l-7 7 7 7" />,
  spark: (p) => <Icon {...p} d="M12 3v1m0 16v1m-7.07-2.93l.71-.71M4.22 4.22l.71.71M3 12h1m16 0h1m-2.93 7.07l-.71-.71M19.78 4.22l-.71.71M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
  send: (p) => <Icon {...p} d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  loader: (p) => <Icon {...p} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" className={`animate-spin ${p?.className || ""}`} />,
  ext: (p) => <Icon {...p} d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />,
  grid: (p) => <Icon {...p} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  brain: (p) => <Icon {...p} d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7l3 4 3-4c2-1.5 4-4 4-7a7 7 0 0 0-7-7z" />,
  tag: (p) => <Icon {...p} d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />,
  refresh: (p) => <Icon {...p} d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />,
  clock: (p) => <Icon {...p} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" />,
  chevron: (p) => <Icon {...p} d="M9 18l6-6-6-6" />,
  heart: (p) => <Icon {...p} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  x: (p) => <Icon {...p} d="M18 6L6 18M6 6l12 12" />,
  download: (p) => <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
};

// ─── Animated Star Rating ────────────────────────────────────────
function Stars({ rating = 0, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= rating ? "#f59e0b" : "none"} stroke={i <= rating ? "#f59e0b" : "#444"} strokeWidth={1.5}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

// ─── Fade-in wrapper ─────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(16px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
    }}>
      {children}
    </div>
  );
}

// ─── Toast Notification ──────────────────────────────────────────
function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500/40 bg-red-500/10 text-red-300",
    info: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  };

  return (
    <div className="fixed top-20 right-6 z-[100] animate-slideIn">
      <div className={`px-5 py-3 rounded-xl border backdrop-blur-xl ${colors[type]} flex items-center gap-3 shadow-2xl`}>
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
          <Icons.x size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────
function Navbar({ page, go }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16" style={{ background: "rgba(8,8,12,0.82)", backdropFilter: "blur(20px) saturate(1.4)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => go("dash")} className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
            <Icons.book size={16} className="text-black" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>BookIntel</span>
            <span className="hidden sm:inline text-xs text-neutral-600 ml-2 font-light tracking-widest uppercase">Intelligence Platform</span>
          </div>
        </button>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {[
            { id: "dash", label: "Library", icon: Icons.grid },
            { id: "qa", label: "Ask AI", icon: Icons.chat },
          ].map(({ id, label, icon: Ic }) => (
            <button key={id} onClick={() => go(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                page === id
                  ? "text-amber-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              style={page === id ? { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" } : { border: "1px solid transparent" }}
            >
              <Ic size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ─── BOOK CARD ───────────────────────────────────────────────────
function BookCard({ book, onClick, index = 0 }) {
  const [hovered, setHovered] = useState(false);

  return (
    <FadeIn delay={index * 60}>
      <button
        onClick={() => onClick(book.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full text-left group rounded-2xl overflow-hidden transition-all duration-500"
        style={{
          background: hovered ? "rgba(245,158,11,0.03)" : "rgba(255,255,255,0.015)",
          border: `1px solid ${hovered ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)"}`,
          transform: hovered ? "translateY(-4px)" : "none",
          boxShadow: hovered ? "0 20px 60px -15px rgba(245,158,11,0.08)" : "none",
        }}
      >
        {/* Image */}
        <div className="relative h-52 overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a1f 0%, #0d0d10 100%)" }}>
          {book.image_url ? (
            <img src={book.image_url} alt={book.title}
              className="w-full h-full object-cover transition-transform duration-700"
              style={{ transform: hovered ? "scale(1.08)" : "scale(1)", filter: "brightness(0.85)" }}
              onError={(e) => { e.target.style.display = "none" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icons.book size={44} className="text-neutral-800" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(8,8,12,0.95) 0%, transparent 60%)" }} />

          {/* Category badge */}
          {book.category && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-medium tracking-wide uppercase"
              style={{ background: "rgba(8,8,12,0.8)", backdropFilter: "blur(8px)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.15)", fontSize: "10px", letterSpacing: "0.08em" }}>
              {book.category}
            </span>
          )}

          {/* Rating */}
          {book.rating && (
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ background: "rgba(8,8,12,0.8)", backdropFilter: "blur(8px)" }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              <span className="text-xs text-amber-400 font-semibold">{book.rating}</span>
            </div>
          )}

          {/* Title overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors duration-300"
              style={{ fontFamily: "'Playfair Display', serif", color: hovered ? "#f59e0b" : "#f5f0e8" }}>
              {book.title}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-2">
          <p className="text-xs text-neutral-500 mb-2 font-medium">{book.author || "Unknown Author"}</p>
          {book.description && (
            <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed mb-3">{book.description}</p>
          )}
          <div className="flex items-center justify-between">
            {book.price && (
              <span className="text-sm font-bold text-emerald-400">{book.price}</span>
            )}
            <span className="text-xs text-neutral-600 flex items-center gap-1 group-hover:text-amber-500 transition-colors duration-300">
              Explore <Icons.chevron size={12} />
            </span>
          </div>
        </div>
      </button>
    </FadeIn>
  );
}

// ─── DASHBOARD PAGE ──────────────────────────────────────────────
function Dashboard({ go, goBook }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await api(`/books/${q}`);
      setBooks(data.results || []);
    } catch { setBooks([]); }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api("/books/stats/").then(setStats).catch(() => {});
  }, []);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const data = await api("/books/upload/", {
        method: "POST",
        body: JSON.stringify({ scrape_all: true, max_pages: 3 }),
      });
      setToast({ message: data.message || "Books scraped successfully!", type: "success" });
      load();
      api("/books/stats/").then(setStats).catch(() => {});
    } catch {
      setToast({ message: "Scraping failed. Is the backend running?", type: "error" });
    }
    setScraping(false);
  };

  return (
    <div className="min-h-screen pt-16" style={{ background: "#08080c" }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.3) 0%, transparent 70%)" }} />

        <div className="max-w-7xl mx-auto px-6 pt-16 pb-10 relative">
          <FadeIn>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/70 mb-4">Document Intelligence Platform</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>
              Your Book<br />
              <span className="italic" style={{ color: "#f59e0b" }}>Intelligence</span> Hub
            </h1>
            <p className="text-neutral-500 text-base max-w-lg leading-relaxed">
              AI-powered insights, smart recommendations, and natural language Q&A across your entire book collection.
            </p>
          </FadeIn>

          {/* Stats */}
          {stats && (
            <FadeIn delay={200}>
              <div className="flex flex-wrap gap-3 mt-8">
                {[
                  { label: "Books", val: stats.total_books, color: "#f59e0b" },
                  { label: "AI Insights", val: stats.books_with_insights, color: "#a78bfa" },
                  { label: "Embedded", val: stats.books_embedded, color: "#34d399" },
                  { label: "Questions", val: stats.total_questions, color: "#38bdf8" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="px-5 py-3 rounded-xl flex items-center gap-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-2xl font-bold" style={{ color, fontFamily: "'Playfair Display', serif" }}>{val}</span>
                    <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          )}
        </div>
      </div>

      {/* Search & Controls */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={e => { e.preventDefault(); load(); }} className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600"><Icons.search size={16} /></div>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, author, or category..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#f5f0e8",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(245,158,11,0.3)"; e.target.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }}
              />
            </form>
            <button onClick={handleScrape} disabled={scraping}
              className="px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "#f59e0b",
              }}>
              {scraping ? <Icons.loader size={15} /> : <Icons.download size={15} />}
              {scraping ? "Scraping..." : "Scrape Books"}
            </button>
          </div>
        </FadeIn>
      </div>

      {/* Book Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="h-52" style={{ background: "rgba(255,255,255,0.03)" }} />
                <div className="p-4 space-y-2">
                  <div className="h-4 rounded w-3/4" style={{ background: "rgba(255,255,255,0.05)" }} />
                  <div className="h-3 rounded w-1/2" style={{ background: "rgba(255,255,255,0.03)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <FadeIn>
            <div className="text-center py-20">
              <Icons.book size={48} className="text-neutral-800 mx-auto mb-4" />
              <p className="text-neutral-500 text-lg mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>No books found</p>
              <p className="text-neutral-600 text-sm">Click "Scrape Books" to populate your library, or adjust your search.</p>
            </div>
          </FadeIn>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {books.map((book, i) => (
              <BookCard key={book.id} book={book} onClick={goBook} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BOOK DETAIL PAGE ────────────────────────────────────────────
function BookDetail({ bookId, go }) {
  const [book, setBook] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genInsights, setGenInsights] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLoading(true);
    api(`/books/${bookId}/`).then(data => { setBook(data); setLoading(false); }).catch(() => setLoading(false));
    api(`/books/${bookId}/recommend/`).then(data => setRecs(data.recommendations || [])).catch(() => {});
  }, [bookId]);

  const handleGenerate = async () => {
    setGenInsights(true);
    try {
      await api(`/books/${bookId}/insights/`, { method: "POST" });
      const data = await api(`/books/${bookId}/`);
      setBook(data);
      setToast({ message: "Insights generated successfully!", type: "success" });
    } catch {
      setToast({ message: "Failed to generate insights", type: "error" });
    }
    setGenInsights(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center" style={{ background: "#08080c" }}>
        <Icons.loader size={28} className="text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center" style={{ background: "#08080c" }}>
        <p className="text-neutral-500">Book not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16" style={{ background: "#08080c" }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Ambient glow */}
      <div className="absolute top-16 right-0 w-[500px] h-[500px] opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.4) 0%, transparent 70%)" }} />

      <div className="max-w-5xl mx-auto px-6 py-10 relative">
        {/* Back button */}
        <FadeIn>
          <button onClick={() => go("dash")} className="flex items-center gap-2 text-neutral-500 hover:text-amber-400 transition-colors mb-8 text-sm">
            <Icons.arrow size={16} /> Back to Library
          </button>
        </FadeIn>

        {/* Book Header */}
        <FadeIn delay={100}>
          <div className="flex flex-col md:flex-row gap-8 mb-12">
            {/* Image */}
            <div className="w-full md:w-64 shrink-0">
              <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                {book.image_url ? (
                  <img src={book.image_url} alt={book.title} className="w-full h-80 md:h-96 object-cover" style={{ filter: "brightness(0.9)" }} />
                ) : (
                  <div className="w-full h-80 md:h-96 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <Icons.book size={60} className="text-neutral-800" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {book.category && (
                <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium tracking-wider uppercase mb-4"
                  style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.15)", letterSpacing: "0.1em" }}>
                  {book.category}
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>
                {book.title}
              </h1>
              <p className="text-neutral-400 text-lg mb-4">{book.author || "Unknown Author"}</p>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                {book.rating && (
                  <div className="flex items-center gap-2">
                    <Stars rating={book.rating} size={16} />
                    <span className="text-sm text-neutral-500">{book.rating}/5</span>
                  </div>
                )}
                {book.price && <span className="text-lg font-bold text-emerald-400">{book.price}</span>}
                {book.availability && <span className="text-xs text-neutral-500 px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>{book.availability}</span>}
              </div>

              {book.description && (
                <p className="text-neutral-400 text-sm leading-relaxed mb-6">{book.description}</p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                {book.book_url && (
                  <a href={book.book_url} target="_blank" rel="noreferrer"
                    className="px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-300 hover:scale-[1.02]"
                    style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#000" }}>
                    <Icons.ext size={14} /> View Source
                  </a>
                )}
                <button onClick={handleGenerate} disabled={genInsights}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-300 disabled:opacity-40"
                  style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}>
                  {genInsights ? <Icons.loader size={14} /> : <Icons.spark size={14} />}
                  {genInsights ? "Generating..." : "Generate Insights"}
                </button>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* AI Insights Cards */}
        {(book.ai_summary || book.ai_genre || book.ai_sentiment) && (
          <FadeIn delay={300}>
            <div className="mb-12">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>
                <Icons.spark size={18} className="text-amber-500" /> AI Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {book.ai_summary && (
                  <div className="md:col-span-3 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icons.book size={14} className="text-amber-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-500/80">Summary</span>
                    </div>
                    <p className="text-neutral-300 text-sm leading-relaxed">{book.ai_summary}</p>
                  </div>
                )}
                {book.ai_genre && (
                  <div className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icons.tag size={14} className="text-violet-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-violet-400/80">Genre</span>
                    </div>
                    <p className="text-neutral-300 text-sm">{book.ai_genre}</p>
                  </div>
                )}
                {book.ai_sentiment && (
                  <div className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icons.heart size={14} className="text-rose-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-rose-400/80">Sentiment</span>
                    </div>
                    <p className="text-neutral-300 text-sm">{book.ai_sentiment}</p>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Book Details Table */}
        <FadeIn delay={400}>
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>Details</h2>
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              {[
                ["UPC", book.upc],
                ["Number of Reviews", book.num_reviews],
                ["Availability", book.availability],
                ["Price", book.price],
                ["Category", book.category],
              ].filter(([_, v]) => v).map(([label, value], i) => (
                <div key={label} className="flex justify-between items-center px-5 py-3.5" style={{ borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                  <span className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{label}</span>
                  <span className="text-sm text-neutral-300">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Recommendations */}
        {recs.length > 0 && (
          <FadeIn delay={500}>
            <div className="mb-12">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>
                <Icons.heart size={18} className="text-rose-400" /> You Might Also Like
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {recs.map((rec, i) => (
                  <button key={rec.book.id} onClick={() => go("detail", rec.book.id)}
                    className="text-left p-4 rounded-2xl transition-all duration-300 group hover:scale-[1.01]"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex items-start gap-3">
                      {rec.book.image_url && (
                        <img src={rec.book.image_url} alt={rec.book.title} className="w-12 h-16 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-neutral-200 group-hover:text-amber-400 transition-colors line-clamp-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {rec.book.title}
                        </h4>
                        <p className="text-xs text-neutral-500 mt-0.5">{rec.book.author}</p>
                        {rec.similarity_score && (
                          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.15)" }}>
                            {Math.round(rec.similarity_score * 100)}% match
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}

// ─── Q&A PAGE ────────────────────────────────────────────────────
function QAPage({ go }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const chatEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api("/books/chat-history/").then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const data = await api("/books/ask/", {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      setMessages(prev => [...prev, {
        role: "ai",
        text: data.answer,
        sources: data.sources || [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "ai",
        text: "Sorry, I couldn't process that question. Make sure the backend is running and books are loaded.",
        sources: [],
      }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const loadFromHistory = (item) => {
    setMessages([
      { role: "user", text: item.question },
      { role: "ai", text: item.answer, sources: [] },
    ]);
    setShowHistory(false);
  };

  return (
    <div className="min-h-screen pt-16 flex flex-col" style={{ background: "#08080c" }}>
      {/* Ambient */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[300px] opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(56,189,248,0.3) 0%, transparent 70%)" }} />

      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-6 pt-10 pb-4 relative">
        <FadeIn>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-cyan-500/60 mb-2">RAG-Powered</p>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#f5f0e8" }}>
                Ask About Your <span className="italic text-cyan-400">Books</span>
              </h1>
            </div>
            <button onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#999" }}>
              <Icons.clock size={13} /> History
            </button>
          </div>
        </FadeIn>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="max-w-3xl mx-auto w-full px-6 mb-4">
          <FadeIn>
            <div className="rounded-2xl p-4 max-h-60 overflow-y-auto space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-2">Recent Questions</p>
              {history.slice(0, 10).map((item, i) => (
                <button key={i} onClick={() => loadFromHistory(item)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-amber-400 transition-all"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  {item.question}
                </button>
              ))}
            </div>
          </FadeIn>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <FadeIn delay={200}>
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.12)" }}>
                <Icons.chat size={28} className="text-cyan-500/60" />
              </div>
              <p className="text-neutral-400 text-lg mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Ask anything about your books</p>
              <p className="text-neutral-600 text-sm max-w-sm mx-auto leading-relaxed">
                Questions are answered using RAG — your books are searched, relevant passages are found, and AI generates an answer with citations.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                {[
                  "What are the highest rated books?",
                  "Recommend a mystery novel",
                  "Which books are about travel?",
                ].map(q => (
                  <button key={q} onClick={() => { setQuestion(q); }}
                    className="px-4 py-2 rounded-xl text-xs transition-all hover:scale-[1.03]"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#888" }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>
        ) : (
          <div className="space-y-5 py-4">
            {messages.map((msg, i) => (
              <FadeIn key={i} delay={50}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
                    {msg.role === "user" ? (
                      <div className="px-5 py-3 rounded-2xl rounded-br-md text-sm"
                        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%)", border: "1px solid rgba(245,158,11,0.15)", color: "#f5f0e8" }}>
                        {msg.text}
                      </div>
                    ) : (
                      <div>
                        <div className="px-5 py-4 rounded-2xl rounded-bl-md text-sm leading-relaxed"
                          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)", color: "#d4d0c8" }}>
                          {/* Render answer with line breaks */}
                          {msg.text.split("\n").map((line, j) => (
                            <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>
                          ))}
                        </div>
                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="text-xs text-neutral-600 mr-1">Sources:</span>
                            {msg.sources.map((s, j) => (
                              <span key={j} className="text-xs px-2 py-0.5 rounded-md"
                                style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.1)" }}>
                                {s.title || `Book #${s.book_id}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-5 py-4 rounded-2xl rounded-bl-md flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <Icons.loader size={15} className="text-cyan-400" />
                  <span className="text-sm text-neutral-500">Searching books & generating answer...</span>
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="max-w-3xl mx-auto w-full px-6 pb-8 pt-2">
        <div className="relative flex items-center rounded-2xl overflow-hidden transition-all duration-300"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            ref={inputRef}
            type="text" value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask()}
            placeholder="Ask a question about your books..."
            disabled={loading}
            className="flex-1 px-5 py-4 bg-transparent text-sm focus:outline-none disabled:opacity-50"
            style={{ color: "#f5f0e8" }}
          />
          <button onClick={ask} disabled={loading || !question.trim()}
            className="mr-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 disabled:opacity-30"
            style={{ background: question.trim() ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "rgba(255,255,255,0.05)" }}>
            <Icons.send size={16} className={question.trim() ? "text-black" : "text-neutral-600"} />
          </button>
        </div>
        <p className="text-center text-xs text-neutral-700 mt-3">Powered by RAG pipeline — answers cite sources from your book database</p>
      </div>
    </div>
  );
}

// ─── APP ROOT ────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dash");
  const [bookId, setBookId] = useState(null);

  const go = (p, id) => {
    if (p === "detail" && id) {
      setBookId(id);
      setPage("detail");
    } else {
      setPage(p);
    }
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Global Styles */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, html { font-family: 'DM Sans', sans-serif; background: #08080c; color: #f5f0e8; -webkit-font-smoothing: antialiased; }
        ::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1.2s linear infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slideIn { animation: slideIn 0.3s ease; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#08080c" }}>
        <Navbar page={page} go={go} />
        {page === "dash" && <Dashboard go={go} goBook={(id) => go("detail", id)} />}
        {page === "detail" && <BookDetail bookId={bookId} go={go} />}
        {page === "qa" && <QAPage go={go} />}
      </div>
    </>
  );
}
