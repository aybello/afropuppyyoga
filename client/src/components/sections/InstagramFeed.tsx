/* ============================================================
   InstagramFeed Section — 4 native video tiles
   Design: Warm Afro-Wellness Editorial (Pink variant)
   - 2 customer review Reels + 2 entertainment/relatable Reels
   - Native <video> elements — play inline on ALL devices incl. mobile
   - 9:16 aspect ratio, 2-col desktop / single-col snap-scroll mobile
   ============================================================ */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Play, Pause, Volume2, VolumeX } from "lucide-react";

const REELS = [
  {
    id: "review1",
    videoUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/reel_review1_e70c52a3.mp4",
    thumbUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/reel_review1_thumb_37c4bc42.jpg",
    caption: "Hear what our guests are saying 🐶❤️",
    tag: "Review",
    instagramUrl: "https://www.instagram.com/reel/DV99b-vDPCy/",
  },
  {
    id: "relatable",
    videoUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/reel_relatable_a42ed4d9.mp4",
    thumbUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/reel_relatable_thumb_cff0f6f0.jpg",
    caption: "🧐🤨 #puppyyoga #relatable #fyp",
    tag: "Relatable",
    instagramUrl: "https://www.instagram.com/reel/DWU4taXDNKg/",
  },
  {
    id: "okay",
    videoUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/reel_okay_fcc176dd.mp4",
    thumbUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/reel_okay_thumb_8adc1726.jpg",
    caption: "i'm okay with it tho! 😂🐶 #puppyyoga",
    tag: "Relatable",
    instagramUrl: "https://www.instagram.com/reel/DWaCFHXEXYy/",
  },
  {
    id: "review2",
    videoUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/review2_h264_d7d03926.mp4",
    thumbUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/review2_thumb_54739e6e.jpg",
    caption: "Another happy guest shares their experience 🧘‍♀️🐾",
    tag: "Review",
    instagramUrl: "https://www.instagram.com/reel/DVKKYGIEa4-/",
  },
  {
    id: "new_reel",
    videoUrl:
      "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/ywRUsSmgYoqYPJOZ.mp4",
    thumbUrl:
      "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/YsmvRsuruPouMOgB.jpg",
    caption: "Fun times at puppy yoga 🐾✨ #puppyyoga #fyp",
    tag: "Vibes",
    instagramUrl: "https://www.instagram.com/reel/DZ7SyjbRYPb/",
  },
];

function VideoCard({ reel, index }: { reel: (typeof REELS)[0]; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="flex-shrink-0 w-full snap-start group"
    >
      {/* 9:16 video container */}
      <div
        className="relative rounded-2xl overflow-hidden bg-[#1A0A12] shadow-md group-hover:shadow-xl transition-shadow duration-300 cursor-pointer"
        style={{ paddingBottom: "177.78%" }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={reel.thumbUrl ?? undefined}
          playsInline
          muted
          loop
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Play/pause overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
          style={{ background: playing ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.35)" }}
        >
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center shadow-lg">
            {playing ? (
              <Pause size={22} className="text-white" fill="white" />
            ) : (
              <Play size={22} className="text-white ml-1" fill="white" />
            )}
          </div>
        </div>

        {/* Mute toggle — bottom right */}
        <button
          onClick={toggleMute}
          className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX size={14} className="text-white" />
          ) : (
            <Volume2 size={14} className="text-white" />
          )}
        </button>

        {/* Instagram link — top right */}
        <a
          href={reel.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="View on Instagram"
        >
          <Instagram size={14} className="text-white" />
        </a>
      </div>

      {/* Tag + caption */}
      <div className="mt-3 px-1">
        <span
          className={`inline-block font-body text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full mb-1.5 ${
            reel.tag === "Review"
              ? "bg-[#8B2252]/10 text-[#8B2252]"
              : "bg-[#F2A0B8]/30 text-[#6B1A3F]"
          }`}
        >
          {reel.tag}
        </span>
        <p className="font-body text-[#1A0A12]/70 text-xs leading-relaxed line-clamp-2">
          {reel.caption}
        </p>
      </div>
    </motion.div>
  );
}

export default function InstagramFeed() {
  return (
    <section id="instagram" className="py-10 md:py-32 bg-[#FFF5F8] overflow-hidden">
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
                @afropuppyyoga
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1A0A12]">
              Watch the Magic
              <br />
              <span className="italic text-[#8B2252]">Unfold</span>
            </h2>
            <p className="mt-3 font-body text-[#1A0A12]/60 text-base max-w-md">
              Real moments from real classes — plus what our guests have to say.
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#F2A0B8] to-[#E1306C] text-white font-body font-semibold text-sm rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 self-start md:self-auto"
          >
            <Instagram size={16} />
            Follow on Instagram
          </motion.a>
        </div>

        {/* Video grid — 2-col on desktop, horizontal scroll on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {REELS.map((reel, i) => (
            <VideoCard key={reel.id} reel={reel} index={i} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="font-body text-[#1A0A12]/50 text-sm mb-4">
            New content every week — follow us to stay in the loop!
          </p>
          <a
            href="https://www.instagram.com/afropuppyyoga"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-body text-sm font-semibold text-[#8B2252] hover:text-[#1A0A12] transition-colors duration-200"
          >
            <Instagram size={15} />
            @afropuppyyoga · 10K+ followers
          </a>
        </motion.div>
      </div>
    </section>
  );
}
