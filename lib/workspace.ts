import { cookies } from "next/headers";

export const WORKSPACE_COOKIE = "tacit_ws";
export const WORKSPACE_PATTERN = /^[a-f0-9]{64}$/;

export class WorkspaceError extends Error {
  constructor(message = "workspace unavailable") {
    super(message);
    this.name = "WorkspaceError";
  }
}

function localOwner(): string {
  const owner = process.env.STORE_OWNER_ID?.trim();
  if (owner) return owner;
  if (process.env.VERCEL) throw new WorkspaceError();
  return "local";
}

/**
 * Resolve the owner only from the request cookie. The local fallback is for
 * scripts and tests that have no request context; requests without a cookie
 * fail closed because proxy.ts mints one before rendering.
 */
export async function getWorkspaceId(): Promise<string> {
  const localOverride = process.env.STORE_OWNER_ID?.trim();
  if (!process.env.VERCEL && process.env.STORAGE_BACKEND === "local" && localOverride) return localOverride;
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return localOwner();
  }
  const value = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!value || !WORKSPACE_PATTERN.test(value)) throw new WorkspaceError();
  return value;
}

export function isWorkspaceId(value: string): boolean {
  return WORKSPACE_PATTERN.test(value);
}
