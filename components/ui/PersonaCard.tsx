export function PersonaCard({ role, name, expert }: { role: "expert" | "newhire"; name: string; expert?: string }) {
  const who = name.trim() || "the expert";
  const text = role === "expert"
    ? `You are ${who}, the experienced one. Work the invoices the way you would and say what you are thinking. The apprentice stays silent while you work and asks short questions when you pause. Say 'scratch that' to strike anything. Use the role card you were handed — or your own rules: it learns what you actually say.`
    : `You are new here. Nobody told you the rules. Work the queue and do what seems right. The tutor only speaks when ${expert?.trim() || "the expert"} would have stopped.`;
  return (
    <section
      className="p-4"
      style={{ borderRadius: 20, background: "linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.55))", boxShadow: "inset 0 1px 0 #fff, 0 0 0 .5px rgba(0,0,0,.07)" }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-[.11em]" style={{ color: role === "expert" ? "#a35f00" : "#1b8a4b" }}>Your part</p>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-[#3a3a3c]">{text}</p>
    </section>
  );
}
