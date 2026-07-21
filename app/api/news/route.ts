import { NextResponse } from "next/server";
import { fetchWorldNews, fetchNationalNews } from "@/lib/services/world-news";

export const revalidate = 900;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "national" ? "national" : "world";
  const articles = mode === "national" ? await fetchNationalNews() : await fetchWorldNews();
  return NextResponse.json(articles, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
  });
}
