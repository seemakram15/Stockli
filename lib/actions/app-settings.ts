"use server";

import { revalidatePath } from "next/cache";
import { updateAppSetting as updateAppSettingService } from "@/lib/services/app-settings";

export async function updateAppSetting(
  key: string,
  enabled: boolean
): Promise<{ error?: string }> {
  try {
    await updateAppSettingService(key, enabled);
    revalidatePath("/admin/customisation");
    return {};
  } catch (e) {
    return { error: String(e) };
  }
}
