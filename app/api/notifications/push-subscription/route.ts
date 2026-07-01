import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscriptionBody {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).refine((value) => value.startsWith("https://"), {
    message: "Push endpoint must use HTTPS.",
  }),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});

export async function POST(request: Request) {
  if (isDemoMode) {
    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await safeJson(request);
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      last_error: null,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

export async function DELETE(request: Request) {
  if (isDemoMode) {
    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await safeJson(request);
  if (!body.endpoint) {
    return NextResponse.json({ error: "Missing subscription endpoint." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

async function safeJson(request: Request): Promise<SubscriptionBody> {
  try {
    return (await request.json()) as SubscriptionBody;
  } catch {
    return {};
  }
}
