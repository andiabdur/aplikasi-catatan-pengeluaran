import React from "react";

// Tiny Markdown renderer for AI chat replies. Handles the bits Gemini actually
// uses: **bold**, *italic*, `code`, bullet lists, numbered lists, simple
// headings, and paragraphs. No external dependency.

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
        <ol key={`ol${key++}`} className="list-decimal pl-5 space-y-0.5">{items}</ol>
      ) : (
        <ul key={`ul${key++}`} className="list-disc pl-5 space-y-0.5">{items}</ul>
      ),
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
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
  }
  flushList();

  return <div className="space-y-1.5">{blocks}</div>;
}
