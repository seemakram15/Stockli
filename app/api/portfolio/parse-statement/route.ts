import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import {
  parseBrokerStatementText,
  type ParsedBrokerStatement,
  type ParsedStatementTrade,
} from "@/lib/services/broker-statement-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface StatementParseFileResult {
  fileName: string;
  data?: ParsedBrokerStatement;
  error?: string;
}

async function enrichCompanies(trades: ParsedStatementTrade[]): Promise<void> {
  const symbols = [...new Set(trades.map((t) => t.symbol).filter(Boolean))];
  if (!symbols.length) return;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tickers")
      .select("symbol, company_name")
      .in("symbol", symbols);
    if (!data?.length) return;
    const map = new Map(
      data.map((r) => [r.symbol.toUpperCase(), (r.company_name ?? "").trim()])
    );
    for (const t of trades) {
      const fromDb = map.get(t.symbol);
      // Prefer DB name; also replace concatenated PDF blobs.
      const blob =
        !t.companyName ||
        t.companyName.length > 72 ||
        (t.companyName.match(/\bLIMITED\b|\bLTD\b/gi) ?? []).length > 1;
      if (fromDb && (blob || !t.companyName)) {
        t.companyName = fromDb;
      }
    }
  } catch {
    // non-fatal
  }
}

async function resolveUnknownSymbols(trades: ParsedStatementTrade[]): Promise<void> {
  const unknown = trades.filter((t) => {
    const blob =
      !t.companyName ||
      t.companyName.length > 72 ||
      (t.companyName.match(/\bLIMITED\b|\bLTD\b/gi) ?? []).length > 1;
    return t.symbol && blob;
  });
  if (!unknown.length) return;
  try {
    const supabase = await createClient();
    for (const t of unknown) {
      const { data } = await supabase
        .from("tickers")
        .select("symbol, company_name")
        .eq("symbol", t.symbol)
        .maybeSingle();
      if (data?.company_name) t.companyName = data.company_name;
      else if ((t.companyName.match(/\bLIMITED\b|\bLTD\b/gi) ?? []).length > 1) {
        t.companyName = "";
      }
    }
  } catch {
    // non-fatal
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
  if (files.length > 5) {
    return Response.json({ error: "Upload at most 5 PDF files at a time." }, { status: 400 });
  }

  const results: StatementParseFileResult[] = await Promise.all(
    files.map(async (file) => {
      try {
        if (file.size > 12 * 1024 * 1024) {
          return { fileName: file.name, error: "File too large (max 12 MB)." };
        }
        const isPdf =
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          return { fileName: file.name, error: "Only PDF Statement of Account files are supported." };
        }

        const buffer = await file.arrayBuffer();
        // Parse in-memory only — never write the upload to disk or storage.
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        const flat = Array.isArray(text) ? text.join("\n") : String(text ?? "");
        const data = parseBrokerStatementText(flat);

        await enrichCompanies(data.trades);
        await resolveUnknownSymbols(data.trades);

        if (!data.trades.length) {
          return {
            fileName: file.name,
            error:
              "Could not extract trades from this PDF. Use a broker Statement of Account with BUY/SELL narrations (e.g. “T+1 BUY # 123 FFC 35 @ 576.07”).",
            data,
          };
        }

        return { fileName: file.name, data };
      } catch (err) {
        return {
          fileName: file.name,
          error: err instanceof Error ? err.message : "Failed to parse PDF",
        };
      }
    })
  );

  return Response.json({ results });
}
