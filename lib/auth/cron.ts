import "server-only";
import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

/** Authorize trusted scheduled jobs with Authorization: Bearer <CRON_SECRET>. */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = config.cronSecret.trim();
  if (!secret || secret === "change-me-to-a-long-random-string") return false;

  const auth = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;

  const token = auth.slice(prefix.length).trim();
  if (!token) return false;

  const tokenBytes = Buffer.from(token);
  const secretBytes = Buffer.from(secret);
  if (tokenBytes.length !== secretBytes.length) return false;

  return timingSafeEqual(tokenBytes, secretBytes);
}
