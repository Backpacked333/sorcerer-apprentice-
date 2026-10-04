"use client";

export function Workspace({
  erpSrc,
  locked,
  lockedHint,
  reloadKey,
  onFrameElement,
  presenter,
  children,
}: {
  erpSrc: string;
  locked: boolean;
  lockedHint: string;
  reloadKey: string | number;
  onFrameElement?: (el: HTMLElement | null) => void;
  presenter?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`workspace${presenter ? " presenter" : ""}`}>
      <div className="workspace-frame" ref={onFrameElement}>
        <iframe key={reloadKey} src={erpSrc} title="Sandbox ERP" />
        {locked && <div className="workspace-lock">{lockedHint}</div>}
      </div>
      <aside className="workspace-side">{children}</aside>
    </div>
  );
}
