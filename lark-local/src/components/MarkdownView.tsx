import React from "react";
import type { Block } from "@/types";

interface BlockRendererProps {
  block: Block;
}

/** 渲染单个 Block（飞书风格） */
function BlockView({ block }: BlockRendererProps) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      const sizeClasses: Record<number, string> = {
        1: "text-2xl font-bold mt-6 mb-3",
        2: "text-xl font-semibold mt-5 mb-2.5",
        3: "text-lg font-semibold mt-4 mb-2",
        4: "text-base font-semibold mt-3 mb-1.5",
        5: "text-sm font-semibold mt-2 mb-1",
        6: "text-xs font-semibold mt-2 mb-1 text-feishu-text-secondary",
      };
      return (
        <Tag
          className={sizeClasses[block.level] || sizeClasses[4]}
          data-block-id={block.id}
        >
          {renderInlineContent(block.content)}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p
          className="text-base leading-relaxed my-[0.5em] text-feishu-text"
          data-block-id={block.id}
        >
          {renderInlineContent(block.content)}
        </p>
      );

    case "list_item":
      return (
        <div
          className={`flex items-start gap-2 py-[3px] px-2 -mx-2 rounded-md transition-colors
            hover:bg-feishu-hover group`}
          data-block-id={block.id}
        >
          <span className="shrink-0 w-5 text-right text-feishu-text-secondary text-sm mt-[2px]">
            {block.ordered ? `${block.index}.` : "•"}
          </span>
          <span className="text-base leading-relaxed text-feishu-text">
            {renderInlineContent(block.content)}
          </span>
        </div>
      );

    case "code":
      return (
        <div className="my-3 rounded-lg overflow-hidden" data-block-id={block.id}>
          {block.language && (
            <div className="bg-[#EBEDF0] px-4 py-1.5 text-xs text-feishu-text-secondary font-mono">
              {block.language}
            </div>
          )}
          <pre className="bg-feishu-code p-4 overflow-x-auto">
            <code className="text-sm font-mono text-feishu-code-text leading-relaxed">
              {block.content}
            </code>
          </pre>
        </div>
      );

    case "blockquote":
      return (
        <div
          className="border-l-[3px] border-feishu-quote-border bg-feishu-quote pl-4 py-2 my-3 rounded-r-md"
          data-block-id={block.id}
        >
          <p className="text-base leading-relaxed text-feishu-text-secondary italic">
            {renderInlineContent(block.content)}
          </p>
        </div>
      );

    case "thematic_break":
      return (
        <hr
          className="my-6 border-t border-feishu-border"
          data-block-id={block.id}
        />
      );

    case "empty":
      return <div className="h-4" data-block-id={block.id} />;

    default:
      return null;
  }
}

/** 渲染行内内容（支持加粗、斜体、行内代码、删除线） */
function renderInlineContent(content: string): React.ReactNode {
  // 简单的正则匹配行内格式
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  while (remaining.length > 0) {
    // 加粗 **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 斜体 *text*
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic">
          {italicMatch[1]}
        </em>,
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 行内代码 `text`
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="bg-feishu-code text-feishu-code-text px-1.5 py-0.5 rounded text-sm font-mono"
        >
          {codeMatch[1]}
        </code>,
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 删除线 ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      parts.push(
        <del key={key++} className="line-through">
          {strikeMatch[1]}
        </del>,
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 普通文本，取到下一个特殊字符
    const nextSpecial = remaining.search(/[*`~]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // 如果特殊字符不匹配任何模式，当普通字符处理
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}

/** Markdown 渲染视图（飞书风格） */
export function MarkdownView({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-feishu-text-placeholder">
        <div className="text-center">
          <FileTextIcon />
          <p className="mt-3 text-sm">选择一个文件开始编辑</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto px-8 py-6">
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

/** 空状态图标 */
function FileTextIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto opacity-30"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
