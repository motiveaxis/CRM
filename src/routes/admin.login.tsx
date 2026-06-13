import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — MotiveAxis" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="ma-panel w-full max-w-md p-8">
        <AuthForm
          mode={mode}
          label="Internal CRM"
          allowSignup
          onToggleMode={() => setMode(mode === "signin" ? "signup" : "signin")}
          onSuccess={() => navigate({ to: "/admin/dashboard", replace: true })}
        />
        <div className="mt-6 pt-4 border-t border-[color:var(--border)] text-[10px] text-[color:var(--text-muted)] font-mono">
          FIRST USER AUTOMATICALLY PROVISIONED AS ADMIN
        </div>
      </div>
    </div>
  );
}
