import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import manualMd from '@/pages/Manual/manual.md?raw';

const wrapperStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
};

const contentStyle: React.CSSProperties = {
  padding: "24px 40px 80px",
  lineHeight: 1.85,
  color: "#333",
  fontSize: 14,
};

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
      {/* Sidebar TOC */}
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #f0f0f0",
          padding: "16px 0",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            padding: "0 20px 12px",
            color: "#1e3a8a",
          }}
        >
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
              fontWeight: h.level === 1 ? 500 : 400,
              color: h.level === 1 ? "#333" : "#666",
              textDecoration: "none",
              lineHeight: 1.6,
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>

      {/* Content */}
      <div style={wrapperStyle}>
        <div className="manual-page" style={contentStyle}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children, ...props }) => {
                const id = String(children)
                  .toLowerCase()
                  .replace(/[^一-鿿\w\s-]/g, "")
                  .replace(/\s+/g, "-");
                return (
                  <h1 id={id} style={{ fontSize: 24, fontWeight: 700, color: "#0f1b3d", margin: "0 0 4px" }} {...props}>
                    {children}
                  </h1>
                );
              },
              h2: ({ children, ...props }) => {
                const id = String(children)
                  .toLowerCase()
                  .replace(/[^一-鿿\w\s-]/g, "")
                  .replace(/\s+/g, "-");
                return (
                  <h2
                    id={id}
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: "#1e3a8a",
                      borderBottom: "1px solid #f0f0f0",
                      paddingBottom: 6,
                      margin: "32px 0 12px",
                    }}
                    {...props}
                  />
                );
              },
              h3: ({ children, ...props }) => {
                const id = String(children)
                  .toLowerCase()
                  .replace(/[^一-鿿\w\s-]/g, "")
                  .replace(/\s+/g, "-");
                return (
                  <h3 id={id} style={{ fontSize: 15, fontWeight: 600, margin: "20px 0 8px", color: "#333" }} {...props} />
                );
              },
              h4: ({ children, ...props }) => {
                const id = String(children)
                  .toLowerCase()
                  .replace(/[^一-鿿\w\s-]/g, "")
                  .replace(/\s+/g, "-");
                return (
                  <h4 id={id} style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 6px", color: "#555" }} {...props} />
                );
              },
              p: ({ children, ...props }) => (
                <p style={{ margin: "8px 0" }} {...props}>{children}</p>
              ),
              ul: ({ children, ...props }) => (
                <ul style={{ paddingLeft: 20, margin: "6px 0 12px" }} {...props}>{children}</ul>
              ),
              ol: ({ children, ...props }) => (
                <ol style={{ paddingLeft: 20, margin: "6px 0 12px" }} {...props}>{children}</ol>
              ),
              li: ({ children, ...props }) => (
                <li style={{ marginBottom: 4 }} {...props}>{children}</li>
              ),
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                return (
                  <code
                    style={{
                      background: isInline ? "#f0f0f0" : "#f6f8fa",
                      padding: isInline ? "1px 5px" : "2px 6px",
                      borderRadius: 3,
                      fontSize: 12,
                      fontFamily: "Consolas, Monaco, monospace",
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ children, ...props }) => (
                <pre
                  style={{
                    background: "#f6f8fa",
                    padding: "12px 16px",
                    borderRadius: 4,
                    overflow: "auto",
                    fontSize: 12,
                    lineHeight: 1.6,
                    margin: "12px 0",
                  }}
                  {...props}
                >
                  {children}
                </pre>
              ),
              blockquote: ({ children, ...props }) => (
                <blockquote
                  style={{
                    background: "#f6f8fa",
                    borderLeft: "3px solid #d0d7de",
                    padding: "12px 16px",
                    margin: "12px 0",
                    fontSize: 13,
                    color: "#555",
                    borderRadius: "0 4px 4px 0",
                  }}
                  {...props}
                >
                  {children}
                </blockquote>
              ),
              table: ({ children, ...props }) => (
                <table
                  style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0" }}
                  {...props}
                >
                  {children}
                </table>
              ),
              th: ({ children, ...props }) => (
                <th
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #f0f0f0",
                    background: "#f5f5f5",
                    fontSize: 13,
                    textAlign: "left",
                  }}
                  {...props}
                >
                  {children}
                </th>
              ),
              td: ({ children, ...props }) => (
                <td
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #f0f0f0",
                    fontSize: 13,
                    verticalAlign: "top",
                  }}
                  {...props}
                >
                  {children}
                </td>
              ),
              hr: () => <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "24px 0" }} />,
              strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
            }}
          >
            {manualMd}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
