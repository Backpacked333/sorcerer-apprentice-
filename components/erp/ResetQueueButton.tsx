"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetQueueButton({ queue }: { queue: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  return (
    <button
      type="button"
      className="erp-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setNote("");
        try {
          const res = await fetch(`/api/erp/reset?queue=${queue}`, { method: "POST" });
          if (!res.ok) setNote("Reset failed.");
          else router.refresh();
        } catch {
          setNote("Reset failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Resetting…" : "Start this queue fresh (sandbox data)"}
      {note && <span className="erp-field-error"> {note}</span>}
    </button>
  );
}
