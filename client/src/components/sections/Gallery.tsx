/* ============================================================
   Gallery Section — Masonry grid with lightbox
   Design: Warm Afro-Wellness Editorial
   - 30 real photos from past APY classes (CDN-hosted)
   - Category filter tabs (All / Yoga / Puppies / Events)
   - Click-to-open lightbox with prev/next + keyboard nav
   - CSS columns masonry layout, responsive
   ============================================================ */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Instagram, ZoomIn } from "lucide-react";

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ";

const PHOTOS = [
  { src: `${CDN}/IMG_6733_3af1fae4.jpeg`,                      cat: "yoga",    alt: "Yoga class with puppies" },
  { src: `${CDN}/IMG_6587_e22a12de.jpeg`,                      cat: "puppies", alt: "Puppy cuddle time" },
  { src: `${CDN}/IMG_6524_8c62ee38.jpeg`,                      cat: "yoga",    alt: "Group yoga session" },
  { src: `${CDN}/IMG_6345_a41b23ba.jpeg`,                      cat: "events",  alt: "Private event celebration" },
  { src: `${CDN}/IMG_6328_6e8a0744.jpeg`,                      cat: "yoga",    alt: "Yoga pose with puppy" },
  { src: `${CDN}/IMG_5945_f1ae2cf7.jpeg`,                      cat: "puppies", alt: "Adorable puppies playing" },
  { src: `${CDN}/IMG_5703_85106987.jpeg`,                      cat: "events",  alt: "Group celebration" },
  { src: `${CDN}/IMG_7466_ce58710e.jpeg`,                      cat: "yoga",    alt: "Yoga flow with puppies" },
  { src: `${CDN}/IMG_6852_2cad7a74.jpeg`,                      cat: "puppies", alt: "Puppy interactions" },
  { src: `${CDN}/IMG_6835_d16dd95c.jpeg`,                      cat: "events",  alt: "Event group photo" },
  { src: `${CDN}/photo_2025-01-04_15-57-12_366eed7a.jpg`,      cat: "yoga",    alt: "January yoga class" },
  { src: `${CDN}/photo_2025-01-04_15-56-56_c056aab4.jpg`,      cat: "puppies", alt: "Puppy playtime January" },
  { src: `${CDN}/photo_2025-01-04_15-57-01_a3d5f1d6.jpg`,      cat: "yoga",    alt: "Yoga session January" },
  { src: `${CDN}/photo_2025-01-04_15-57-06_064d6ffc.jpg`,      cat: "events",  alt: "Group event January" },
  { src: `${CDN}/photo_2024-12-11_16-14-21_de9b8d26.jpg`,      cat: "yoga",    alt: "December yoga class" },
  { src: `${CDN}/photo_2024-12-11_16-15-30_a11db10d.jpg`,      cat: "puppies", alt: "Puppies December" },
  { src: `${CDN}/photo_2024-12-11_16-15-33_fe3e1c05.jpg`,      cat: "yoga",    alt: "Yoga flow December" },
  { src: `${CDN}/photo_2024-12-11_16-15-37_da653320.jpg`,      cat: "events",  alt: "Event December" },
  { src: `${CDN}/photo_2024-12-11_16-15-41_580deca1.jpg`,      cat: "yoga",    alt: "Yoga session December" },
  { src: `${CDN}/photo_2024-12-11_16-15-50_178d6c41.jpg`,      cat: "puppies", alt: "Puppy cuddles December" },
  { src: `${CDN}/photo_2024-12-11_16-15-55_b42d8cfe.jpg`,      cat: "yoga",    alt: "Group yoga December" },
  { src: `${CDN}/photo_2024-12-11_16-16-00_5ccc0075.jpg`,      cat: "events",  alt: "Private event December" },
  { src: `${CDN}/photo_2024-12-11_16-16-07_b1aa677d.jpg`,      cat: "yoga",    alt: "Yoga pose December" },
  { src: `${CDN}/photo_2024-12-11_16-16-12_30c48ef4.jpg`,      cat: "puppies", alt: "Puppy play December" },
  { src: `${CDN}/photo_2024-12-11_16-16-17_c3baafd2.jpg`,      cat: "yoga",    alt: "Yoga flow December" },
  { src: `${CDN}/photo_2024-12-11_16-16-21_dc7307dc.jpg`,      cat: "events",  alt: "Group photo December" },
  { src: `${CDN}/photo_2024-12-11_16-16-25_f8a3a637.jpg`,      cat: "yoga",    alt: "Yoga session December" },
  { src: `${CDN}/photo_2024-12-11_16-16-30_a6aa152e.jpg`,      cat: "puppies", alt: "Puppy cuddles December" },
  { src: `${CDN}/photo_2024-12-11_16-16-35_fe30f5a9.jpg`,      cat: "yoga",    alt: "Yoga class December" },
  { src: `${CDN}/photo_2024-12-11_16-16-40_ef9b5919.jpg`,      cat: "events",  alt: "Event celebration December" },
];

const CATS = [
  { key: "all",     label: "All Photos" },
  { key: "yoga",    label: "Yoga Classes" },
  { key: "puppies", label: "Puppy Time" },
  { key: "events",  label: "Private Events" },
];

const INITIAL_COUNT = 12;

