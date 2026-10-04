export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div
      className="rounded-[14px] px-3 py-2"
      style={{ background: "rgba(255,255,255,.6)", boxShadow: "inset 0 1px 0 #fff, inset 0 0 0 .5px rgba(0,0,0,.07)" }}
    >
      <p className="text-[11.5px] font-medium text-[#8e8e93]">{label}</p>
      <p className="font-mono text-[15px] font-semibold tabular-nums text-[#1d1d1f]">{value}</p>
      {hint && <p className="text-[11.5px] text-[#8e8e93]">{hint}</p>}
    </div>
  );
}
