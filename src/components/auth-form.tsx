import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthFormProps {
  mode: "signin" | "signup";
  label: string;
  onSuccess: () => void;
  allowSignup?: boolean;
  onToggleMode?: () => void;
}

export function AuthForm({ mode, label, onSuccess, allowSignup, onToggleMode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("Account created. You are signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="ma-accent-bar" />
      <div>
        <div className="ma-label mb-1">MotiveAxis / {label}</div>
        <h2>{mode === "signup" ? "Create access" : "Authenticate"}</h2>
      </div>

      {mode === "signup" && (
        <div>
          <label className="ma-label block mb-1.5">Full name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black border border-[color:var(--border)] focus:border-[color:var(--accent-red)] outline-none px-3 py-2.5 text-sm font-mono"
          />
        </div>
      )}

      <div>
        <label className="ma-label block mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-black border border-[color:var(--border)] focus:border-[color:var(--accent-red)] outline-none px-3 py-2.5 text-sm font-mono"
        />
      </div>

      <div>
        <label className="ma-label block mb-1.5">Password</label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black border border-[color:var(--border)] focus:border-[color:var(--accent-red)] outline-none px-3 py-2.5 text-sm font-mono"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[color:var(--accent-red)] text-white text-sm font-semibold py-2.5 rounded-[4px] disabled:opacity-50"
      >
        {submitting ? "Processing..." : mode === "signup" ? "Create account →" : "Sign in →"}
      </button>

      {allowSignup && onToggleMode && (
        <button
          type="button"
          onClick={onToggleMode}
          className="w-full text-xs text-[color:var(--text-secondary)] hover:text-white transition-colors py-1"
        >
          {mode === "signin" ? "No account? Register the first admin →" : "Have an account? Sign in →"}
        </button>
      )}
    </form>
  );
}
