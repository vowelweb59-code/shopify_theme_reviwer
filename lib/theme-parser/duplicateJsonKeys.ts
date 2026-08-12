import { buildLineIndex } from "./lineIndex";

type Frame = { isObject: boolean; keys: Set<string>; path: string };

export type DuplicateJsonKey = { path: string; line: number };

/**
 * Scans raw JSON text for keys repeated within the same object literal —
 * information JSON.parse can never recover, because duplicate keys are
 * silently collapsed (last write wins) while building the parsed value,
 * before there's anything left to inspect for duplicates. This is a
 * lightweight tokenizer (string/brace/bracket aware), not a full JSON
 * parser — it assumes the input is otherwise well-formed.
 */
export function findDuplicateJsonKeys(rawText: string): DuplicateJsonKey[] {
  const toLine = buildLineIndex(rawText);
  const duplicates: DuplicateJsonKey[] = [];
  const stack: Frame[] = [];
  let pendingKey: string | null = null;
  let i = 0;
  const n = rawText.length;

  while (i < n) {
    const ch = rawText[i];

    if (ch === '"') {
      const start = i;
      i++;
      while (i < n && rawText[i] !== '"') {
        if (rawText[i] === "\\") i++;
        i++;
      }
      i++; // consume closing quote
      const str = rawText.slice(start + 1, Math.max(start + 1, i - 1));

      let j = i;
      while (j < n && /\s/.test(rawText[j])) j++;
      const top = stack[stack.length - 1];
      const isKeyPosition = rawText[j] === ":" && top !== undefined && top.isObject;

      if (isKeyPosition) {
        if (top.keys.has(str)) {
          duplicates.push({ path: top.path ? `${top.path}.${str}` : str, line: toLine(start) });
        } else {
          top.keys.add(str);
        }
        pendingKey = str;
      } else {
        pendingKey = null; // this string was a value, not a key
      }
      continue;
    }

    if (ch === "{" || ch === "[") {
      const parent = stack[stack.length - 1]?.path ?? "";
      const path = pendingKey ? (parent ? `${parent}.${pendingKey}` : pendingKey) : parent;
      stack.push({ isObject: ch === "{", keys: new Set(), path });
      pendingKey = null;
      i++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      pendingKey = null;
      i++;
      continue;
    }
    if (ch === ",") {
      pendingKey = null;
      i++;
      continue;
    }
    i++;
  }

  return duplicates;
}
