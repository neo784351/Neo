import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  children: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-[#111827]">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#F5F5F5] border-b border-[#E5E7EB] text-xs text-[#6B7280]">
        <span className="font-mono uppercase tracking-wider">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[#111827] hover:bg-white transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy code'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs sm:text-sm leading-relaxed font-mono text-[#111827]">
        <code>{children}</code>
      </pre>
    </div>
  );
};

function isSafeHref(href?: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim().toLowerCase();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
    return href;
  }
  return undefined;
}

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="prose prose-slate max-w-none text-sm sm:text-[15px] leading-relaxed break-words text-[#111827]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const safeUrl = isSafeHref(href);
            if (!safeUrl) return <span>{children}</span>;
            return (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#111827] font-medium underline underline-offset-2 hover:opacity-75"
              >
                {children}
              </a>
            );
          },
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const text = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || text.includes('\n');
            if (isBlock) {
              return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-[#F5F5F5] text-[#111827] border border-[#E5E7EB] font-mono text-[0.85em]"
                {...props}
              >
                {children}
              </code>
            );
          },
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 font-display text-[#111827]">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 font-display text-[#111827]">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 font-display text-[#111827]">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 py-1.5 border border-[#E5E7EB] rounded-lg bg-[#FAFAFA] italic text-[#4B5563]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 bg-[#F5F5F5] font-semibold border-b border-[#E5E7EB] text-[#111827]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-[#F3F4F6] text-[#111827]">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
