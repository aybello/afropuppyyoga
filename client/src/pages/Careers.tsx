/* ============================================================
   Careers Page — AfroPuppyYoga
   Design: Warm Afro-Wellness Editorial (matches main site)
   ============================================================ */
import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  NEW_CAREERS_LISTINGS,
  PUPPY_MONITOR_SHIFT_DESCRIPTION,
} from "@shared/newCareersListings";
import {
  PUPPY_MONITOR_PAY_DESCRIPTION,
  PUPPY_MONITOR_PAY_LABEL,
  PUPPY_MONITOR_POSITION_TYPE,
} from "@shared/puppyMonitorTerms";
import {
  SOCIAL_MEDIA_INTERN_PAY_DESCRIPTION,
  SOCIAL_MEDIA_INTERN_PAY_LABEL,
} from "@shared/socialMediaTerms";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { publicPortraitUrl } from "@shared/publicPortraits";
import { recoverPublicPortrait } from "@/lib/publicPortraitRecovery";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { recoverCompletedVideoUpload } from "@/lib/videoUploadRecovery";
import {
  createLocalVideoPreview,
  releaseLocalVideoPreview,
} from "@/lib/localVideoPreview";
import { createSubmissionKey } from "@/lib/submissionKey";
import { filterCareers } from "./careerFilters";
import {
  EXPERIENCE_LIMIT,
  REFERRED_BY_LIMIT,
  WHY_APY_LIMIT,
  normalizeReferredBy,
  validateCareerApplication,
  validateReferredBy,
  validateVideoFile,
  validateVideoLink,
} from "./careerApplicationValidation";
import {
  MapPin,
  Clock,
  Heart,
  Upload,
  CheckCircle,
  X,
  ChevronDown,
  Link as LinkIcon,
  Video,
  Share2,
  Copy,
  Check,
  Activity,
  PawPrint,
  Settings,
} from "lucide-react";

