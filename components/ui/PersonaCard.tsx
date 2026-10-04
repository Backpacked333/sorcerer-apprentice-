export function PersonaCard({ role, name, expert }: { role: "expert" | "newhire"; name: string; expert?: string }) {
  const who = name.trim() || "the expert";
  const text = role === "expert"
    ? `You are ${who}, the experienced one. Work the invoices the way you would and say what you are thinking. The apprentice stays silent while you work and asks short questions when you pause. Say 'scratch that' to strike anything. Use the role card you were handed — or your own rules: it learns what you actually say.`
    : `You are new here. Nobody told you the rules. Work the queue and do what seems right. The tutor only speaks when ${expert?.trim() || "the expert"} would have stopped.`;
  return (
    <section className="panel p-4">
      <p className="panel-title">{role === "expert" ? "Your part" : "Your part"}</p>
      <p className="mt-2 t-small">{text}</p>
    </section>
  );
}
