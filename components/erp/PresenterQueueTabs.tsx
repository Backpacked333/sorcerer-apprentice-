"use client";

import Link from "next/link";
import { usePresenter } from "@/components/ui/usePresenter";

const QUEUES = [
  { key: "expert", label: "Invoice queue · expert" },
  { key: "newhire", label: "Invoice queue · new hire" },
  { key: "autopilot", label: "Routine queue · agent" },
] as const;

export function PresenterQueueTabs({ queue }: { queue: string }) {
  const on = usePresenter();
  if (!on) return null;
  return (
    <div className="erp-tabs">
      {QUEUES.map((q) => (
        <Link key={q.key} href={`/erp?queue=${q.key}`} className={`erp-btn ${queue === q.key ? "erp-btn-primary" : ""}`}>{q.label}</Link>
      ))}
    </div>
  );
}
