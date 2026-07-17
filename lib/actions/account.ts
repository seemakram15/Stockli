"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/current-user";
import { isDemoMode, isSupabaseAdminConfigured } from "@/lib/config";
import { PROFILE_AVATAR_BUCKET, getProfileAvatarUrl } from "@/lib/profile-avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface AccountActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const displayNameSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
});

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(120),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function refreshAccountViews() {
  revalidatePath("/account");
  revalidatePath("/", "layout");
}

async function requireSignedInUser() {
  if (isDemoMode) {
    return { error: "Demo mode is active, so account updates are disabled." as const };
  }

  const user = await getRequestUser();
  if (!user) return { error: "Please sign in again to update your account." as const };
  return { user };
}

function toActionError(error: unknown, fallback: string) {
  const message =
    typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (!message || message === "{}" || message.toLowerCase() === "internal server error") {
    return fallback;
  }
  return message;
}

function readObjectString(record: unknown, key: string) {
  if (!record || typeof record !== "object") return null;
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isMissingAvatarColumnError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  const code =
    typeof error === "object" && error && "code" in error && typeof error.code === "string"
      ? error.code
      : "";

  return code === "42703" || message.includes("avatar_path") || message.includes("does not exist");
}

function avatarExtension(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";

  const ext = file.name.split(".").pop()?.trim().toLowerCase();
  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  return "jpg";
}

async function getAvatarStorageBucketClient() {
  if (!isSupabaseAdminConfigured) return null;

  const admin = createAdminClient();
  const { data: bucket } = await admin.storage.getBucket(PROFILE_AVATAR_BUCKET);
  if (!bucket) {
    await admin.storage.createBucket(PROFILE_AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: MAX_AVATAR_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_AVATAR_TYPES),
    });
  }

  return admin.storage.from(PROFILE_AVATAR_BUCKET);
}

export async function updateAccountProfile(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const auth = await requireSignedInUser();
  if ("error" in auth) return { error: auth.error };

  const parsed = displayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid name." };
  }

  const displayName = parsed.data.displayName;
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", auth.user.id);
  if (profileError) {
    return { error: toActionError(profileError, "We could not update your name right now.") };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { display_name: displayName },
  });
  if (authError) {
    return { error: toActionError(authError, "Your name changed in Stockli, but auth sync failed.") };
  }

  refreshAccountViews();
  return { ok: true, message: "Your profile name was updated." };
}

export async function updateAccountAvatar(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const auth = await requireSignedInUser();
  if ("error" in auth) return { error: auth.error };

  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || avatar.size === 0) {
    return { error: "Choose a profile image before uploading." };
  }
  if (!ALLOWED_AVATAR_TYPES.has(avatar.type)) {
    return { error: "Use a JPG, PNG, or WebP profile photo." };
  }
  if (avatar.size > MAX_AVATAR_BYTES) {
    return { error: "Profile images must be 2 MB or smaller." };
  }

  const supabase = await createClient();
  const avatarStorage = (await getAvatarStorageBucketClient()) ?? supabase.storage.from(PROFILE_AVATAR_BUCKET);
  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileReadError) {
    return { error: toActionError(profileReadError, "We could not load your current profile photo.") };
  }

  const previousPath =
    readObjectString(existingProfile, "avatar_path") ??
    readObjectString(auth.user.user_metadata, "avatar_path");

  const extension = avatarExtension(avatar);
  const avatarPath = `${auth.user.id}/avatar-${Date.now()}.${extension}`;
  const { error: uploadError } = await avatarStorage.upload(avatarPath, avatar, {
      contentType: avatar.type,
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) {
    return {
      error: toActionError(uploadError, "We could not upload your profile image right now."),
    };
  }

  const publicUrl = getProfileAvatarUrl(avatarPath);
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      avatar_path: avatarPath,
      avatar_url: publicUrl,
    },
  });
  if (authError) {
    void avatarStorage.remove([avatarPath]);
    return {
      error: toActionError(authError, "Your image uploaded, but auth profile sync failed."),
    };
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", auth.user.id);
  if (profileUpdateError && !isMissingAvatarColumnError(profileUpdateError)) {
    return {
      error: toActionError(
        profileUpdateError,
        "Your image uploaded, but we could not finish saving it to your profile."
      ),
    };
  }

  if (previousPath && previousPath !== avatarPath) {
    void avatarStorage.remove([previousPath]);
  }

  refreshAccountViews();
  return { ok: true, message: "Your profile image was updated." };
}

export async function updateAccountEmail(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const auth = await requireSignedInUser();
  if ("error" in auth) return { error: auth.error };

  const parsed = emailSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const nextEmail = parsed.data.email;
  const currentEmail = (auth.user.email ?? "").trim().toLowerCase();
  if (!currentEmail) {
    return { error: "Your current email could not be verified. Please sign in again." };
  }
  if (nextEmail === currentEmail) {
    return { ok: true, message: "Your email address is already up to date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: nextEmail });
  if (error) {
    return { error: toActionError(error, "We could not start your email change right now.") };
  }

  refreshAccountViews();
  return {
    ok: true,
    message:
      "We sent the email-change confirmation to your inbox. Confirm the new address before it becomes active.",
  };
}

export async function updateAccountPassword(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const auth = await requireSignedInUser();
  if ("error" in auth) return { error: auth.error };

  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: toActionError(error, "We could not update your password right now.") };
  }

  return { ok: true, message: "Your password was updated successfully." };
}

const taxSettingsSchema = z.object({
  taxFiler: z.boolean(),
  brokerFeePct: z.number().min(0).max(5),
  zakatOnDividends: z.boolean(),
  cgtRateOverride: z.number().min(0).max(100).nullable(),
});

export async function updateTaxSettings(
  _prev: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const auth = await requireSignedInUser();
  if ("error" in auth) return { error: auth.error };

  const parsed = taxSettingsSchema.safeParse({
    taxFiler: formData.get("taxFiler") === "true",
    brokerFeePct: parseFloat(formData.get("brokerFeePct") as string),
    zakatOnDividends: formData.get("zakatOnDividends") === "true",
    cgtRateOverride: formData.get("cgtRateOverride")
      ? parseFloat(formData.get("cgtRateOverride") as string)
      : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tax settings." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      tax_filer: parsed.data.taxFiler,
      broker_fee_pct: parsed.data.brokerFeePct,
      zakat_on_dividends: parsed.data.zakatOnDividends,
      cgt_rate_override: parsed.data.cgtRateOverride,
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: toActionError(error, "We could not update your tax settings right now.") };
  }

  refreshAccountViews();
  return { ok: true, message: "Tax settings saved." };
}
