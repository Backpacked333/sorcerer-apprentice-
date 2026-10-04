import Link from "next/link";

export function EmptyState({ sentence, href, action }: { sentence: string; href: string; action: string }) {
  return (
    <div className="panel p-6">
      <p>{sentence}</p>
      <Link className="btn btn-primary mt-4 inline-block" href={href}>{action}</Link>
    </div>
  );
}
