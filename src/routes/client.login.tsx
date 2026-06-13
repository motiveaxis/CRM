import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/client/login")({
  head: () => ({ meta: [{ title: "Client Portal Login — MotiveAxis" }] }),
  component: ClientLogin,
});

function ClientLogin() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="ma-panel w-full max-w-md p-8">
        <AuthForm
          mode="signin"
          label="Client Portal"
          onSuccess={() => navigate({ to: "/client/dashboard", replace: true })}
        />
        <div className="mt-6 pt-4 border-t border-[color:var(--border)] text-[10px] text-[color:var(--text-muted)] font-mono">
          ACCESS PROVISIONED BY MOTIVEAXIS AFTER CONTRACT SIGNATURE
        </div>
      </div>
    </div>
  );
}
