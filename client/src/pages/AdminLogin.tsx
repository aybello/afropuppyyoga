/* ============================================================
   Admin Login — Direct username/password login for AfroPuppyYoga admin
   Bypasses Manus OAuth. Credentials: admin / afropuppyyoga
   ============================================================ */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Eye, EyeOff, PawPrint } from "lucide-react";
import { LOGO_URL } from "@/const";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loginMutation = trpc.staff.adminLogin.useMutation({
    onSuccess: () => {
      // Session cookie is set server-side — redirect to staff portal
      window.location.href = "/staff";
    },
    onError: (err) => {
      setErrorMessage(err.message || "Invalid username or password.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter both username and password.");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #FFF5F8 0%, #FEFAF4 100%)" }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-10 shadow-xl"
        style={{ background: "#fff", border: "1px solid #F0D0DC" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={LOGO_URL}
            alt="AfroPuppyYoga"
            className="w-16 h-16 rounded-full object-cover mb-4 shadow-md"
          />
          <h1
            className="font-bold text-2xl text-center"
            style={{ fontFamily: "'Georgia', serif", color: "#1A0A12" }}
          >
            Admin Login
          </h1>
          <p className="text-sm text-center mt-1" style={{ color: "#9E7B8A" }}>
            AfroPuppyYoga Staff Portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold mb-1.5"
              style={{ color: "#1A0A12" }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
              style={{
                borderColor: errorMessage ? "#dc2626" : "#F0D0DC",
                background: "#FEFAF4",
                color: "#1A0A12",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#FF2D6B")}
              onBlur={(e) =>
                (e.target.style.borderColor = errorMessage ? "#dc2626" : "#F0D0DC")
              }
              disabled={loginMutation.isPending}
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold mb-1.5"
              style={{ color: "#1A0A12" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all"
                style={{
                  borderColor: errorMessage ? "#dc2626" : "#F0D0DC",
                  background: "#FEFAF4",
                  color: "#1A0A12",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#FF2D6B")}
                onBlur={(e) =>
                  (e.target.style.borderColor = errorMessage ? "#dc2626" : "#F0D0DC")
                }
                disabled={loginMutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                style={{ color: "#9E7B8A" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
              {errorMessage}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #FF2D6B, #8B2252)",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(255,45,107,0.3)",
            }}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <PawPrint size={16} />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: "#C4A0B0" }}>
          AfroPuppyYoga — Ontario's #1 Puppy Yoga Experience
        </p>
      </div>
    </div>
  );
}