export default function Gallery() {
  const [activeCat, setActiveCat] = useState("all");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  const filtered = activeCat === "all" ? PHOTOS : PHOTOS.filter(p => p.cat === activeCat);
  const visible = filtered.slice(0, visibleCount);

  const handleCatChange = (cat: string) => {
    setActiveCat(cat);
    setVisibleCount(INITIAL_COUNT);
    setLightboxIdx(null);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) return;
    if (e.key === "ArrowRight") setLightboxIdx(i => i !== null ? Math.min(i + 1, filtered.length - 1) : null);
    if (e.key === "ArrowLeft")  setLightboxIdx(i => i !== null ? Math.max(i - 1, 0) : null);
    if (e.key === "Escape")     setLightboxIdx(null);
  }, [lightboxIdx, filtered.length]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIdx]);

  return (
    <section id="gallery" className="py-24 md:py-32 bg-[#FFF5F8]">
      <div className="container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                Our Gallery
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1A0A12]">
              Moments of Joy,
              <br />
              <span className="italic text-[#8B2252]">Captured</span>
            </h2>
            <p className="mt-3 font-body text-[#1A0A12]/60 text-base max-w-md">
              Real photos from our past classes — every smile, stretch, and puppy cuddle.
            </p>
          </motion.div>

          <motion.a
            href="https://www.instagram.com/afropuppyyoga"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-[#8B2252] text-[#8B2252] font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] hover:text-white transition-all duration-200 self-start md:self-auto"
          >
            <Instagram size={16} />
            Follow @afropuppyyoga
          </motion.a>
        </div>

        {/* Category filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-10"
        >
          {CATS.map(cat => (
            <button
              key={cat.key}
              onClick={() => handleCatChange(cat.key)}
              className={`px-5 py-2 rounded-full font-body text-sm font-semibold transition-all duration-200 ${
                activeCat === cat.key
                  ? "bg-[#8B2252] text-white shadow-md"
                  : "bg-[#1A0A12]/8 text-[#1A0A12]/70 hover:bg-[#1A0A12]/15"
              }`}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs ${activeCat === cat.key ? "text-white/70" : "text-[#1A0A12]/40"}`}>
                ({cat.key === "all" ? PHOTOS.length : PHOTOS.filter(p => p.cat === cat.key).length})
              </span>
            </button>
          ))}
        </motion.div>

        {/* Masonry grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCat}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ columnCount: undefined }}
            className="[column-count:1] sm:[column-count:2] md:[column-count:3] lg:[column-count:4] [column-gap:12px]"
          >
            {visible.map((photo, i) => (
              <motion.div
                key={photo.src}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.4 }}
                className="break-inside-avoid mb-3 group relative overflow-hidden rounded-xl cursor-pointer"
                onClick={() => setLightboxIdx(i)}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  className="w-full h-auto block object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-[#1A0A12]/0 group-hover:bg-[#1A0A12]/35 transition-all duration-300 flex items-center justify-center">
                  <ZoomIn
                    size={26}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg"
                  />
                </div>
                {/* Category badge on hover */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="px-2 py-0.5 bg-[#F2A0B8] text-[#1A0A12] font-body text-xs font-bold rounded-full capitalize">
                    {photo.cat}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Load more */}
        {visibleCount < filtered.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-10"
          >
            <button
              onClick={() => setVisibleCount(c => c + 12)}
              className="px-8 py-3 border-2 border-[#8B2252] text-[#8B2252] font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] hover:text-white transition-all duration-200"
            >
              Load More Photos ({filtered.length - visibleCount} remaining)
            </button>
          </motion.div>
        )}

        {/* Instagram CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-14 text-center"
        >
          <p className="font-body text-[#1A0A12]/50 text-sm mb-3">
            Tag us in your photos for a chance to be featured!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["@afropuppyyoga", "#afropuppyyoga", "#puppyyoga", "#yogacanada"].map(tag => (
              <span
                key={tag}
                className="px-3 py-1 bg-[#8B2252]/10 text-[#8B2252] font-body text-xs font-semibold rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxIdx(null)}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors z-10"
              onClick={() => setLightboxIdx(null)}
              aria-label="Close lightbox"
            >
              <X size={20} />
            </button>

            {/* Prev */}
            {lightboxIdx > 0 && (
              <button
                className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors z-10"
                onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : null); }}
                aria-label="Previous photo"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {/* Next */}
            {lightboxIdx < filtered.length - 1 && (
              <button
                className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors z-10"
                onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : null); }}
                aria-label="Next photo"
              >
                <ChevronRight size={22} />
              </button>
            )}

            {/* Image */}
            <motion.div
              key={lightboxIdx}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="relative mx-4 sm:mx-16 max-w-5xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={filtered[lightboxIdx].src}
                alt={filtered[lightboxIdx].alt}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
              {/* Caption bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl px-5 py-4">
                <p className="font-body text-white/80 text-sm">{filtered[lightboxIdx].alt}</p>
                <p className="font-body text-white/40 text-xs mt-0.5">
                  {lightboxIdx + 1} / {filtered.length} · <span className="hidden sm:inline">Use ← → keys to navigate</span><span className="sm:hidden">Tap edges to navigate</span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