/// ── Job listings ────────────────────────────────────────────
export type CareerJob = {
  id: string;
  title: string;
  location: string;
  locationCode: string;
  type: string;
  badge?: string;
  subBadge?: string;
  pay?: string;
  emoji?: string;
  icon?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  perks: string[];
};
export const JOB_LISTINGS: CareerJob[] = [
  ...NEW_CAREERS_LISTINGS,
  // ── Yoga Instructors ──────────────────────────────────────
  {
    id: "yoga-instructor-kw",
    title: "Yoga Instructor",
    location: "Kitchener-Waterloo",
    locationCode: "KW",
    type: "Part-Time",
    badge: "Now Hiring",
    emoji: "🧘",
    description:
      "Lead our signature 40-minute guided yoga sessions set to Afro-beat rhythms with adorable puppies on the mat. You'll create a joyful, inclusive, and energizing experience for guests of all skill levels. This is not your typical yoga class — it's a celebration of wellness, culture, and community. Shifts typically run 10am–2:30pm or 10am–4:30pm.",
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
    pay: "$22/hr",
    perks: [
      "$22/hr",
      "Free access to APY classes",
      "Flexible event-based scheduling",
      "Opportunity to grow with a rapidly expanding brand",
    ],
  },
  {
    id: "yoga-instructor-oakville",
    title: "Yoga Instructor",
    location: "Oakville",
    locationCode: "OAK",
    type: "Part-Time",
    badge: "Now Hiring",
    emoji: "🧘",
    pay: "$22/hr",
    description:
      "Lead our signature 40-minute guided yoga sessions set to Afro-beat rhythms with adorable puppies on the mat. You'll create a joyful, inclusive, and energizing experience for guests of all skill levels. This is not your typical yoga class — it's a celebration of wellness, culture, and community. Shifts typically run 10am–2:30pm or 10am–4:30pm.",
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
      "$22/hr",
      "Free access to APY classes",
      "Flexible event-based scheduling",
      "Opportunity to grow with a rapidly expanding brand",
    ],
  },
  // ── Puppy Monitors ────────────────────────────────────────
  {
    id: "puppy-monitor-kw",
    title: "Puppy Monitor",
    location: "Kitchener-Waterloo",
    locationCode: "KW",
    type: PUPPY_MONITOR_POSITION_TYPE,
    badge: "Now Hiring",
    pay: PUPPY_MONITOR_PAY_LABEL,
    emoji: "🐾",
    description: `You'll be the guardian of our four-legged guests during every class. Your job is to keep the puppies safe, happy, and engaged while our guests enjoy their yoga session. You'll handle puppies before, during, and after class, feeding, cleaning, and making sure every pup is thriving. This role is perfect for university and college students looking for flexible, fun, part-time work. ${PUPPY_MONITOR_SHIFT_DESCRIPTION}`,
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
      "University or college students encouraged to apply",
      "First aid for animals is a plus but not required",
    ],
    perks: [
      PUPPY_MONITOR_PAY_DESCRIPTION,
      "Free access to APY classes",
      "Flexible part-time schedule",
      "Be part of a growing, community-driven brand",
      "Puppy cuddles — obviously",
    ],
  },
  {
    id: "puppy-monitor-ham",
    title: "Puppy Monitor",
    location: "Hamilton",
    locationCode: "HAM",
    type: PUPPY_MONITOR_POSITION_TYPE,
    badge: "Now Hiring",
    pay: PUPPY_MONITOR_PAY_LABEL,
    emoji: "🐾",
    description: `You'll be the guardian of our four-legged guests during every class. Your job is to keep the puppies safe, happy, and engaged while our guests enjoy their yoga session. You'll handle puppies before, during, and after class, feeding, cleaning, and making sure every pup is thriving. This role is perfect for university and college students looking for flexible, fun, part-time work. ${PUPPY_MONITOR_SHIFT_DESCRIPTION}`,
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
      "University or college students encouraged to apply",
      "First aid for animals is a plus but not required",
    ],
    perks: [
      PUPPY_MONITOR_PAY_DESCRIPTION,
      "Free access to APY classes",
      "Flexible part-time schedule",
      "Be part of a growing, community-driven brand",
      "Puppy cuddles — obviously",
    ],
  },
  {
    id: "puppy-monitor-oakville",
    title: "Puppy Monitor",
    location: "Oakville",
    locationCode: "OAK",
    type: PUPPY_MONITOR_POSITION_TYPE,
    badge: "Now Hiring",
    pay: PUPPY_MONITOR_PAY_LABEL,
    emoji: "🐾",
    description: `You'll be the guardian of our four-legged guests during every class. Your job is to keep the puppies safe, happy, and engaged while our guests enjoy their yoga session. You'll handle puppies before, during, and after class, feeding, cleaning, and making sure every pup is thriving. This role is perfect for university and college students looking for flexible, fun, part-time work. ${PUPPY_MONITOR_SHIFT_DESCRIPTION}`,
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
      "University or college students encouraged to apply",
      "First aid for animals is a plus but not required",
    ],
    perks: [
      PUPPY_MONITOR_PAY_DESCRIPTION,
      "Free access to APY classes",
      "Flexible part-time schedule",
      "Be part of a growing, community-driven brand",
      "Puppy cuddles — obviously",
    ],
  },
  // ── Puppy Specialist ──────────────────────────────────────
  {
    id: "puppy-specialist",
    title: "Puppy Specialist",
    location: "Hamilton / Kitchener-Waterloo",
    locationCode: "HAM / KW",
    type: "Part-Time",
    badge: "Now Hiring",
    pay: "$18/hr",
    emoji: "🐶",
    description:
      "As our Puppy Specialist, you are the expert on all things puppy at AfroPuppyYoga. You'll be responsible for sourcing, vetting, and coordinating with our breeder and rescue partners to ensure every litter that joins our classes is healthy, well-socialized, and ethically cared for. You'll also serve as the on-site puppy welfare lead during events, making sure every pup has a safe and positive experience from arrival to departure.",
    responsibilities: [
      "Source and vet breeder and rescue partners for class puppies",
      "Coordinate puppy logistics — transport, scheduling, and breed announcements",
      "Serve as the on-site puppy welfare lead during classes and events",
      "Monitor puppy health, behaviour, and stress levels throughout each session",
      "Train and supervise Puppy Monitor volunteers on proper handling techniques",
      "Maintain records of all puppy partners and welfare standards",
    ],
    requirements: [
      "Hands-on experience working with dogs (professional or extensive personal)",
      "Knowledge of puppy development, behaviour, and welfare best practices",
      "Strong organizational skills for coordinating logistics across multiple locations",
      "Calm, confident, and compassionate approach to animal handling",
      "Canine first aid certification is a strong asset",
      "Passion for ethical animal care and the APY brand values",
    ],
    perks: [
      "Competitive part-time pay",
      "Free access to APY classes",
      "Flexible event-based scheduling",
      "Direct impact on the welfare standards of a fast-growing wellness brand",
      "Work alongside the most adorable co-workers imaginable",
    ],
  },
  // ── Remote / Other ────────────────────────────────────────
  {
    id: "bdr",
    title: "Business Development Representative",
    location: "Remote / Canada",
    locationCode: "REMOTE",
    type: "Flexible",
    badge: "Now Hiring",
    subBadge: "Commission-Based",
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
  // ── Operations Specialist ───────────────────────────────
  {
    id: "operations-specialist-kw",
    title: "Operations Specialist",
    location: "Kitchener-Waterloo",
    locationCode: "KW",
    type: "Part-Time",
    badge: "Now Hiring",
    emoji: "⚙️",
    pay: "$20/hr",
    description:
      "Keep AfroPuppyYoga's Kitchener classes running smoothly from first setup to final reset. You'll coordinate event-day flow, staff and guest readiness, breeder and puppy-partner logistics, and the little operational details that make every session feel seamless.",
    responsibilities: [
      "Prepare the venue, supplies, and guest flow before each class and complete the reset afterward",
      "Coordinate staff arrival, guest check-in, class flow, and on-site communications",
      "Support breeder and puppy-partner arrival, handoff, supplies, and event-day logistics",
      "Track attendance, supplies, incidents, and follow-up items for APY leadership",
      "Help maintain a safe, welcoming experience for guests, staff, and puppies",
      "Escalate staffing, venue, safety, or guest concerns promptly and professionally",
    ],
    requirements: [
      "Available and reliable for weekend event-based shifts in Kitchener-Waterloo",
      "Organized, calm under pressure, and comfortable taking initiative",
      "Strong communication and problem-solving skills",
      "Comfortable and enthusiastic around dogs",
      "Previous event, hospitality, studio, or operations experience is an asset",
      "Access to reliable transportation is preferred",
    ],
    perks: [
      "$20/hr",
      "Free access to APY classes",
      "Hands-on experience in wellness events and operations",
      "Be part of a fast-growing, community-loved brand",
      "Puppies every shift — enough said",
    ],
  },
  {
    id: "operations-specialist-oakville",
    title: "Operations Specialist",
    location: "Oakville",
    locationCode: "OAK",
    type: "Part-Time",
    badge: "Now Hiring",
    emoji: "⚙️",
    pay: "$20/hr",
    description:
      "Keep AfroPuppyYoga's Oakville classes running smoothly from first setup to final reset. You'll coordinate event-day flow, staff and guest readiness, breeder and puppy-partner logistics, and the little operational details that make every session feel seamless.",
    responsibilities: [
      "Prepare the venue, supplies, and guest flow before each class and complete the reset afterward",
      "Coordinate staff arrival, guest check-in, class flow, and on-site communications",
      "Support breeder and puppy-partner arrival, handoff, supplies, and event-day logistics",
      "Track attendance, supplies, incidents, and follow-up items for APY leadership",
      "Help maintain a safe, welcoming experience for guests, staff, and puppies",
      "Escalate staffing, venue, safety, or guest concerns promptly and professionally",
    ],
    requirements: [
      "Available and reliable for weekend event-based shifts in Oakville",
      "Organized, calm under pressure, and comfortable taking initiative",
      "Strong communication and problem-solving skills",
      "Comfortable and enthusiastic around dogs",
      "Previous event, hospitality, studio, or operations experience is an asset",
      "Access to reliable transportation is preferred",
    ],
    perks: [
      "$20/hr",
      "Free access to APY classes",
      "Hands-on experience in wellness events and operations",
      "Be part of a fast-growing, community-loved brand",
      "Puppies every shift — enough said",
    ],
  },
  {
    id: "social-media-intern",
    title: "Social Media Intern",
    location: "Remote / Canada",
    locationCode: "REMOTE",
    type: "Part-Time",
    badge: "Now Hiring",
    subBadge: "Paid",
    pay: SOCIAL_MEDIA_INTERN_PAY_LABEL,
    emoji: "📱",
    description:
      "You live on Instagram, you think in Reels, and you have a genuine love for wellness and community. As our Social Media Intern, you'll help shape the online voice of AfroPuppyYoga — creating content, engaging our community, and growing our presence across platforms. This is a hands-on role where your creativity directly impacts a fast-growing brand.",
    responsibilities: [
      "Create and schedule engaging content across Instagram, TikTok, and Facebook",
      "Film and edit Reels, Stories, and short-form video content",
      "Engage with our community — respond to comments, DMs, and mentions",
      "Assist with content planning and monthly social media calendar",
      "Track performance metrics and share insights with the team",
      "Support influencer outreach and brand collaboration campaigns",
    ],
    requirements: [
      "Strong understanding of Instagram and TikTok content trends",
      "Basic video editing skills (CapCut, Reels editor, or similar)",
      "Excellent written communication and brand voice awareness",
      "Passionate about wellness, community, and the APY brand",
      "Self-motivated and able to work independently in a remote setting",
      "Portfolio or examples of past social media work is a strong asset",
    ],
    perks: [
      SOCIAL_MEDIA_INTERN_PAY_DESCRIPTION,
      "Flexible remote schedule",
      "Free access to APY classes",
      "Hands-on experience growing a real brand with 13.7K Instagram followers",
      "Mentorship and creative freedom to bring your ideas to life",
      "Be part of a culturally rich, community-driven wellness brand",
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
    referredBy: "",
    whyAPY: "",
    experience: "",
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewError, setVideoPreviewError] = useState<string | null>(
    null
  );
  const [videoLink, setVideoLink] = useState("");
  const [videoMode, setVideoMode] = useState<"upload" | "link">("upload");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<{
    fingerprint: string;
    url: string;
    key: string;
  } | null>(null);
  const [uploadedResume, setUploadedResume] = useState<{
    fingerprint: string;
    url: string;
    key: string;
  } | null>(null);
  const [submitted, setSubmitted] = useState<"new" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionUnconfirmed, setSubmissionUnconfirmed] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isReferralLocked, setIsReferralLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const referredByError = validateReferredBy(form.referredBy);
  const errorRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const submissionKeyRef = useRef(createSubmissionKey());

  // Auto-scroll to error message whenever it changes
  useEffect(() => {
    if (error && errorRef.current && modalRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  // Keep the selected video on the applicant's device until they submit. The
  // browser-local object URL is released whenever the file changes or the form closes.
  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null);
      return;
    }

    const previewUrl = createLocalVideoPreview(videoFile);
    setVideoPreviewUrl(previewUrl);
    return () => releaseLocalVideoPreview(previewUrl);
  }, [videoFile]);

  const applyMutation = trpc.careers.submitApplication.useMutation({
    // Do not queue an offline application for replay after the form is closed.
    networkMode: "always",
    onSuccess: result => {
      setSubmitted(result.duplicate ? "duplicate" : "new");
      setIsReferralLocked(false);
    },
    onError: err => {
      setError(err.message || "Something went wrong. Please try again.");
      setSubmissionUnconfirmed(true);
      setIsReferralLocked(false);
    },
  });

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateVideoFile(file);
    if (fileError) {
      e.target.value = "";
      setVideoFile(null);
      setUploadedVideo(null);
      setVideoPreviewError(null);
      setError(fileError);
      return;
    }
    setVideoFile(file);
    setUploadedVideo(null);
    setVideoPreviewError(null);
    setError(null);
  };

  const clearVideoSelection = () => {
    setVideoFile(null);
    setUploadedVideo(null);
    setVideoPreviewError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Resume must be under 10MB.");
      return;
    }
    setResumeFile(file);
    setUploadedResume(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateCareerApplication({
      form, resumeFile, videoMode, videoFile, videoLink,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    // The preflight requires a resume; keep the narrowing local to this flow.
    if (!resumeFile) return;
    // Commit the lock before capturing the value and keep it through the
    // upload-to-mutation handoff, even if the mutation state updates later.
    flushSync(() => setIsReferralLocked(true));
    const referredBy = normalizeReferredBy(form.referredBy);

    // Helper: upload a small file with XHR for progress tracking (used for resume)
    const uploadWithProgress = (
      url: string,
      fieldName: string,
      file: File,
      label: string
    ): Promise<{ url: string; key: string }> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 3 * 60 * 1000; // 3 minute timeout
        xhr.upload.onprogress = e => {
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
              reject(
                new Error(err.error ?? `${label} upload failed (${xhr.status})`)
              );
            } catch {
              reject(new Error(`${label} upload failed (${xhr.status})`));
            }
          }
        };
        xhr.onerror = () =>
          reject(
            new Error(`${label} upload failed. Please check your connection.`)
          );
        xhr.ontimeout = () =>
          reject(
            new Error(
              `${label} upload timed out. Please try a smaller file or check your connection.`
            )
          );
        const fd = new FormData();
        fd.append(fieldName, file);
        xhr.open("POST", url);
        xhr.send(fd);
      });
    };

    const retryRequest = async (
      request: () => Promise<Response>,
      label: string,
      attempts = 5
    ): Promise<Response> => {
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const response = await request();
          if (response.ok) return response;
          const retryable =
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500;
          if (!retryable || attempt === attempts) return response;
          lastError = new Error(
            `${label} temporarily failed (${response.status})`
          );

          const retryAfterSeconds = Number(response.headers.get("Retry-After"));
          const delay =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : Math.min(1000 * 2 ** (attempt - 1), 10_000) +
                Math.round(Math.random() * 500);
          setUploadStatus(
            `${label} paused — retrying (${attempt}/${attempts})…`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } catch (error: any) {
          lastError =
            error instanceof Error ? error : new Error(`${label} failed`);
          if (attempt === attempts) throw lastError;
        }
        setUploadStatus(`${label} paused — retrying (${attempt}/${attempts})…`);
        const delay =
          Math.min(1000 * 2 ** (attempt - 1), 10_000) +
          Math.round(Math.random() * 500);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      throw lastError ?? new Error(`${label} failed`);
    };

    // Chunked upload for video — splits file into 5MB pieces
    // Bug 3 fix: was 1MB → 500MB video = 500 chunks > MAX_CHUNKS=200 → init rejected
    // Bug 1+2 fix: /api/upload-video-complete now assembles synchronously and returns { url, key } directly
    const uploadVideoChunked = async (
      file: File
    ): Promise<{ url: string; key: string }> => {
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk → 500MB / 5MB = 100 chunks (well under 200)
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // 1. Initiate upload session
      setUploadStatus("Preparing video upload...");
      const initRes = await retryRequest(
        () =>
          fetch("/api/upload-video-init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              totalChunks,
              totalSize: file.size,
              chunkSize: CHUNK_SIZE,
            }),
          }),
        "Preparing video upload"
      );
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to initiate video upload");
      }
      const { uploadId } = await initRes.json();

      // 2. Upload a few chunks in parallel. This is substantially faster on good
      // connections while remaining gentle enough for mobile networks and the server.
      let nextChunkIndex = 0;
      let uploadedChunks = 0;
      const uploadNextChunk = async (): Promise<void> => {
        const i = nextChunkIndex++;
        if (i >= totalChunks) return;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const fd = new FormData();
        fd.append("uploadId", uploadId);
        fd.append("chunkIndex", String(i));
        fd.append("chunk", chunk, `chunk-${i}`);

        const chunkRes = await retryRequest(
          () => fetch("/api/upload-video-chunk", { method: "POST", body: fd }),
          `Video part ${i + 1} of ${totalChunks}`
        );
        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed to upload video part ${i + 1}`);
        }

        uploadedChunks += 1;
        const pct = Math.round((uploadedChunks / totalChunks) * 85); // reserve last 15% for assembly
        setUploadProgress(pct);
        setUploadStatus(
          `Uploading video... ${pct}% (${uploadedChunks} of ${totalChunks} parts)`
        );
        await uploadNextChunk();
      };

      const parallelUploads = Math.min(3, totalChunks);
      await Promise.all(
        Array.from({ length: parallelUploads }, () => uploadNextChunk())
      );

      // 3. Synchronous assembly — server assembles all chunks and returns { url, key } directly.
      // The status endpoint provides durable recovery if the final response is interrupted.
      setUploadProgress(90);
      setUploadStatus(
        "Processing video... (this may take up to 2 minutes for large files)"
      );
      let completeRes: Response | null = null;
      try {
        completeRes = await retryRequest(
          () =>
            fetch("/api/upload-video-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uploadId }),
              signal: AbortSignal.timeout(180_000), // allow the server's 170s processing window to finish
            }),
          "Processing video",
          3
        );
      } catch {
        setUploadStatus("Checking whether your video finished processing...");
        const recovered = await recoverCompletedVideoUpload(uploadId);
        if (recovered) {
          setUploadProgress(100);
          return recovered;
        }
        throw new Error(
          "We could not confirm your video upload. Please try the upload again, or paste a viewable YouTube, Google Drive, Dropbox, or Loom link instead."
        );
      }
      if (!completeRes.ok) {
        setUploadStatus("Checking whether your video finished processing...");
        const recovered = await recoverCompletedVideoUpload(uploadId);
        if (recovered) {
          setUploadProgress(100);
          return recovered;
        }
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(
          err.error ??
            "We could not process your video. Please try again, or paste a viewable YouTube, Google Drive, Dropbox, or Loom link instead."
        );
      }
      const result = await completeRes.json();
      if (!result.url || !result.key) {
        throw new Error(
          "Video processing returned an unexpected response. Please try again."
        );
      }
      setUploadProgress(100);
      return { url: result.url, key: result.key };
    };

    setIsUploading(true);
    setUploadProgress(0);

    // Video is required — either upload the file or use the pasted link
    let videoUrl: string;
    let videoKey: string | undefined;
    if (videoMode === "link") {
      videoUrl = videoLink.trim();
    } else {
      try {
        const fingerprint = `${videoFile!.name}:${videoFile!.size}:${videoFile!.lastModified}`;
        const data =
          uploadedVideo?.fingerprint === fingerprint
            ? uploadedVideo
            : await uploadVideoChunked(videoFile!);
        videoUrl = data.url;
        videoKey = data.key;
        if (uploadedVideo?.fingerprint !== fingerprint) {
          setUploadedVideo({ fingerprint, url: data.url, key: data.key });
        }
      } catch (err: any) {
        setIsUploading(false);
        setIsReferralLocked(false);
        setUploadStatus(null);
        setError(err.message ?? "Video upload failed. Please try again.");
        return;
      }
    }

    // Upload resume
    let resumeUrl: string;
    let resumeKey: string;
    try {
      const fingerprint = `${resumeFile.name}:${resumeFile.size}:${resumeFile.lastModified}`;
      let data =
        uploadedResume?.fingerprint === fingerprint ? uploadedResume : null;
      if (!data) {
        setUploadProgress(0);
        setUploadStatus("Uploading resume...");
        const uploaded = await uploadWithProgress(
          "/api/upload-resume",
          "resume",
          resumeFile,
          "Resume"
        );
        data = { fingerprint, ...uploaded };
        setUploadedResume(data);
      }
      resumeUrl = data.url;
      resumeKey = data.key;
    } catch (err: any) {
      setIsUploading(false);
      setIsReferralLocked(false);
      setUploadStatus(null);
      setError(err.message ?? "Resume upload failed. Please try again.");
      return;
    }

    setIsUploading(false);
    setUploadStatus(null);
    applyMutation.mutate({
      role: job.title,
      location: job.locationCode,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone || undefined,
      referredBy,
      whyAPY: form.whyAPY || undefined,
      experience: form.experience || undefined,
      videoUrl: videoUrl,
      videoKey,
      resumeUrl,
      resumeKey,
      submissionKey: submissionKeyRef.current,
    });
  };

  const requestClose = () => {
    if (isReferralLocked && !window.confirm(
      "Your application is still uploading or submitting. If you close this form, the request may continue and we may still receive your application. Close anyway?"
    )) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={requestClose}
      />
      <div
        ref={modalRef}
        className="relative bg-[#FEFAF4] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#FEFAF4] border-b border-[#E8D8D0] px-6 py-4 flex items-start justify-between rounded-t-2xl z-10">
          <div>
            <p className="font-body text-xs text-brand-link uppercase tracking-widest mb-1">
              Apply Now
            </p>
            <h2 className="font-display font-medium text-xl text-[#34221D]">
              {job.title}{" "}
              <span className="text-brand-link">— {job.location}</span>
            </h2>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close application form"
            className="p-2 rounded-full hover:bg-[#E8D8D0] transition-colors text-[#34221D] mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-[#FDE9EF] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-brand-link" />
            </div>
            <h3 className="font-display font-medium text-2xl text-[#34221D] mb-3">
              Application Received!
            </h3>
            <p className="font-body text-[#34221D] text-base leading-relaxed mb-6">
              {submitted === "duplicate" ? (
                <>
                  An application has already been received. Changes in this
                  submission, including your referral, may not update the original
                  application. If you need a correction, please contact APY at{" "}
                  <a href="mailto:afropuppyyoga@gmail.com" className="underline">
                    afropuppyyoga@gmail.com
                  </a>.
                </>
              ) : (
                <>Your application has been received. We'll review it and reach out
                if you're a great fit.</>
              )}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-primary text-[#34221D] font-body font-semibold text-base min-h-12 rounded-full hover:bg-primary-hover transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-6">
            {/* Error banner — shown at top so it's always visible */}
            {(error || submissionUnconfirmed) && (
              <div
                ref={errorRef}
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-xl"
              >
                {error && <p className="font-body text-base text-red-600">{error}</p>}
                {submissionUnconfirmed && (
                  <p className="font-body text-base text-red-600">
                    We couldn't confirm whether your application was received. It
                    may already have been saved. If you retry, changes (including
                    your referral) may not update the original application. If you
                    need a correction, please contact APY at{" "}
                    <a href="mailto:afropuppyyoga@gmail.com" className="underline">
                      afropuppyyoga@gmail.com
                    </a>.
                  </p>
                )}
              </div>
            )}
            <div className="rounded-xl border border-[#E8D8D0] bg-[#FDE9EF] p-4 text-sm text-[#34221D] leading-relaxed" role="note">
              <strong>Before you start:</strong> Have your resume and a 1 to 2 minute introduction video ready. You can upload the video or share a link. Keep the form open while uploading.
            </div>
            {isReferralLocked && (
              <p role="status" className="rounded-xl bg-[#FDE9EF] p-3 font-body text-sm text-[#34221D]">
                Your application is being uploaded or submitted. Please keep this form open until it finishes.
              </p>
            )}
            {/* Personal Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-brand-link">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                  Email <span className="text-brand-link">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors"
              />
              <p className="mt-1.5 font-body text-xs leading-5 text-[#71574F]">
                Optional. We may text this number about your application,
                including your interview booking link. Reply STOP to opt out.
                You can still apply without a phone number.
              </p>
            </div>

            <div>
              <label htmlFor="career-referred-by" className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                Referred By
              </label>
              <input
                id="career-referred-by"
                type="text"
                disabled={isReferralLocked || isUploading || applyMutation.isPending}
                value={form.referredBy}
                onChange={e => {
                  setForm({ ...form, referredBy: e.target.value });
                  if (referredByError && error === referredByError) setError(null);
                }}
                aria-invalid={!!referredByError}
                aria-describedby={referredByError ? "career-referred-by-help career-referred-by-error" : "career-referred-by-help"}
                placeholder="Team member's name (optional)"
                className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p id="career-referred-by-help" className="mt-1.5 font-body text-xs leading-5 text-[#71574F]">
                Optional. If a team member told you to apply, write their name here.
                Maximum {REFERRED_BY_LIMIT} characters after trimming; some symbols count as two.
                <span role="status">{(isReferralLocked || isUploading || applyMutation.isPending) && " This field is locked while your application uploads and submits. If we cannot confirm submission, you can edit and retry, but changes may not update an already saved application."}</span>
              </p>
              {referredByError && (
                <p id="career-referred-by-error" className="mt-1 font-body text-xs text-red-600">
                  {referredByError}
                </p>
              )}
            </div>

            <div>
              <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                Why do you want to join AfroPuppyYoga?
              </label>
              <textarea
                value={form.whyAPY}
                onChange={e => setForm({ ...form, whyAPY: e.target.value })}
                placeholder="Tell us what draws you to APY and what you'd bring to the team..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors resize-none"
              />
              <p className={`mt-1 font-body text-xs ${form.whyAPY.length > WHY_APY_LIMIT ? "text-red-600" : "text-[#71574F]"}`}>
                {form.whyAPY.length} / {WHY_APY_LIMIT} characters
              </p>
            </div>

            <div>
              <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                Relevant Experience
              </label>
              <textarea
                value={form.experience}
                onChange={e => setForm({ ...form, experience: e.target.value })}
                placeholder="Share your relevant experience (yoga certifications, dog handling, event work, etc.)..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors resize-none"
              />
              <p className={`mt-1 font-body text-xs ${form.experience.length > EXPERIENCE_LIMIT ? "text-red-600" : "text-[#71574F]"}`}>
                {form.experience.length} / {EXPERIENCE_LIMIT} characters
              </p>
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                Resume <span className="text-brand-link">*</span>{" "}
                <span className="text-brand-link font-normal">
                  (PDF or Word, Max 10MB)
                </span>
              </label>
              <p className="font-body text-xs text-[#34221D] mb-3">
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
                <div className="flex items-center gap-3 p-3 bg-[#FDE9EF] border border-[#E8D8D0] rounded-xl">
                  <CheckCircle size={18} className="text-brand-link shrink-0" />
                  <span className="font-body text-base text-[#34221D] truncate flex-1">
                    {resumeFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeFile(null);
                      if (resumeInputRef.current)
                        resumeInputRef.current.value = "";
                    }}
                    className="p-1 hover:bg-[#E8D8D0] rounded-full transition-colors text-[#34221D]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => resumeInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[#E8D8D0] rounded-xl hover:border-primary hover:bg-[#FDE9EF] transition-colors group"
                >
                  <Upload
                    size={24}
                    className="text-[#71574F] group-hover:text-brand-link transition-colors"
                  />
                  <span className="font-body text-base text-[#34221D] group-hover:text-brand-link transition-colors">
                    Click to upload your resume
                  </span>
                  <span className="font-body text-xs text-[#71574F]">
                    PDF, DOC, DOCX — Max 10MB
                  </span>
                </button>
              )}
            </div>

            {/* Video Introduction — Required */}
            <div>
              <label className="block font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide mb-1.5">
                Video Introduction <span className="text-brand-link">*</span>
              </label>
              <p className="font-body text-xs text-[#34221D] mb-3">
                Record a short 1-2 minute video introducing yourself. Tell us
                your name, why you love what you do, and why APY feels like the
                right fit. Be yourself!
              </p>
              {/* Tab toggle: Upload vs Link */}
              <div className="flex rounded-xl overflow-hidden border border-[#E8D8D0] mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setVideoMode("upload");
                    setVideoLink("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-body text-xs font-semibold transition-colors ${
                    videoMode === "upload"
                      ? "bg-primary text-[#34221D]"
                      : "bg-white text-[#34221D] hover:bg-[#FDE9EF]"
                  }`}
                >
                  <Upload size={14} />
                  Upload Video
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideoMode("link");
                    clearVideoSelection();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-body text-xs font-semibold transition-colors ${
                    videoMode === "link"
                      ? "bg-primary text-[#34221D]"
                      : "bg-white text-[#34221D] hover:bg-[#FDE9EF]"
                  }`}
                >
                  <LinkIcon size={14} />
                  Paste a Link
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,.webm,.avi"
                onChange={handleVideoChange}
                className="hidden"
              />
              {videoMode === "upload" ? (
                videoFile ? (
                  <div className="space-y-3 p-3 bg-[#FDE9EF] border border-[#E8D8D0] rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle
                        size={18}
                        className="text-brand-link shrink-0"
                      />
                      <span className="font-body text-base text-[#34221D] truncate flex-1">
                        {videoFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={clearVideoSelection}
                        aria-label="Remove selected video"
                        className="p-1 hover:bg-[#E8D8D0] rounded-full transition-colors text-[#34221D]"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                    {videoPreviewUrl && (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={videoPreviewUrl}
                        onLoadedMetadata={() => setVideoPreviewError(null)}
                        onError={() =>
                          setVideoPreviewError(
                            "This video cannot play in this browser. You can choose another video or still submit this selected file."
                          )
                        }
                        aria-label={`Preview of selected video: ${videoFile.name}`}
                        className="w-full max-h-64 rounded-lg bg-[#34221D]"
                      >
                        Your browser does not support video playback. You can
                        choose another video or submit this selected file.
                      </video>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-body text-xs text-[#34221D]">
                        Preview is only on this device. Your video is uploaded
                        only when you submit the application.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                          fileInputRef.current?.click();
                        }}
                        className="font-body text-xs font-semibold text-brand-link underline underline-offset-2 hover:text-brand-link"
                      >
                        Change video
                      </button>
                    </div>
                    {videoPreviewError && (
                      <p
                        className="font-body text-xs text-brand-link"
                        role="status"
                      >
                        {videoPreviewError}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[#E8D8D0] rounded-xl hover:border-primary hover:bg-[#FDE9EF] transition-colors group"
                  >
                    <Video
                      size={24}
                      className="text-[#71574F] group-hover:text-brand-link transition-colors"
                    />
                    <span className="font-body text-base text-[#34221D] group-hover:text-brand-link transition-colors">
                      Click to upload your video
                    </span>
                    <span className="font-body text-xs text-[#71574F]">
                      MP4, MOV, WebM, AVI. Maximum 500MB. Video uploads may retry after a brief connection issue.
                    </span>
                  </button>
                )
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={videoLink}
                    onChange={e => setVideoLink(e.target.value)}
                    placeholder="https://youtube.com/... or Google Drive / Dropbox link"
                    className="w-full px-4 py-2.5 bg-white border border-input rounded-xl font-body text-base text-[#34221D] placeholder:text-[#71574F] focus:outline-none focus:border-brand-link focus:ring-1 focus:ring-brand-link/30 transition-colors"
                  />
                  <p className="font-body text-xs text-[#34221D]">
                    Accepted: YouTube, Google Drive, Dropbox, or any direct
                    video link. Make sure sharing is set to "Anyone with the
                    link".
                  </p>
                  {videoLink.trim() &&
                    !validateVideoLink(videoLink) && (
                      <div className="flex items-center gap-2 p-2.5 bg-[#FDE9EF] border border-[#E8D8D0] rounded-xl">
                        <CheckCircle
                          size={16}
                          className="text-brand-link shrink-0"
                        />
                        <span className="font-body text-xs text-[#34221D]">
                          Link format looks valid. Please check its sharing permissions.
                        </span>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Upload progress bar */}
            {(isUploading || uploadStatus) && (
              <div className="space-y-2">
                <div className="w-full bg-[#E8D8D0] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-primary rounded-full transition-colors motion-reduce:transition-none duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="font-body text-xs text-brand-link text-center">
                  {uploadStatus}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={applyMutation.isPending || isUploading}
              className="w-full py-3 bg-primary text-[#34221D] font-body font-semibold text-base min-h-12 rounded-full hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading
                ? (uploadStatus ?? "Uploading...")
                : applyMutation.isPending
                  ? "Submitting..."
                  : "Submit Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────
export function JobCard({
  job,
  onApply,
  expanded,
  onToggle,
}: {
  job: (typeof JOB_LISTINGS)[0];
  onApply: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    if (shareOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shareOpen]);

  const getShareUrl = () => `${window.location.origin}/careers#${job.id}`;
  const shareText = `🐾 ${job.title} — ${job.location} (${job.type}) at AfroPuppyYoga! Apply now:`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = getShareUrl();
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLinks = [
    {
      label: "Facebook",
      icon: "f",
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}` as
        | string
        | null,
    },
    {
      label: "X (Twitter)",
      icon: "𝕏",
      color: "#000000",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(getShareUrl())}` as
        | string
        | null,
    },
    {
      label: "LinkedIn",
      icon: "in",
      color: "#0A66C2",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}` as
        | string
        | null,
    },
  ];

  return (
    <div
      id={job.id}
      className="bg-white border border-[#E8D8D0] rounded-2xl overflow-hidden hover:shadow-sm transition-shadow duration-200 motion-reduce:transition-none"
    >
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-[#FDE9EF] rounded-xl flex items-center justify-center text-2xl shrink-0">
              {job.icon === "movement" ? (
                <Activity aria-hidden="true" />
              ) : job.icon === "puppy" ? (
                <PawPrint aria-hidden="true" />
              ) : job.icon === "operations" ? (
                <Settings aria-hidden="true" />
              ) : (
                job.emoji
              )}
            </div>
            <div>
              <h3 className="font-display font-medium text-xl md:text-2xl text-[#34221D]">
                {job.title}
              </h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-body text-xs text-brand-link">
                  <MapPin size={11} /> {job.location}
                </span>
                <span className="flex items-center gap-1 font-body text-xs text-[#34221D]">
                  <Clock size={11} /> {job.type}
                </span>
                {job.badge && (
                  <span className="px-2 py-0.5 font-body text-xs font-semibold rounded-full border bg-green-100 text-green-700 border-green-300">
                    🟢 Now Hiring
                  </span>
                )}
                {job.subBadge && (
                  <span className="px-2 py-0.5 bg-blush text-brand-link font-body text-xs font-semibold rounded-full border border-primary/20">
                    {job.subBadge}
                  </span>
                )}
                {job.pay && (
                  <span className="px-2 py-0.5 bg-[#FEFAF4] text-[#71574F] font-body text-xs font-semibold rounded-full border border-[#E8D8D0]">
                    {job.pay}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Share button */}
            <div ref={shareRef} className="relative">
              <button
                onClick={() => setShareOpen(v => !v)}
                className="flex items-center gap-1.5 min-h-11 px-4 py-2.5 border border-[#E8D8D0] text-brand-link font-body font-semibold text-xs rounded-full hover:bg-[#FDE9EF] hover:border-primary transition-colors"
                aria-label={`Share ${job.title} in ${job.location}`} aria-expanded={shareOpen}
              >
                <Share2 size={13} />
                <span className="hidden sm:inline">Share</span>
              </button>
              {shareOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-[#E8D8D0] rounded-2xl shadow-lg z-20 overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#E8D8D0]">
                    <p className="font-body text-sm font-semibold text-[#34221D] uppercase tracking-wide">
                      Share this role
                    </p>
                  </div>
                  {shareLinks.map(s =>
                    s.href ? (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FDE9EF] transition-colors"
                      >
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.icon}
                        </span>
                        <span className="font-body text-xs text-[#34221D]">
                          {s.label}
                        </span>
                      </a>
                    ) : (
                      <button
                        key={s.label}
                        onClick={() => {
                          handleCopyLink();
                          setShareOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#FDE9EF] transition-colors"
                      >
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.icon}
                        </span>
                        <span className="font-body text-xs text-[#34221D]">
                          {s.label} (Copy Link)
                        </span>
                      </button>
                    )
                  )}
                  <button
                    onClick={() => {
                      handleCopyLink();
                      setShareOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#FDE9EF] transition-colors border-t border-[#E8D8D0]"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#E8D8D0] flex items-center justify-center shrink-0">
                      {copied ? (
                        <Check size={11} className="text-green-600" />
                      ) : (
                        <Copy size={11} className="text-brand-link" />
                      )}
                    </span>
                    <span className="font-body text-xs text-[#34221D]">
                      {copied ? "Copied!" : "Copy Link"}
                    </span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onApply}
              className="min-h-11 px-5 py-2.5 bg-primary text-[#34221D] font-body font-semibold text-xs rounded-full hover:bg-primary-hover transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        <p className="font-body text-base text-[#34221D] leading-relaxed mb-4">
          {job.description}
        </p>

        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`details-${job.id}`}
          className="flex items-center gap-1.5 min-h-11 font-body text-sm font-semibold text-brand-link hover:underline transition-colors"
        >
          {expanded ? "Show less" : "See full details"}
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && (
          <div id={`details-${job.id}`} className="mt-5 space-y-4 border-t border-[#E8D8D0] pt-5">
            <div>
              <h4 className="font-body text-xs font-bold text-[#34221D] uppercase tracking-wide mb-2">
                Responsibilities
              </h4>
              <ul className="space-y-1.5">
                {job.responsibilities.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-body text-base text-[#34221D]"
                  >
                    <span className="text-brand-link mt-0.5 shrink-0">•</span>{" "}
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-body text-xs font-bold text-[#34221D] uppercase tracking-wide mb-2">
                Requirements
              </h4>
              <ul className="space-y-1.5">
                {job.requirements.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-body text-base text-[#34221D]"
                  >
                    <span className="text-brand-link mt-0.5 shrink-0">•</span>{" "}
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-body text-xs font-bold text-[#34221D] uppercase tracking-wide mb-2">
                Perks
              </h4>
              <ul className="space-y-1.5">
                {job.perks.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-body text-base text-[#34221D]"
                  >
                    <Heart
                      size={12}
                      className="text-brand-link mt-0.5 shrink-0"
                    />{" "}
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onApply}
              className="w-full py-2.5 bg-primary text-[#34221D] font-body font-semibold text-base min-h-12 rounded-full hover:bg-primary-hover transition-colors"
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
  useSeoMeta({
    title: "Careers at AfroPuppyYoga | Join Our Team in Ontario",
    description:
      "Movement Instructor jobs in Kitchener and Guelph, plus Puppy Monitor and Operations Specialist jobs in Guelph. Apply to AfroPuppyYoga with your resume and video.",
    canonical: "https://afropuppyyoga.ca/careers",
  });
  const [selectedJob, setSelectedJob] = useState<CareerJob | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState("all");
  const [role, setRole] = useState("all");
  const roles = Array.from(new Set(JOB_LISTINGS.map(job => job.title)));
  const filtered = filterCareers(JOB_LISTINGS, location, role);
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />
      <section className="relative bg-[#FEFAF4] pt-28 pb-10 md:pt-32 md:pb-14">
        <div className="container grid md:grid-cols-[1.05fr_0.95fr] items-center gap-8 md:gap-14">
          <div className="max-w-xl">
            <p className="font-body text-xs font-semibold text-brand-link uppercase tracking-[0.18em] mb-4">Join the pack</p>
            <h1 className="font-display font-medium text-[clamp(2.75rem,5.6vw,5rem)] text-[#34221D] leading-[1.04] tracking-[-0.03em] mb-5">
              Bring joy to <span className="text-brand-link">every class.</span>
            </h1>
            <p className="font-body text-base md:text-lg text-[#34221D]/80 leading-relaxed max-w-lg">
              Love puppies, people and bringing a little joy to their day? Explore opportunities to create thoughtful wellness experiences with AfroPuppyYoga.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-7">
              <a href="#open-positions" className="inline-flex items-center justify-center min-h-12 px-7 bg-primary rounded-full font-body font-semibold text-sm text-[#34221D] hover:bg-primary-hover transition-colors">Explore open roles <span aria-hidden="true" className="ml-2">→</span></a>
              <span className="font-body text-sm text-[#71574F]">Ontario locations &amp; remote opportunities</span>
            </div>
          </div>
          <div className="relative md:pl-4">
            <div className="rounded-[1.75rem] overflow-hidden bg-[#FDE9EF] aspect-[5/4] md:aspect-[4/3] shadow-sm">
              <img src={publicPortraitUrl("/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg")} onError={recoverPublicPortrait} alt="A guest cuddling puppies at an AfroPuppyYoga class" className="h-full w-full object-cover object-center" />
            </div>
            <div className="absolute -bottom-3 left-3 md:left-0 bg-white border border-[#E8D8D0] rounded-2xl px-5 py-3 shadow-sm">
              <p className="font-body text-xs uppercase font-semibold tracking-wider text-brand-link">People. Puppies. Community.</p>
              <p className="font-display text-lg text-[#34221D]">Make someone's day brighter.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#FDE9EF] border-y border-[#E8D8D0] py-5 mt-3" aria-label="What matters to us">
        <div className="container flex flex-wrap justify-center gap-x-12 gap-y-3 text-[#34221D] font-body text-sm font-semibold">
          <span>🐾 Puppy-first culture</span><span>💛 Community driven</span><span>✨ Flexible opportunities</span>
        </div>
      </section>
      <section id="open-positions" className="py-12 md:py-16 scroll-mt-28">
        <div className="container max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
            <div>
              <p className="font-body text-xs text-brand-link uppercase tracking-widest mb-2">Find your place</p>
              <h2 className="font-display font-medium text-3xl md:text-4xl text-[#34221D]">Explore open roles</h2>
              <p className="font-body text-base text-[#71574F] mt-3 max-w-2xl">Find an opportunity that fits your skills and location. Select a role to see the details and apply.</p>
            </div>
            <span className="font-body text-xs font-semibold text-brand-link bg-[#FDE9EF] rounded-full px-4 py-2 w-fit">{JOB_LISTINGS.length} openings</span>
          </div>
          <div className="bg-white border border-[#E8D8D0] rounded-2xl p-4 md:p-5 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div><label htmlFor="career-location" className="block font-body text-xs font-bold uppercase tracking-wide text-[#71574F] mb-2">Location</label>
              <select id="career-location" value={location} onChange={e => setLocation(e.target.value)} className="w-full h-11 px-3 bg-[#FEFAF4] border border-[#E8D8D0] rounded-xl font-body text-sm text-[#34221D]">
                <option value="all">All locations</option><option value="KW">Kitchener-Waterloo</option><option value="HAM">Hamilton</option><option value="OAK">Oakville</option><option value="GUE">Guelph</option><option value="REMOTE">Remote</option>
              </select></div>
            <div><label htmlFor="career-role" className="block font-body text-xs font-bold uppercase tracking-wide text-[#71574F] mb-2">Role</label>
              <select id="career-role" value={role} onChange={e => setRole(e.target.value)} className="w-full h-11 px-3 bg-[#FEFAF4] border border-[#E8D8D0] rounded-xl font-body text-sm text-[#34221D]">
                <option value="all">All roles</option>{roles.map(name => <option key={name} value={name}>{name}</option>)}
              </select></div>
            <button type="button" onClick={() => {setLocation("all"); setRole("all");}} className="h-11 px-4 rounded-full font-body text-sm font-semibold text-brand-link hover:bg-[#FDE9EF]">Clear filters</button>
          </div>
          <div aria-live="polite" className="font-body text-sm text-[#71574F] mb-4">Showing {filtered.length} {filtered.length === 1 ? "opportunity" : "opportunities"}</div>
          {filtered.length ? <div className="flex flex-col gap-4">
            {filtered.map(job => <JobCard key={job.id} job={job} onApply={() => setSelectedJob(job)} expanded={expandedIds.has(job.id)} onToggle={() => toggleExpanded(job.id)} />)}
          </div> : <div className="bg-white border border-[#E8D8D0] rounded-2xl p-8 font-body text-[#34221D]">No roles match these filters. Try a different location or role.</div>}
          <div className="mt-8 rounded-2xl bg-[#FDE9EF] p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div><p className="font-body text-xs uppercase tracking-widest text-brand-link mb-1">Ready to apply?</p><h3 className="font-display text-xl text-[#34221D]">A little prep goes a long way.</h3><p className="font-body text-sm text-[#71574F] mt-2">Have your resume and a 1 to 2 minute introduction video ready. Upload your video or share a link.</p></div>
            <span className="font-body text-xs text-[#34221D] border border-[#E8D8D0] bg-white rounded-full px-4 py-2 w-fit whitespace-nowrap">Resume + video required</span>
          </div>
        </div>
      </section>
      <section className="py-12 bg-[#FDE9EF] border-t border-[#E8D8D0]"><div className="container text-center">
        <p className="font-body text-xs text-brand-link uppercase tracking-widest mb-3">Don't see your role?</p>
        <h2 className="font-display font-medium text-2xl md:text-3xl text-[#34221D] mb-3">We're always open to great people</h2>
        <p className="font-body text-base text-[#34221D]/80 mb-6 max-w-md mx-auto">If you have a skill that could help AfroPuppyYoga grow, we'd love to hear from you.</p>
        <a href="mailto:afropuppyyoga@gmail.com" className="inline-flex items-center px-6 py-3 bg-primary text-[#34221D] font-body font-semibold text-base min-h-12 rounded-full hover:bg-primary-hover">Say hello</a>
      </div></section>
      <Footer /><ScrollToTop />
      {selectedJob && <ApplicationModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}
