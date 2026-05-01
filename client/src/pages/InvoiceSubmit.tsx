import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Upload, FileText, AlertCircle, Loader2 } from "lucide-react";

export default function InvoiceSubmit() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitMutation = trpc.invoices.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setFile(null);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Something went wrong. Please try again.");
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

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      submitMutation.mutate({ fileBase64: base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center border-0 shadow-lg">
          <CardContent className="pt-10 pb-10">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold text-[#2C1810] mb-2">Invoice Submitted!</h2>
            <p className="text-[#6B4C3B] mb-6">
              Your invoice has been received and is being processed. You'll be paid by the due date on your invoice.
            </p>
            <Button
              onClick={() => setSubmitted(false)}
              className="bg-[#C4622D] hover:bg-[#A8522A] text-white"
            >
              Submit Another Invoice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img
              src="https://afropuppyyoga.manus.space/logo.png"
              alt="AfroPuppyYoga"
              className="h-12 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="text-3xl font-bold text-[#2C1810]">Submit Your Invoice</h1>
          <p className="text-[#6B4C3B] mt-2">
            Upload your invoice PDF and we'll process it right away.
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#2C1810]">Invoice Upload</CardTitle>
            <CardDescription>PDF files only, max 16MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#C4622D] bg-[#FFF5EE]"
                  : file
                  ? "border-green-400 bg-green-50"
                  : "border-[#D4A574] hover:border-[#C4622D] hover:bg-[#FFF5EE]"
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
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-green-500" />
                  <p className="font-medium text-[#2C1810]">{file.name}</p>
                  <p className="text-sm text-[#6B4C3B]">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-green-600">Click to change file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-[#D4A574]" />
                  <p className="font-medium text-[#2C1810]">
                    Drop your PDF here or click to browse
                  </p>
                  <p className="text-sm text-[#6B4C3B]">PDF files only, max 16MB</p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={!file || submitMutation.isPending}
              className="w-full bg-[#C4622D] hover:bg-[#A8522A] text-white h-12 text-base"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Submit Invoice
                </>
              )}
            </Button>

            <p className="text-xs text-center text-[#6B4C3B]">
              Your invoice will be reviewed and payment processed by the due date.
              Questions? Email{" "}
              <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#C4622D] underline">
                afropuppyyogaofficial@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
