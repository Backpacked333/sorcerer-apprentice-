"use client";

import Link from "next/link";
import { usePresenter } from "@/components/ui/usePresenter";
import { QUEUE_KEYS, QUEUE_LABEL } from "@/lib/erp-ui";

export function PresenterQueueTabs({ queue }: { queue: string }) {
  const on = usePresenter();
  if (!on) return null;
  return (
    <nav className="erp-tabs" aria-label="Queues">
      {QUEUE_KEYS.map((k) => (
        <Link key={k} href={`/erp?queue=${k}`} className={`erp-tab${queue === k ? " is-on" : ""}`} aria-current={queue === k ? "page" : undefined}>
          {QUEUE_LABEL[k]}
        </Link>
      ))}
    </nav>
  );
}
