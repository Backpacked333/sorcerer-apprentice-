import { Stepper } from "./Stepper";

export function AppShell({
  step,
  sessionId,
  confirmed,
  presenter,
  status,
  fill,
  children,
}: {
  step: 1 | 2 | 3;
  sessionId?: string;
  confirmed?: boolean;
  presenter?: boolean;
  status?: React.ReactNode;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : "flex min-h-dvh flex-col"}>
      <header className="app-bar">
        <span className="mark" aria-hidden />
        <span className="font-semibold">Simon</span>
        <Stepper current={step} sessionId={sessionId} confirmed={confirmed} />
        <span className="ml-auto flex items-center gap-2">
          {presenter && <span className="tag tag-amber">Presenter</span>}
          {status}
        </span>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
