import { createHmac, timingSafeEqual } from "node:crypto";

// Shared plan links carry a short signature (?s=…) so a friend can open the plan
// without an account. Only someone who can already see the plan gets the link, and
// the signature can't be made up for a different plan. Server only.

const secret = process.env.PLAN_SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** The signature for a plan's share link, or null when no secret is configured. */
export function shareToken(planKey: string): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`plan:${planKey}`).digest("base64url").slice(0, 22);
}

/** The path to share: the plan with its signature, so the person receiving it skips sign-up. */
export function sharePath(planKey: string): string {
  const token = shareToken(planKey);
  return token ? `/plan/${planKey}?s=${token}` : `/plan/${planKey}`;
}

export function isSharedLink(planKey: string, token: unknown): boolean {
  const expected = shareToken(planKey);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
