import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Upload,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
} from "lucide-react";

type Recipient = { phone: string; name: string };
type SendResult = {
  phone: string;
  name: string;
  to: string;
  status: string;
  sid?: string;
  error?: string;
};

function statusIcon(status: string) {
  if (status === "failed" || status === "invalid")
    return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "queued" || status === "sent" || status === "accepted")
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
}

/** Parse a CSV string into [{phone, name}] — handles header row detection */
function parseCsv(text: string): Recipient[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Detect header: if first line contains "phone" or "number" skip it
  const firstLower = lines[0].toLowerCase();
  const hasHeader =
    firstLower.includes("phone") ||
    firstLower.includes("number") ||
    firstLower.includes("mobile");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      // Support: "phone,name" or "name,phone" or just "phone"
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length === 1) return { phone: parts[0], name: "" };
      // Heuristic: whichever part looks like a phone number is the phone
      const looksLikePhone = (s: string) => /^[\d\s\+\-\(\)]{7,}$/.test(s);
      if (looksLikePhone(parts[0])) return { phone: parts[0], name: parts[1] ?? "" };
      if (looksLikePhone(parts[1])) return { phone: parts[1], name: parts[0] ?? "" };
      return { phone: parts[0], name: parts[1] ?? "" };
    })
    .filter((r) => r.phone.replace(/\D/g, "").length >= 10);
}

