import { LOGO_URL } from "@/const";
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";

/** Public invoice intake only. Invoice records and payment actions stay private. */
export default function InvoiceSubmit() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submissionLock = useRef(false);
  // Keep the receipt for safe retries if registration loses its network response.
  const receiptRef = useRef<string | null>(null);
  const submitMutation = trpc.invoices.submit.useMutation();
  const busy = uploading || submitMutation.isPending;

  const resetReceipt = () => {
    receiptRef.current = null;
  };
  const selectFile = (selected: File | null) => {
    resetReceipt();
    setFile(null);
    if (!selected) return;
    if (
      !(
        selected.type === "application/pdf" ||
        selected.name.toLowerCase().endsWith(".pdf")
      )
    ) {
      setError("Please upload a PDF file only.");
      return;
    }
    if (selected.size === 0 || selected.size > 16 * 1024 * 1024) {
      setError("Choose a PDF between 1 byte and 16MB.");
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || submissionLock.current) return;
    submissionLock.current = true;
    setError(null);
    setUploading(true);
    try {
      if (!receiptRef.current) {
        const body = new FormData();
        body.append("submitterName", name.trim());
        body.append("submitterEmail", email.trim());
        body.append("website", website);
        body.append("invoice", file);
        // Multipart is required for PDFs; all invoice registration uses tRPC.
        const response = await fetch("/api/upload-invoice", {
          method: "POST",
          body,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.error || "Upload failed. Please try again.");
        if (typeof result.uploadReceipt !== "string")
          throw new Error("Upload could not be confirmed. Please try again.");
        receiptRef.current = result.uploadReceipt;
      }
      const uploadReceipt = receiptRef.current;
      if (!uploadReceipt) throw new Error("Please upload your PDF again.");
      await submitMutation.mutateAsync({ uploadReceipt });
      setSubmitted(true);
      setFile(null);
      resetReceipt();
    } catch (failure: any) {
      if (failure?.data?.code === "BAD_REQUEST") resetReceipt();
      setError(
        failure?.message || "Invoice submission failed. Please try again."
      );
    } finally {
      submissionLock.current = false;
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4] text-[#34221D]">
      <header className="bg-[#FDE9EF] border-b border-[#E8D8D0] px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="AfroPuppyYoga"
              className="w-12 h-12 object-contain"
            />
            <span className="font-display font-medium">AfroPuppyYoga</span>
          </a>
          <a
            href="/"
            className="font-body text-sm text-brand-link underline underline-offset-4"
          >
            Back to website
          </a>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-10 sm:py-12">
        <h1 className="font-display font-medium text-3xl sm:text-4xl mb-2">
          Submit Your Invoice
        </h1>
        <p className="font-body text-base text-[#71574F] mb-6">
          No login needed. Add your details and upload your invoice PDF.
        </p>
        {submitted ? (
          <section
            className="bg-white rounded-2xl border border-[#E8D8D0] p-6"
            aria-live="polite"
          >
            <CheckCircle2 className="w-10 h-10 text-brand-link mb-3" />
            <h2 className="font-display font-medium text-2xl mb-2">
              Invoice received
            </h2>
            <p className="font-body text-base mb-5">
              Your invoice has been submitted for review. Submission does not
              mean payment has been approved.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setError(null);
              }}
              className="rounded-full bg-primary text-[#34221D] hover:bg-primary-hover px-5 py-3 font-body font-semibold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link"
            >
              Submit another invoice
            </button>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-[#E8D8D0] p-5 sm:p-6"
          >
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="font-body text-sm font-semibold">
                  Full name
                  <input
                    name="submitterName"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={255}
                    value={name}
                    onChange={event => {
                      setName(event.target.value);
                      resetReceipt();
                    }}
                    className="block mt-1.5 w-full rounded-xl border border-input bg-[#FEFAF4] px-3 py-2.5 font-normal focus:outline-2 focus:outline-brand-link"
                  />
                </label>
                <label className="font-body text-sm font-semibold">
                  Email address
                  <input
                    name="submitterEmail"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={320}
                    value={email}
                    onChange={event => {
                      setEmail(event.target.value);
                      resetReceipt();
                    }}
                    className="block mt-1.5 w-full rounded-xl border border-input bg-[#FEFAF4] px-3 py-2.5 font-normal focus:outline-2 focus:outline-brand-link"
                  />
                </label>
              </div>
              <div hidden aria-hidden="true">
                <label>
                  Website
                  <input
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={event => setWebsite(event.target.value)}
                  />
                </label>
              </div>
              <div>
                <p className="font-body text-sm font-semibold mb-1.5">
                  Invoice PDF
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={event => {
                    event.preventDefault();
                    if (!busy) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={event => {
                    event.preventDefault();
                    setDragOver(false);
                    if (!busy) selectFile(event.dataTransfer.files[0] ?? null);
                  }}
                  className={`w-full border-2 border-dashed rounded-xl px-4 py-5 text-center font-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link ${dragOver ? "border-primary bg-[#FDE9EF]" : "border-[#E8D8D0] hover:bg-[#FDE9EF]"}`}
                >
                  {file ? (
                    <FileText className="w-6 h-6 mx-auto mb-2 text-brand-link" />
                  ) : (
                    <Upload className="w-6 h-6 mx-auto mb-2 text-brand-link" />
                  )}
                  <span className="block text-sm font-semibold break-all">
                    {file ? file.name : "Choose a PDF or drop it here"}
                  </span>
                  <span className="block text-xs text-[#71574F] mt-1">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB. Select to change file.`
                      : "PDF only, up to 16MB"}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Choose invoice PDF"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={event =>
                    selectFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-body"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={!file || !name.trim() || !email.trim() || busy}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-body font-semibold rounded-full bg-primary text-[#34221D] hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Submit Invoice
                  </>
                )}
              </button>
            </fieldset>
            <p className="font-body text-xs text-[#71574F] mt-4">
              Include the services, dates, amount and payment details in your
              PDF. We use your name and email to review your submission and
              contact you if needed. Invoices are reviewed before payment.
            </p>
          </form>
        )}
        <p className="font-body text-xs text-[#71574F] mt-4">
          Questions?{" "}
          <a
            href="mailto:afropuppyyoga@gmail.com"
            className="text-brand-link underline"
          >
            afropuppyyoga@gmail.com
          </a>
        </p>
      </main>
    </div>
  );
}
