"use client";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="t-h1">Something broke on this screen. Your session is saved as you go.</h1>
      {error.digest && <p className="mt-2 t-small text-muted">{error.digest}</p>}
      <button className="btn btn-primary mt-6" type="button" onClick={() => retry()}>Reload</button>
    </main>
  );
}
