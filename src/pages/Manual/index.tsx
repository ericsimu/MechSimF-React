import { useMemo } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import manualMd from "!!raw-loader!./manual.md";

export default function Manual() {
  const toc = useMemo(() => {
    const headings: { id: string; text: string; level: number }[] = [];
    const re = /^(#{1,3})\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(manualMd)) !== null) {
      const level = m[1].length;
      const text = m[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^一-鿿\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ id, text, level });
    }
    return headings;
  }, []);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #f0f0f0",
          padding: "16px 0",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, padding: "0 20px 12px", color: "#1e3a8a" }}>
          用户手册
        </div>
        {toc.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            style={{
              display: "block",
              padding: h.level === 1 ? "5px 20px" : "4px 32px",
              fontSize: h.level === 1 ? 13 : 12,
              color: h.level === 1 ? "#333" : "#666",
              textDecoration: "none",
              lineHeight: 1.6,
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>

      <div style={{ flex: 1, overflow: "auto" }}>
        <MarkdownPreview source={manualMd} style={{ padding: "24px 40px 80px" }} />
      </div>
    </div>
  );
}
