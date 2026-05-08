/* ============================================================
   Careers Page — AfroPuppyYoga
   Design: Warm Afro-Wellness Editorial (matches main site)
   ============================================================ */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { MapPin, Clock, Heart, Upload, CheckCircle, X, ChevronDown } from "lucide-react";

/// ── Job listings ────────────────────────────────────────────
const JOB_LISTINGS = [
  {
    id: "yoga-instructor-kw",
    title: "Yoga Instructor",
    location: "Kitchener-Waterloo",
    locationCode: "KW",
    type: "Part-Time",
    emoji: "🧘",
    description:
      "Lead our signature 40-minute guided yoga sessions set to Afro-beat rhythms with adorable puppies on the mat. You'll create a joyful, inclusive, and energizing experience for guests of all skill levels. This is not your typical yoga class — it's a celebration of wellness, culture, and community.",
    responsibilities: [
      "Lead 40-minute guided yoga sessions for groups of 10-30 guests",
      "Create a welcoming, inclusive atmosphere for all skill levels",
      "Coordinate with the puppy monitor team during class",
      "Adapt sequences to accommodate puppies and spontaneous moments",
      "Represent the AfroPuppyYoga brand with warmth and professionalism",
    ],
    requirements: [
      "Certified yoga instructor (200hr minimum)",
      "Experience teaching group classes",
      "Comfortable and enthusiastic around dogs",
      "Energetic, charismatic, and community-oriented",
      "Alignment with APY's Afro-wellness brand values",
    ],
    perks: [
      "Competitive per-class pay",
      "Free access to APY classes",
      "Flexible event-based scheduling",
      "Opportunity to grow with a rapidly expanding brand",
    ],
  },
  {
    id: "puppy-monitor-kw",
    title: "Puppy Monitor",
    location: "Kitchener-Waterloo",
    locationCode: "KW",
    type: "Part-Time",
    badge: "Paid Volunteer",
    emoji: "🐾",
    description:
      "You'll be the guardian of our four-legged guests during every class. Your job is to keep the puppies safe, happy, and engaged while our guests enjoy their yoga session. You'll handle puppies before, during, and after class — feeding, cleaning, and making sure every pup is thriving.",
    responsibilities: [
      "Supervise and handle puppies throughout each class session",
      "Ensure the safety and wellbeing of all puppies at all times",
      "Assist with puppy setup, feeding, and post-class care",
      "Engage with guests and create a warm, welcoming atmosphere",
      "Coordinate with the lead instructor on puppy placement and flow",
    ],
    requirements: [
      "Genuine love for dogs and experience handling them",
      "Calm, patient, and attentive personality",
      "Comfortable in a high-energy, social environment",
      "Reliable and punctual for event-based scheduling",
      "First aid for animals is a plus but not required",
    ],
    perks: [
      "Free access to APY classes",
      "Flexible part-time schedule",
      "Be part of a growing, community-driven brand",
      "Puppy cuddles — obviously",
    ],
  },
  {
    id: "bdr",
    title: "Business Development Representative",
    location: "Remote / Canada",
    locationCode: "REMOTE",
    type: "Flexible",
    badge: "Commission-Based",
    emoji: "💼",
    description:
      "Help AfroPuppyYoga grow its brand, partnerships, and community reach. As our BDR, you'll identify and nurture new business opportunities — from corporate wellness partnerships and private event bookings to sponsorships and brand collaborations. You're a natural connector who loves wellness, community, and closing deals.",
    responsibilities: [
      "Identify and pursue new corporate wellness and private event leads",
      "Pitch AfroPuppyYoga to potential partners, sponsors, and collaborators",
      "Manage outreach via email, LinkedIn, and direct networking",
      "Follow up with warm leads and convert inquiries into bookings",
      "Report on pipeline activity and conversion metrics",
    ],
    requirements: [
      "Proven experience in sales, business development, or partnerships",
      "Excellent written and verbal communication skills",
      "Self-motivated and comfortable working independently",
      "Passion for wellness, community, and the APY brand",
      "Experience with CRM tools is a plus",
    ],
    perks: [
      "Competitive commission on every booking or deal closed",
      "Flexible remote schedule — work from anywhere in Canada",
      "Free access to APY classes",
      "Opportunity to shape the growth of a fast-rising wellness brand",
    ],
  },
  {
    id: "puppy-monitor-ham",
    title: "Puppy Monitor",
    location: "Hamilton",
    locationCode: "HAM",
    type: "Part-Time",
    badge: "Paid Volunteer",
    emoji: "🐾",
    description:
      "You'll be the guardian of our four-legged guests during every class. Your job is to keep the puppies safe, happy, and engaged while our guests enjoy their yoga session. You'll handle puppies before, during, and after class — feeding, cleaning, and making sure every pup is thriving.",
    responsibilities: [
      "Supervise and handle puppies throughout each class session",
      "Ensure the safety and wellbeing of all puppies at all times",
      "Assist with puppy setup, feeding, and post-class care",
      "Engage with guests and create a warm, welcoming atmosphere",
      "Coordinate with the lead instructor on puppy placement and flow",
    ],
    requirements: [
      "Genuine love for dogs and experience handling them",
      "Calm, patient, and attentive personality",
      "Comfortable in a high-energy, social environment",
      "Reliable and punctual for event-based scheduling",
      "First aid for animals is a plus but not required",
    ],
    perks: [
      "Free access to APY classes",
      "Flexible part-time schedule",
      "Be part of a growing, community-driven brand",
      "Puppy cuddles — obviously",
    ],
  },
];

