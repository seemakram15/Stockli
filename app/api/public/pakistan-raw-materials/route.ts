import { NextResponse } from "next/server";
import { getPakistanRawMaterials } from "@/lib/services/pakistan-raw-materials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPakistanRawMaterials();
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "s-maxage=21600, stale-while-revalidate=604800" } }
  );
}
