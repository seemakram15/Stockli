export const PROFILE_AVATAR_BUCKET = "profile-images";

function cleanBaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getProfileAvatarUrl(path: string | null | undefined) {
  const baseUrl = cleanBaseUrl();
  if (!baseUrl || !path) return null;
  return `${baseUrl}/storage/v1/object/public/${PROFILE_AVATAR_BUCKET}/${encodeStoragePath(path)}`;
}
