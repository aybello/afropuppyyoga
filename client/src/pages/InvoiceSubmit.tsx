import { LOGO_URL } from "@/const";
/* ============================================================
   Invoice Submit — APY Staff Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   ============================================================ */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Upload, FileText, AlertCircle, Loader2, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";


export default function InvoiceSubmit() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const submitMutation = trpc.invoices.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setFile(null);
      setError(null);
      setUploading(false);
    },
    onError: (err) => {
      setError(err.message || "Something went wrong. Please try again.");
      setUploading(false);
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a PDF file only.");
      return;
    }
    if (selectedFile.size > 16 * 1024 * 1024) {
      setError("File size must be under 16MB.");
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    handleFileChange(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      // Step 1: upload the PDF via multipart to avoid base64 body-size issues on the platform
      const formData = new FormData();
      formData.append("invoice", file);
      const uploadRes = await fetch("/api/upload-invoice", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error ?? `Storage upload failed (${uploadRes.status})`);
      }
      const { url: fileUrl, key: fileKey } = await uploadRes.json();
      // Step 2: register the invoice in the DB and trigger AI extraction
      submitMutation.mutate({ fileUrl, fileKey, filename: file.name });
    } catch (err: any) {
      setError(err.message ?? "Upload failed. Please try again.");
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 mb-10">
          <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-12 h-12 rounded-full object-cover" />
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-lg text-[#1A0A12]">AfroPuppyYoga</span>
            <span className="font-body text-[10px] text-[#8B2252] tracking-widest uppercase">Staff Portal</span>
          </div>
        </a>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-[#F0D0DC] p-10 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-full bg-[#FFF5F8] flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#8B2252]" />
            </div>
          </div>
          <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-3">Invoice Submitted!</h2>
          <p className="font-body text-[#1A0A12] mb-8 leading-relaxed">
            Your invoice has been received and is being processed. You'll be paid by the due date on your invoice.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #e91e8c, #c2410c)" }}
          >
            Submit Another Invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      {/* Top bar */}
      <header className="bg-[#FFF5F8] border-b border-[#F0D0DC] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <img
              src={LOGO_URL}
              alt="AfroPuppyYoga"
              className="w-10 h-10 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base text-[#1A0A12]">AfroPuppyYoga</span>
              <span className="font-body text-[10px] text-[#8B2252] tracking-widest uppercase">Staff Portal</span>
            </div>
          </a>

          {/* Admin dashboard link — always visible */}
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#8B2252] bg-white hover:bg-[#FFF5F8] transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            View Dashboard
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Page heading */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="h-px w-8 bg-[#8B2252]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">Staff Portal</span>
            <span className="h-px w-8 bg-[#8B2252]" />
          </div>
          <h1 className="font-display font-bold text-4xl text-[#1A0A12] mb-3">Submit Your Invoice</h1>
          <p className="font-body text-[#1A0A12] text-base max-w-sm mx-auto leading-relaxed">
            Upload your invoice PDF and we'll process it right away.
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#F0D0DC] p-8">
          <h2 className="font-display font-bold text-xl text-[#1A0A12] mb-1">Invoice Upload</h2>
          <p className="font-body text-sm text-[#1A0A12] mb-6">PDF files only, max 16MB</p>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-[#8B2252] bg-[#FFF5F8]"
                : file
                ? "border-emerald-400 bg-emerald-50"
                : "border-[#F0D0DC] hover:border-[#8B2252] hover:bg-[#FFF5F8]"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="font-body font-semibold text-[#1A0A12]">{file.name}</p>
                <p className="font-body text-sm text-[#1A0A12]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="font-body text-xs text-emerald-600">Click to change file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#FFF5F8] flex items-center justify-center">
                  <Upload className="w-7 h-7 text-[#8B2252]" />
                </div>
                <p className="font-body font-semibold text-[#1A0A12]">
                  Drop your PDF here or click to browse
                </p>
                <p className="font-body text-sm text-[#1A0A12]">PDF files only, max 16MB</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-body">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!file || uploading || submitMutation.isPending}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-body font-semibold text-base rounded-full text-white transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{ background: "linear-gradient(135deg, #e91e8c, #c2410c)" }}
          >
            {(uploading || submitMutation.isPending) ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Submit Invoice
              </>
            )}
          </button>

          <p className="font-body text-xs text-center text-[#1A0A12] mt-5">
            Your invoice will be reviewed and payment processed by the due date.{" "}
            Questions? Email{" "}
            <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#8B2252] underline">
              afropuppyyogaofficial@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
