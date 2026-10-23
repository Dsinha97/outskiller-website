import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders stored markdown. Raw HTML is never rendered, so member-written text stays inert. */
export function Markdown({ children, className = "prose" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children }) =>
            href.startsWith("/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          table: ({ children }) => (
            <div className="tablewrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
