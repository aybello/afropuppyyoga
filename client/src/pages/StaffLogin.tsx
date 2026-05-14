/* ============================================================
   Staff Login — Magic Link Verification Page
   Handles the ?token= parameter from the staff invite email.
   ============================================================ */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

export default function StaffLogin() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [staffName, setStaffName] = useState("");

  const verifyMutation = trpc.staff.verifyMagicLink.useMutation({
    onSuccess: (data) => {
      setStaffName(data.name);
      setStatus("success");
      // Session cookie is now set server-side — no localStorage needed.
      // Redirect to staff portal after a short delay
      setTimeout(() => {
        navigate("/staff");
      }, 2000);
    },
    onError: (err) => {
      setErrorMessage(err.message || "This link is invalid or has expired.");
      setStatus("error");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setErrorMessage("No login token found. Please check your email for the invite link.");
      setStatus("error");
      return;
    }

    verifyMutation.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "#FEFAF4" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10 text-center"
        style={{ background: "#fff", border: "1px solid #F0D0DC" }}
      >
        <img
          src={LOGO_URL}
          alt="AfroPuppyYoga"
          className="w-16 h-16 rounded-full object-cover mx-auto mb-6"
        />

        {status === "verifying" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#8B2252" }} />
            <h2
              className="font-bold text-xl mb-2"
              style={{ fontFamily: "'Georgia', serif", color: "#1A0A12" }}
            >
              Verifying your link...
            </h2>
            <p style={{ color: "#6B4C3B", fontSize: "14px" }}>
              Just a moment while we log you in.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#16a34a" }} />
            <h2
              className="font-bold text-xl mb-2"
              style={{ fontFamily: "'Georgia', serif", color: "#1A0A12" }}
            >
              Welcome, {staffName}! 🐾
            </h2>
            <p style={{ color: "#6B4C3B", fontSize: "14px" }}>
              You're logged in. Redirecting you to the staff portal...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#dc2626" }} />
            <h2
              className="font-bold text-xl mb-2"
              style={{ fontFamily: "'Georgia', serif", color: "#1A0A12" }}
            >
              Link Invalid
            </h2>
            <p style={{ color: "#6B4C3B", fontSize: "14px", marginBottom: "24px" }}>
              {errorMessage}
            </p>
            <p style={{ color: "#9E7B8A", fontSize: "13px" }}>
              Please contact your manager to request a new invite link, or email us at{" "}
              <a
                href="mailto:afropuppyyogaofficial@gmail.com"
                style={{ color: "#C2185B" }}
              >
                afropuppyyogaofficial@gmail.com
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
