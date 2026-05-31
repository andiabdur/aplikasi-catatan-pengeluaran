import React from "react";

// Lightweight Markdown renderer for AI chat replies.
// Handles: **bold**, *italic*, `code`, bullet lists, numbered lists,
// headings, paragraphs, AND tables (| ... | ... |).

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="px-1 py-0.5 rounded bg-black/10 text-[0.85em]">
          {m[4]}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Parse a markdown table block (lines starting with |) into header + rows. */
function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const tableLines = lines.filter((l) => l.trimStart().startsWith("|") && l.trimEnd().endsWith("|"));
  if (tableLines.length < 2) return null;

  // First line = header
  const headers = tableLines[0]
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  // Second line = alignment (skip), rest = data rows
  const dataStart = tableLines[1].includes("---") ? 2 : 1;
  const rows = tableLines.slice(dataStart).map((line) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean),
  );

  if (headers.length === 0 || rows.length === 0) return null;
  return { headers, rows };
}

function renderTable(headers: string[], rows: string[][], key: number): React.ReactNode {
  // Clamp max columns to the longest row
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));

  const pad = (arr: string[], n: number) => {
    const copy = [...arr];
    while (copy.length < n) copy.push("");
    return copy;
  };

  return (
    <div key={`t${key}`} className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[200px]">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-700/60">
            {pad(headers, colCount).map((h, i) => (
              <th
                key={i}
                className="px-2.5 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 whitespace-nowrap"
              >
                {h || ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rawRow, ri) => {
            const cells = pad(rawRow, colCount);
            return (
              <tr key={ri} className="even:bg-slate-50/50 dark:even:bg-slate-800/30">
                {cells.map((c, ci) => (
                  <td
                    key={ci}
                    className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    {renderInline(c, `t${key}-r${ri}-c${ci}`)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: { ordered: boolean; content: string }[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ordered = listItems[0].ordered;
    const items = listItems.map((it, idx) => (
      <li key={idx}>{renderInline(it.content, `li${key}-${idx}`)}</li>
    ));
    blocks.push(
      ordered ? (
        <ol key={`ol${key++}`} className="list-decimal pl-5 space-y-0.5">
          {items}
        </ol>
      ) : (
        <ul key={`ul${key++}`} className="list-disc pl-5 space-y-0.5">
          {items}
        </ul>
      ),
    );
    listItems = [];
  };

  // Group consecutive table lines for table rendering
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Check if this line starts a table block
    if (line.trimStart().startsWith("|") && line.trimEnd().endsWith("|")) {
      // Collect all consecutive table lines
      const tableLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trimEnd();
        if (l.trimStart().startsWith("|") && l.trimEnd().endsWith("|")) {
          tableLines.push(l);
          i++;
        } else break;
      }
      // Try to parse the table
      const table = parseTable(tableLines);
      if (table) {
        flushList();
        blocks.push(renderTable(table.headers, table.rows, key++));
        continue;
      }
      // Fall through to normal line rendering if parse fails
      // Re-process each line individually
      for (let j = 0; j < tableLines.length; j++) {
        const tl = tableLines[j];
        // Treat as normal paragraph since parse failed
        flushList();
        blocks.push(<p key={`p${key++}`}>{renderInline(tl, `p${key}`)}</p>);
      }
      continue;
    }

    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);

    if (ulMatch) {
      listItems.push({ ordered: false, content: ulMatch[1] });
    } else if (olMatch) {
      listItems.push({ ordered: true, content: olMatch[1] });
    } else if (line.trim() === "") {
      flushList();
    } else if (heading) {
      flushList();
      blocks.push(
        <p key={`h${key++}`} className="font-semibold">
          {renderInline(heading[1], `h${key}`)}
        </p>,
      );
    } else {
      flushList();
      blocks.push(<p key={`p${key++}`}>{renderInline(line, `p${key}`)}</p>);
    }
    i++;
  }
  flushList();

  return <div className="space-y-1.5">{blocks}</div>;
}
