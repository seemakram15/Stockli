import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { parseCdcText } from "@/lib/services/cdc-parser";
import type { CdcParsedData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface ParsedFileResult {
  fileName: string;
  data?: CdcParsedData;
  error?: string;
}

async function resolveSymbol(
  companyName: string
): Promise<{ symbol: string; companyName: string; confidence: CdcParsedData["symbolConfidence"] } | null> {
  try {
    const supabase = await createClient();
    const words = companyName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 2);
    if (!words.length) return null;

    const { data } = await supabase
      .from("tickers")
      .select("symbol, company_name")
      .ilike("company_name", `%${words[0]}%`)
      .limit(10);

    if (!data?.length) return null;

    const nameLower = companyName.toLowerCase();
    const scored = data
      .map((row) => {
        const cn = (row.company_name ?? "").toLowerCase();
        const score = cn.split(/\s+/).filter((w: string) => nameLower.includes(w) && w.length > 2).length;
        return { symbol: row.symbol, companyName: row.company_name ?? "", score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score === 0) return null;
    return {
      symbol: best.symbol,
      companyName: best.companyName,
      confidence: best.score >= 2 ? "high" : "low",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  const results: ParsedFileResult[] = await Promise.all(
    files.map(async (file) => {
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        const base = parseCdcText(text);

        if (!base) {
          return {
            fileName: file.name,
            error: "Could not extract dividend data from this PDF. Make sure it is a CDC Dividend / Zakat & Tax Deduction Report.",
          };
        }

        const resolved = await resolveSymbol(base.companyName);

        return {
          fileName: file.name,
          data: {
            ...base,
            symbol: resolved?.symbol ?? "",
            matchedCompanyName: resolved?.companyName,
            symbolConfidence: resolved?.confidence ?? "none",
          } satisfies CdcParsedData,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[parse] PDF processing error:", msg);
        return {
          fileName: file.name,
          error: `Failed to read PDF: ${msg}`,
        };
      }
    })
  );

  return Response.json({ results });
}
