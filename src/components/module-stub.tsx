import type { ReactNode } from "react";

export function ModuleStub({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1>{title}</h1>
        <div className="ma-label mt-2">{description}</div>
      </div>
      <div className="ma-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 ma-accent-bar" />
        <div className="ma-label">Module status</div>
        <div className="mt-3 text-sm text-[color:var(--text-secondary)] max-w-2xl">
          This module is scaffolded and will be built out in the next iteration. The data model, RLS policies, and navigation are already wired — implementation will populate the UI and operations.
        </div>
        {children}
      </div>
    </div>
  );
}
