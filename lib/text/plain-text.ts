/**
 * Turn untrusted / scraped HTML-ish strings into safe display plaintext.
 * Strips tags, decodes entities, and collapses whitespace — never returns markup.
 */
export function toPlainText(value: string | null | undefined): string {
  if (!value) return "";

  let text = String(value);
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  // Second pass: encoded tags that became real after entity decode.
  text = text.replace(/<[^>]+>/g, " ");
  // Drop leftover MediaWiki brackets that survived earlier stripping.
  text = text.replace(/\[\[|\]\]|\{\{|\}\}/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

const LIST_TEMPLATE_NAMES =
  /^(?:ubl|unbulleted\s*list|plainlist|flatlist|hlist|bulleted\s*list)$/i;

/**
 * Split on `|` while respecting nested `[[...]]` and `{{...}}` so
 * `{{ubl|Name|[[chairperson|chairman]]}}` does not shatter on the inner pipe.
 */
export function splitWikiPipes(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let linkDepth = 0;
  let templateDepth = 0;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const next = value[i + 1];

    if (ch === "[" && next === "[") {
      linkDepth += 1;
      current += "[[";
      i += 1;
      continue;
    }
    if (ch === "]" && next === "]" && linkDepth > 0) {
      linkDepth -= 1;
      current += "]]";
      i += 1;
      continue;
    }
    if (ch === "{" && next === "{") {
      templateDepth += 1;
      current += "{{";
      i += 1;
      continue;
    }
    if (ch === "}" && next === "}" && templateDepth > 0) {
      templateDepth -= 1;
      current += "}}";
      i += 1;
      continue;
    }
    if (ch === "|" && linkDepth === 0 && templateDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.length || parts.length) parts.push(current);
  return parts;
}

/**
 * Resolve MediaWiki links: `[[link|text]]` → text, `[[link]]` → link.
 * Also strips incomplete leftovers like `[[` / `]]`.
 */
export function stripWikiLinks(value: string | null | undefined): string {
  if (!value) return "";

  let text = String(value);
  for (let pass = 0; pass < 6; pass++) {
    const next = text
      .replace(/\[\[[^|\]]*?\|([^\]]*?)\]\]/g, "$1")
      .replace(/\[\[([^\]]*?)\]\]/g, "$1");
    if (next === text) break;
    text = next;
  }
  // Incomplete / leftover brackets and bare pipe separators.
  text = text.replace(/\[\[|\]\]/g, " ");
  text = text.replace(/^\|+|\|+$/g, " ");
  text = text.replace(/\s*\|\s*/g, " ");
  return text;
}

/**
 * Strip / unwrap MediaWiki templates (`{{...}}`) so names and blurbs are readable.
 * List templates (ubl, plainlist, …) keep their pipe-separated items as newlines.
 */
export function stripMediaWikiTemplates(value: string | null | undefined): string {
  if (!value) return "";

  let text = String(value);
  // Iterate so nested templates unwrap from the inside out.
  for (let pass = 0; pass < 8; pass++) {
    const next = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => {
      const body = String(inner).trim();
      if (!body) return " ";
      const parts = splitWikiPipes(body).map((part) => part.trim());
      const name = (parts[0] ?? "").trim();
      const args = parts.slice(1);
      if (LIST_TEMPLATE_NAMES.test(name)) {
        return `\n${args.filter(Boolean).join("\n")}\n`;
      }
      // Keep a lone argument when the template is just a wrapper (e.g. {{lang|en|Name}}).
      if (args.length === 1 && args[0] && !/^[a-z_]+=/i.test(args[0]) && args[0].length <= 120) {
        return ` ${args[0]} `;
      }
      const kept = args.filter((part) => part && !/^[a-z_]+=/i.test(part));
      if (kept.length === 1 && kept[0].length <= 120) {
        return ` ${kept[0]} `;
      }
      return " ";
    });
    if (next === text) break;
    text = next;
  }

  // Unclosed leftovers like `{{ubl|Riyadh S. A. A. Edrees` — keep args after first `|`.
  text = text.replace(/\{\{([^{}]*)$/g, (_match, inner: string) => {
    const parts = splitWikiPipes(String(inner ?? ""))
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length <= 1) return " ";
    return `\n${parts.slice(1).join("\n")}\n`;
  });
  text = text.replace(/\{\{|\}\}/g, " ");
  return text;
}

/**
 * Full MediaWiki → display plaintext: templates, links, leftovers, HTML entities.
 */
export function wikiToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  let text = stripMediaWikiTemplates(value);
  text = stripWikiLinks(text);
  text = toPlainText(text);
  // Final safety: no wiki markup chars should remain for display.
  text = text.replace(/[\[\]{}|]/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

/**
 * True when a string still looks like raw MediaWiki markup (do not render).
 */
export function hasWikiMarkup(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\[\[|\]\]|\{\{|\}\}/.test(value);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      if (!Number.isFinite(code) || code < 0) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code) || code < 0) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    })
    .replace(/&amp;/gi, "&");
}