export default function SmsBroadcast() {
  // ── Single Send ──────────────────────────────────────────────────────────
  const [singlePhone, setSinglePhone] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleMessage, setSingleMessage] = useState("");
  const [singleResult, setSingleResult] = useState<{ success: boolean; to?: string; sid?: string; status?: string; error?: string } | null>(null);

  const singleMutation = trpc.smsBroadcast.sendSingle.useMutation({
    onSuccess: (data) => {
      setSingleResult({ success: true, to: data.to, sid: data.sid, status: data.status });
      toast.success(`SMS sent to ${data.to}`);
    },
    onError: (err) => {
      setSingleResult({ success: false, error: err.message });
      toast.error(`Failed: ${err.message}`);
    },
  });

  // ── Bulk Send ────────────────────────────────────────────────────────────
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [personalise, setPersonalise] = useState(false);
  const [bulkResults, setBulkResults] = useState<SendResult[] | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; sent: number; failed: number } | null>(null);

  const bulkMutation = trpc.smsBroadcast.sendBulk.useMutation({
    onSuccess: (data) => {
      setBulkResults(data.results);
      setBulkSummary({ total: data.total, sent: data.sent, failed: data.failed });
      toast.success(`Sent ${data.sent}/${data.total} messages`);
    },
    onError: (err) => {
      toast.error(`Bulk send failed: ${err.message}`);
    },
  });

  function parseBulkNumbers(): Recipient[] {
    return bulkNumbers
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((entry) => {
        // Support "Name: number" or "Name, number" or just number
        const colonMatch = entry.match(/^(.+?):\s*([\d\s\+\-\(\)]+)$/);
        if (colonMatch) return { name: colonMatch[1].trim(), phone: colonMatch[2].trim() };
        return { name: "", phone: entry };
      })
      .filter((r) => r.phone.replace(/\D/g, "").length >= 10);
  }

  // ── CSV Upload ───────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([]);
  const [csvMessage, setCsvMessage] = useState("");
  const [csvPersonalise, setCsvPersonalise] = useState(false);
  const [csvResults, setCsvResults] = useState<SendResult[] | null>(null);
  const [csvSummary, setCsvSummary] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [csvFileName, setCsvFileName] = useState("");

  const csvMutation = trpc.smsBroadcast.sendBulk.useMutation({
    onSuccess: (data) => {
      setCsvResults(data.results);
      setCsvSummary({ total: data.total, sent: data.sent, failed: data.failed });
      toast.success(`Sent ${data.sent}/${data.total} messages`);
    },
    onError: (err) => {
      toast.error(`CSV send failed: ${err.message}`);
    },
  });

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCsvRecipients(parsed);
      setCsvResults(null);
      setCsvSummary(null);
      if (parsed.length === 0) {
        toast.error("No valid phone numbers found in CSV");
      } else {
        toast.success(`Loaded ${parsed.length} recipients from ${file.name}`);
      }
    };
    reader.readAsText(file);
  }

  function downloadSampleCsv() {
    const sample = "name,phone\nAy Bello,2897881885\nJane Smith,4165550123\nJohn Doe,6475550199";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sms-recipients-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#fdf6f9]">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#8b5cf6]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#2d1b4e]">SMS Broadcast</h1>
              <p className="text-sm text-gray-500">Send messages to individuals or bulk lists</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="single">
          <TabsList className="mb-6 bg-white border border-[#e8dff5]">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Single Send
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Manual Bulk
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-2">
              <Upload className="w-4 h-4" /> CSV Upload
            </TabsTrigger>
          </TabsList>

          {/* ── Single Send Tab ── */}
          <TabsContent value="single">
            <Card className="border-[#e8dff5]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#2d1b4e]">Send to One Person</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Phone Number *</Label>
                    <input
                      type="tel"
                      value={singlePhone}
                      onChange={(e) => { setSinglePhone(e.target.value); setSingleResult(null); }}
                      placeholder="e.g. 2897881885"
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Name (optional)</Label>
                    <input
                      type="text"
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      placeholder="e.g. Ay Bello"
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Message *</Label>
                  <textarea
                    value={singleMessage}
                    onChange={(e) => setSingleMessage(e.target.value)}
                    rows={4}
                    maxLength={1600}
                    placeholder="Type your message here..."
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{singleMessage.length}/1600</p>
                </div>
                <Button
                  onClick={() => singleMutation.mutate({ phone: singlePhone, name: singleName || undefined, message: singleMessage })}
                  disabled={singleMutation.isPending || singlePhone.replace(/\D/g, "").length < 10 || !singleMessage.trim()}
                  className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                >
                  {singleMutation.isPending ? <><Spinner className="w-4 h-4 mr-2" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send SMS</>}
                </Button>

                {singleResult && (
                  <div className={`p-3 rounded-lg border text-sm ${singleResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                    {singleResult.success ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span>Sent to <strong>{singleResult.to}</strong> — status: <strong>{singleResult.status}</strong>{singleResult.sid && <span className="text-xs text-gray-500 ml-2">SID: {singleResult.sid}</span>}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{singleResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Manual Bulk Tab ── */}
          <TabsContent value="bulk">
            <Card className="border-[#e8dff5]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#2d1b4e]">Send to Multiple Numbers</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Enter one number per line, or separate with commas. Optionally prefix with a name: <code className="bg-gray-100 px-1 rounded text-xs">Ay Bello: 2897881885</code></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Phone Numbers *</Label>
                  <textarea
                    value={bulkNumbers}
                    onChange={(e) => { setBulkNumbers(e.target.value); setBulkResults(null); }}
                    rows={6}
                    placeholder={"2897881885\n4165550123\nAy Bello: 6475550199"}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] resize-none font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">{parseBulkNumbers().length} valid number{parseBulkNumbers().length !== 1 ? "s" : ""} detected</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Message *</Label>
                  <textarea
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    rows={4}
                    maxLength={1600}
                    placeholder={"Hi {name}, just a reminder about your upcoming AfroPuppyYoga class! 🐶"}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{bulkMessage.length}/1600</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={personalise} onChange={(e) => setPersonalise(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-600">Personalise — replace <code className="bg-gray-100 px-1 rounded text-xs">{"{name}"}</code> with each recipient's name</span>
                </label>
                <Button
                  onClick={() => bulkMutation.mutate({ recipients: parseBulkNumbers(), message: bulkMessage, personalise })}
                  disabled={bulkMutation.isPending || parseBulkNumbers().length === 0 || !bulkMessage.trim()}
                  className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                >
                  {bulkMutation.isPending ? <><Spinner className="w-4 h-4 mr-2" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send to {parseBulkNumbers().length} recipient{parseBulkNumbers().length !== 1 ? "s" : ""}</>}
                </Button>

                {bulkSummary && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
                    <strong>{bulkSummary.sent}</strong> sent · <strong>{bulkSummary.failed}</strong> failed · <strong>{bulkSummary.total}</strong> total
                  </div>
                )}
                {bulkResults && bulkResults.length > 0 && (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Name</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Number</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Status</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResults.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-700">{r.name || "—"}</td>
                            <td className="py-2 px-2 text-gray-600 font-mono text-xs">{r.to}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">{statusIcon(r.status)}<span className="text-xs capitalize">{r.status}</span></div>
                            </td>
                            <td className="py-2 px-2 text-xs text-red-500">{r.error ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CSV Upload Tab ── */}
          <TabsContent value="csv">
            <Card className="border-[#e8dff5]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#2d1b4e]">Upload CSV &amp; Send</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Upload a CSV with <code className="bg-gray-100 px-1 rounded text-xs">phone</code> and optional <code className="bg-gray-100 px-1 rounded text-xs">name</code> columns. Max 500 rows.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#8b5cf6] rounded-lg text-[#8b5cf6] text-sm hover:bg-[#8b5cf6]/5 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {csvFileName ? csvFileName : "Choose CSV file"}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
                  <button onClick={downloadSampleCsv} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#8b5cf6] transition-colors">
                    <Download className="w-3 h-3" /> Sample CSV
                  </button>
                </div>

                {csvRecipients.length > 0 && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
                    <strong>{csvRecipients.length}</strong> recipients loaded
                    {csvRecipients.slice(0, 3).map((r, i) => (
                      <span key={i} className="ml-2 text-xs text-purple-600">{r.name || r.phone}{i < Math.min(2, csvRecipients.length - 1) ? "," : ""}</span>
                    ))}
                    {csvRecipients.length > 3 && <span className="text-xs text-purple-600 ml-1">+{csvRecipients.length - 3} more</span>}
                  </div>
                )}

                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Message *</Label>
                  <textarea
                    value={csvMessage}
                    onChange={(e) => setCsvMessage(e.target.value)}
                    rows={4}
                    maxLength={1600}
                    placeholder={"Hi {name}, just a reminder about your upcoming AfroPuppyYoga class! 🐶"}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{csvMessage.length}/1600</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={csvPersonalise} onChange={(e) => setCsvPersonalise(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-600">Personalise — replace <code className="bg-gray-100 px-1 rounded text-xs">{"{name}"}</code> with each recipient's name</span>
                </label>
                <Button
                  onClick={() => csvMutation.mutate({ recipients: csvRecipients, message: csvMessage, personalise: csvPersonalise })}
                  disabled={csvMutation.isPending || csvRecipients.length === 0 || !csvMessage.trim()}
                  className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                >
                  {csvMutation.isPending ? <><Spinner className="w-4 h-4 mr-2" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send to {csvRecipients.length} recipient{csvRecipients.length !== 1 ? "s" : ""}</>}
                </Button>

                {csvSummary && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
                    <strong>{csvSummary.sent}</strong> sent · <strong>{csvSummary.failed}</strong> failed · <strong>{csvSummary.total}</strong> total
                  </div>
                )}
                {csvResults && csvResults.length > 0 && (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Name</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Number</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Status</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvResults.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-700">{r.name || "—"}</td>
                            <td className="py-2 px-2 text-gray-600 font-mono text-xs">{r.to}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">{statusIcon(r.status)}<span className="text-xs capitalize">{r.status}</span></div>
                            </td>
                            <td className="py-2 px-2 text-xs text-red-500">{r.error ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
