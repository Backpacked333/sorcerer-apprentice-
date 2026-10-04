import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="t-h1">That page is not here.</h1>
      <p className="mt-2 t-body text-muted">The session or invoice may have been reset.</p>
      <Link className="btn btn-primary mt-6 inline-block" href="/">Back to the start</Link>
    </main>
  );
}
