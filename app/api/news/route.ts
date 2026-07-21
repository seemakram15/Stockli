import { NextResponse } from "next/server";
import { fetchWorldNews } from "@/lib/services/world-news";

export const revalidate = 900;

export async function GET() {
  const articles = await fetchWorldNews();
  return NextResponse.json(articles, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
  });
}