// ── Application Modal ─────────────────────────────────────────
interface ApplicationModalProps {
  job: (typeof JOB_LISTINGS)[0];
  onClose: () => void;
}

function ApplicationModal({ job, onClose }: ApplicationModalProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    whyAPY: "",
    experience: "",
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to error message whenever it changes
  useEffect(() => {
    if (error && errorRef.current && modalRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  const applyMutation = trpc.careers.submitApplication.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message || "Something went wrong. Please try again."),
  });

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be under 100MB.");
      return;
    }
    setVideoFile(file);
    setError(null);
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Resume must be under 10MB.");
      return;
    }
    setResumeFile(file);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.email) {
      setError("Name and email are required.");
      return;
    }
    if (!videoFile) {
      setError("A video introduction is required. Please upload a short 1-2 minute video.");
      return;
    }
    if (!resumeFile) {
      setError("A resume is required. Please upload your resume (PDF or Word).");
      return;
    }

    // Helper: upload a small file with XHR for progress tracking (used for resume)
    const uploadWithProgress = (url: string, fieldName: string, file: File, label: string): Promise<{ url: string; key: string }> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 3 * 60 * 1000; // 3 minute timeout
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
            setUploadStatus(`Uploading ${label}... ${pct}%`);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error ?? `${label} upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`${label} upload failed (${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => reject(new Error(`${label} upload failed. Please check your connection.`));
        xhr.ontimeout = () => reject(new Error(`${label} upload timed out. Please try a smaller file or check your connection.`));
        const fd = new FormData();
        fd.append(fieldName, file);
        xhr.open("POST", url);
        xhr.send(fd);
      });
    };

    // Chunked upload for video — splits file into 1MB pieces to bypass hosting proxy body size limit
    const uploadVideoChunked = async (file: File): Promise<{ url: string; key: string }> => {
      const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB per chunk (keeps each request under proxy timeout)
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // 1. Initiate upload session
      setUploadStatus("Preparing video upload...");
      const initRes = await fetch("/api/upload-video-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, totalChunks, totalSize: file.size }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to initiate video upload");
      }
      const { uploadId } = await initRes.json();

      // 2. Upload each chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const pct = Math.round(((i + 1) / totalChunks) * 90); // reserve last 10% for assembly
        setUploadProgress(pct);
        setUploadStatus(`Uploading video... ${pct}% (part ${i + 1} of ${totalChunks})`);

        const fd = new FormData();
        fd.append("uploadId", uploadId);
        fd.append("chunkIndex", String(i));
        fd.append("chunk", chunk, `chunk-${i}`);

        const chunkRes = await fetch("/api/upload-video-chunk", { method: "POST", body: fd });
        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed to upload video part ${i + 1}`);
        }
      }

      // 3. Complete the upload — server assembles chunks and uploads to S3
      setUploadProgress(95);
      setUploadStatus("Finalizing video upload...");
      const completeRes = await fetch("/api/upload-video-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to finalize video upload");
      }
      setUploadProgress(100);
      return completeRes.json();
    };

    setIsUploading(true);
    setUploadProgress(0);

    // Upload video using chunked upload (handles any file size)
    let videoUrl: string;
    let videoKey: string | undefined;
    try {
      const data = await uploadVideoChunked(videoFile);
      videoUrl = data.url;
      videoKey = data.key;
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus(null);
      setError(err.message ?? "Video upload failed. Please try again.");
      return;
    }

    // Upload resume
    let resumeUrl: string;
    let resumeKey: string | undefined;
    try {
      setUploadProgress(0);
      setUploadStatus("Uploading resume...");
      const data = await uploadWithProgress("/api/upload-resume", "resume", resumeFile, "Resume");
      resumeUrl = data.url;
      resumeKey = data.key;
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus(null);
      setError(err.message ?? "Resume upload failed. Please try again.");
      return;
    }

    setIsUploading(false);
    setUploadStatus(null);
    applyMutation.mutate({
      role: job.title,
      location: job.locationCode,
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      whyAPY: form.whyAPY || undefined,
      experience: form.experience || undefined,
      videoUrl,
      videoKey,
      resumeUrl,
      resumeKey,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={modalRef} className="relative bg-[#FEFAF4] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#FEFAF4] border-b border-[#F0D0DC] px-6 py-4 flex items-start justify-between rounded-t-2xl z-10">
          <div>
            <p className="font-body text-xs text-[#8B2252] uppercase tracking-widest mb-1">Apply Now</p>
            <h2 className="font-display font-bold text-xl text-[#1A0A12]">
              {job.title} <span className="text-[#C2185B]">— {job.location}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F0D0DC] transition-colors text-[#1A0A12] mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-[#F9E4EE] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-[#C2185B]" />
            </div>
            <h3 className="font-display font-bold text-2xl text-[#1A0A12] mb-3">Application Received!</h3>
            <p className="font-body text-[#5A3040] text-base leading-relaxed mb-6">
              Thank you for applying to join the AfroPuppyYoga family. We'll review your application and reach out if you're a great fit.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#C2185B] text-white font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
            {/* Error banner — shown at top so it's always visible */}
            {error && (
              <div ref={errorRef} className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="font-body text-sm text-red-600">{error}</p>
              </div>
            )}
            {/* Personal Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-[#C2185B]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 bg-white border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] placeholder-[#C4A0B0] focus:outline-none focus:border-[#C2185B] focus:ring-1 focus:ring-[#C2185B]/30 transition-colors"
                />
              </div>
              <div>
                <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                  Email <span className="text-[#C2185B]">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 bg-white border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] placeholder-[#C4A0B0] focus:outline-none focus:border-[#C2185B] focus:ring-1 focus:ring-[#C2185B]/30 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2.5 bg-white border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] placeholder-[#C4A0B0] focus:outline-none focus:border-[#C2185B] focus:ring-1 focus:ring-[#C2185B]/30 transition-colors"
              />
            </div>

            <div>
              <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                Why do you want to join AfroPuppyYoga?
              </label>
              <textarea
                value={form.whyAPY}
                onChange={(e) => setForm({ ...form, whyAPY: e.target.value })}
                placeholder="Tell us what draws you to APY and what you'd bring to the team..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] placeholder-[#C4A0B0] focus:outline-none focus:border-[#C2185B] focus:ring-1 focus:ring-[#C2185B]/30 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                Relevant Experience
              </label>
              <textarea
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
                placeholder="Share your relevant experience (yoga certifications, dog handling, event work, etc.)..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] placeholder-[#C4A0B0] focus:outline-none focus:border-[#C2185B] focus:ring-1 focus:ring-[#C2185B]/30 transition-colors resize-none"
              />
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                Resume <span className="text-[#C2185B]">*</span> <span className="text-[#8B2252] font-normal">(PDF or Word, Max 10MB)</span>
              </label>
              <p className="font-body text-xs text-[#8B6070] mb-3">
                Upload your most recent resume or CV.
              </p>
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeChange}
                className="hidden"
              />
              {resumeFile ? (
                <div className="flex items-center gap-3 p-3 bg-[#F9E4EE] border border-[#F0D0DC] rounded-xl">
                  <CheckCircle size={18} className="text-[#C2185B] shrink-0" />
                  <span className="font-body text-sm text-[#1A0A12] truncate flex-1">{resumeFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setResumeFile(null); if (resumeInputRef.current) resumeInputRef.current.value = ""; }}
                    className="p-1 hover:bg-[#F0D0DC] rounded-full transition-colors text-[#5A3040]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => resumeInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[#F0D0DC] rounded-xl hover:border-[#C2185B] hover:bg-[#FFF0F5] transition-colors group"
                >
                  <Upload size={24} className="text-[#C4A0B0] group-hover:text-[#C2185B] transition-colors" />
                  <span className="font-body text-sm text-[#8B6070] group-hover:text-[#C2185B] transition-colors">
                    Click to upload your resume
                  </span>
                  <span className="font-body text-xs text-[#C4A0B0]">PDF, DOC, DOCX — Max 10MB</span>
                </button>
              )}
            </div>

            {/* Video Upload */}
            <div>
              <label className="block font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide mb-1.5">
                Video Introduction <span className="text-[#C2185B]">*</span> <span className="text-[#8B2252] font-normal">(Max 100MB)</span>
              </label>
              <p className="font-body text-xs text-[#8B6070] mb-3">
                Record a short 1-2 minute video introducing yourself. Tell us your name, why you love what you do, and why APY feels like the right fit. Be yourself!
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />
              {videoFile ? (
                <div className="flex items-center gap-3 p-3 bg-[#F9E4EE] border border-[#F0D0DC] rounded-xl">
                  <CheckCircle size={18} className="text-[#C2185B] shrink-0" />
                  <span className="font-body text-sm text-[#1A0A12] truncate flex-1">{videoFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setVideoFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="p-1 hover:bg-[#F0D0DC] rounded-full transition-colors text-[#5A3040]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[#F0D0DC] rounded-xl hover:border-[#C2185B] hover:bg-[#FFF0F5] transition-colors group"
                >
                  <Upload size={24} className="text-[#C4A0B0] group-hover:text-[#C2185B] transition-colors" />
                  <span className="font-body text-sm text-[#8B6070] group-hover:text-[#C2185B] transition-colors">
                    Click to upload your video
                  </span>
                  <span className="font-body text-xs text-[#C4A0B0]">MP4, MOV, WebM — Max 100MB</span>
                </button>
              )}
            </div>

            {/* Upload progress bar */}
            {(isUploading || uploadStatus) && (
              <div className="space-y-2">
                <div className="w-full bg-[#F0D0DC] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-[#C2185B] rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="font-body text-xs text-[#8B2252] text-center">{uploadStatus}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={applyMutation.isPending || isUploading}
              className="w-full py-3 bg-[#C2185B] text-white font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? uploadStatus ?? "Uploading..." : applyMutation.isPending ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────
function JobCard({ job, onApply, expanded, onToggle }: { job: (typeof JOB_LISTINGS)[0]; onApply: () => void; expanded: boolean; onToggle: () => void }) {

  return (
    <div className="bg-white border border-[#F0D0DC] rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#F9E4EE] rounded-xl flex items-center justify-center text-2xl shrink-0">
              {job.emoji}
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[#1A0A12]">{job.title}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-body text-xs text-[#8B2252]">
                  <MapPin size={11} /> {job.location}
                </span>
                <span className="flex items-center gap-1 font-body text-xs text-[#5A3040]">
                  <Clock size={11} /> {job.type}
                </span>
                {(job as any).badge && (
                  <span className="px-2 py-0.5 bg-[#C2185B]/10 text-[#C2185B] font-body text-[10px] font-semibold rounded-full border border-[#C2185B]/20">
                    {(job as any).badge}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onApply}
            className="shrink-0 px-4 py-2 bg-[#C2185B] text-white font-body font-semibold text-xs rounded-full hover:bg-[#8B2252] transition-colors"
          >
            Apply
          </button>
        </div>

        <p className="font-body text-sm text-[#5A3040] leading-relaxed mb-4">{job.description}</p>

        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 font-body text-xs font-semibold text-[#C2185B] hover:text-[#8B2252] transition-colors"
        >
          {expanded ? "Show less" : "See full details"}
          <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {expanded && (
          <div className="mt-5 space-y-4 border-t border-[#F0D0DC] pt-5">
            <div>
              <h4 className="font-body text-xs font-bold text-[#1A0A12] uppercase tracking-wide mb-2">Responsibilities</h4>
              <ul className="space-y-1.5">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 font-body text-sm text-[#5A3040]">
                    <span className="text-[#C2185B] mt-0.5 shrink-0">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-body text-xs font-bold text-[#1A0A12] uppercase tracking-wide mb-2">Requirements</h4>
              <ul className="space-y-1.5">
                {job.requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 font-body text-sm text-[#5A3040]">
                    <span className="text-[#C2185B] mt-0.5 shrink-0">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-body text-xs font-bold text-[#1A0A12] uppercase tracking-wide mb-2">Perks</h4>
              <ul className="space-y-1.5">
                {job.perks.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 font-body text-sm text-[#5A3040]">
                    <Heart size={12} className="text-[#C2185B] mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onApply}
              className="w-full py-2.5 bg-[#C2185B] text-white font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] transition-colors"
            >
              Apply for This Role
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function Careers() {
  const [selectedJob, setSelectedJob] = useState<(typeof JOB_LISTINGS)[0] | null>(null);
  // Track expanded state per job ID so each card is fully independent
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-[#3D1A2E] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 60%, #8B2252 0%, transparent 55%), radial-gradient(circle at 85% 20%, #C2185B 0%, transparent 40%)`,
          }}
        />
        <div className="container relative">
          <div className="max-w-2xl">
            <p className="font-body text-xs text-[#F2A0B8] uppercase tracking-widest mb-4">
              — Join the Pack
            </p>
            <h1 className="font-display font-bold text-4xl md:text-5xl text-white leading-tight mb-5">
              Work With <span className="text-[#F2A0B8]">AfroPuppyYoga</span>
            </h1>
            <p className="font-body text-base text-white/70 leading-relaxed max-w-xl">
              We're building Canada's most joyful wellness brand — one puppy at a time. If you love dogs, community, and creating unforgettable experiences, we want to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Values strip */}
      <section className="bg-[#F9E4EE] py-8 border-y border-[#F0D0DC]">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { icon: "🐾", label: "Puppy-First Culture" },
              { icon: "💛", label: "Community Driven" },
              { icon: "✨", label: "Flexible Schedules" },
            ].map((v) => (
              <div key={v.label} className="flex flex-col items-center gap-2">
                <span className="text-2xl">{v.icon}</span>
                <span className="font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10">
            <p className="font-body text-xs text-[#8B2252] uppercase tracking-widest mb-2">Open Positions</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-[#1A0A12]">
              We're Hiring
            </h2>
            <p className="font-body text-sm text-[#5A3040] mt-3 max-w-xl">
              All roles at AfroPuppyYoga are part-time given the nature of our event-based business. Perfect for passionate people who want flexibility without sacrificing impact.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {JOB_LISTINGS.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onApply={() => setSelectedJob(job)}
                expanded={expandedIds.has(job.id)}
                onToggle={() => toggleExpanded(job.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#3D1A2E]">
        <div className="container text-center">
          <p className="font-body text-xs text-[#F2A0B8] uppercase tracking-widest mb-3">Don't see your role?</p>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-white mb-4">
            We're always open to great people
          </h2>
          <p className="font-body text-sm text-white/60 mb-6 max-w-md mx-auto">
            If you have a skill that could help AfroPuppyYoga grow, reach out. We love hearing from passionate people.
          </p>
          <a
            href="mailto:afropuppyyogaofficial@gmail.com"
            className="inline-flex items-center px-6 py-3 bg-[#F2A0B8] text-[#1A0A12] font-body font-semibold text-sm rounded-full hover:bg-[#D4708A] transition-colors"
          >
            Say Hello
          </a>
        </div>
      </section>

      <Footer />
      <ScrollToTop />

      {/* Application Modal */}
      {selectedJob && (
        <ApplicationModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}
