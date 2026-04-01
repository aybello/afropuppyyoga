/* ============================================================
   Gallery Section — Masonry-style photo grid
   Mix of real photos + generated images
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { X, Instagram } from "lucide-react";

const GALLERY_HERO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_gallery_hero-Fi5AF4eCkwPksaz67pQN8w.webp";
const HERO_PHOTO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/phTyMwLAySbvVAkq.jpg";
const CLASS_GROUP = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/VAHzfQKnVMpHXicj.jpg";
const ABOUT_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_about_img-J97haeYoPmNbnyyRPN9b8K.webp";
const EVENTS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_private_events-Nb3wGnpKGLiacEq7DDkbgp.webp";
const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp";

const galleryImages = [
  { src: GALLERY_HERO, alt: "Two women laughing with puppies", span: "col-span-2 row-span-2" },
  { src: HERO_PHOTO, alt: "Women holding puppies at class", span: "col-span-1 row-span-1" },
  { src: CLASS_GROUP, alt: "Group class with puppies", span: "col-span-1 row-span-2" },
  { src: ABOUT_IMG, alt: "Instructor with Samoyed puppy", span: "col-span-1 row-span-1" },
  { src: EVENTS_IMG, alt: "Corporate wellness event", span: "col-span-2 row-span-1" },
  { src: HERO_BG, alt: "Full yoga class with puppies", span: "col-span-1 row-span-1" },
];

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function Gallery() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section id="gallery" className="py-24 md:py-32 bg-[#FEFAF4]">
      <div className="container">
        {/* Header */}
        <FadeUp>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#2D5A27]" />
                <span className="text-[#2D5A27] font-body text-xs font-semibold tracking-widest uppercase">
                  Our Gallery
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1E1208]">
                Moments of Joy,
                <br />
                <span className="italic text-[#2D5A27]">Captured</span>
              </h2>
            </div>
            <a
              href="https://www.instagram.com/afropuppyyoga"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#2D5A27] text-[#2D5A27] font-body font-semibold text-sm rounded-full hover:bg-[#2D5A27] hover:text-white transition-all duration-200 self-start md:self-auto"
            >
              <Instagram size={16} />
              Follow @afropuppyyoga
            </a>
          </div>
        </FadeUp>

        {/* Masonry grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 auto-rows-[200px] md:auto-rows-[220px]">
          {galleryImages.map((img, i) => (
            <motion.div
              key={img.src}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className={`${img.span} relative overflow-hidden rounded-xl md:rounded-2xl cursor-pointer group`}
              onClick={() => setLightbox(img.src)}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Social CTA */}
        <FadeUp delay={0.3}>
          <div className="mt-12 text-center">
            <p className="font-body text-[#1E1208]/60 text-base mb-4">
              Tag us in your photos for a chance to be featured!
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["@afropuppyyoga", "#afropuppyyoga", "#puppyyoga", "#yogacanada"].map((tag) => (
                <span
                  key={tag}
                  className="px-4 py-1.5 bg-[#2D5A27]/10 text-[#2D5A27] font-body text-sm font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>
          <img
            src={lightbox}
            alt="Gallery"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </section>
  );
}
