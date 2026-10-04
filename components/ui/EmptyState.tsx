import Link from "next/link";

export function EmptyState({ sentence, href, action }: { sentence: string; href: string; action: string }) {
  return (
    <div
      className="p-6"
      style={{ borderRadius: 24, background: "linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.58))", boxShadow: "inset 0 1px 0 #fff, 0 0 0 .5px rgba(0,0,0,.07), 0 12px 36px rgba(15,23,42,.05)" }}
    >
      <p className="text-[15px] text-[#3a3a3c]">{sentence}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center no-underline transition-transform hover:-translate-y-px"
        style={{ height: 40, padding: "0 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, color: "#6b3f00", background: "linear-gradient(180deg,rgba(255,222,160,.9),rgba(255,196,95,.65))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 .5px rgba(200,120,0,.2)" }}
      >
        {action}
      </Link>
    </div>
  );
}
