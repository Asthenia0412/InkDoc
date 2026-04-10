import { useEffect, useRef, useState, useCallback } from "react";

interface HeadingItem {
  id: string;
  text: string;
  level: number; // 1-4
}

interface OutlineProps {
  /** 编辑器滚动容器的 ref */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** ProseMirror 根元素的 ref */
  editorRootRef: React.RefObject<HTMLDivElement | null>;
}

/** 从文本生成简单的 id */
function slugify(text: string, index: number): string {
  return `heading-${index}-${text.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "-").replace(/-+/g, "-")}`;
}

/** 根据标题级别返回缩进 */
function getIndent(level: number): number {
  return (level - 1) * 12;
}

/** 根据标题级别返回文字大小 */
function getTextSize(level: number): string {
  if (level === 1) return "text-[13px] font-medium";
  if (level === 2) return "text-[12px] font-medium";
  return "text-[12px]";
}

export function Outline({ scrollContainerRef, editorRootRef }: OutlineProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 提取标题列表
  const extractHeadings = useCallback(() => {
    if (!editorRootRef.current) return;

    const headingEls = editorRootRef.current.querySelectorAll("h1, h2, h3, h4");
    const items: HeadingItem[] = [];

    headingEls.forEach((el, index) => {
      const level = parseInt(el.tagName[1], 10);
      const text = el.textContent?.trim() || "";
      if (!text) return;

      // 给标题元素添加 id（用于跳转）
      const id = slugify(text, index);
      el.id = id;

      items.push({ id, text, level });
    });

    setHeadings(items);
  }, [editorRootRef]);

  // 监听编辑器内容变化，重新提取标题
  useEffect(() => {
    if (!editorRootRef.current) return;

    const dom = editorRootRef.current.querySelector(".ProseMirror");
    if (!dom) return;

    // 初始提取
    extractHeadings();

    // 用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(() => {
      // 防抖
      setTimeout(extractHeadings, 100);
    });

    observer.observe(dom, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [editorRootRef, extractHeadings]);

  // 用 IntersectionObserver 追踪当前可见标题
  useEffect(() => {
    if (!scrollContainerRef.current || headings.length === 0) return;

    // 清理旧的 observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // 找到最上面可见的标题
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // 按 top 排序，取最上面的
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-60px 0px -70% 0px", // 顶部偏移 + 底部 70% 区域不算"可见"
        threshold: 0,
      }
    );

    // 观察所有标题元素
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    observerRef.current = observer;

    return () => observer.disconnect();
  }, [scrollContainerRef, headings]);

  // 点击标题跳转
  const handleClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el || !scrollContainerRef.current) return;

      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    },
    [scrollContainerRef]
  );

  if (headings.length === 0) return null;

  return (
    <nav className="w-[180px] shrink-0 border-r border-[#dee0e3] bg-[#fafafa] overflow-y-auto py-3 px-2">
      <div className="text-[11px] text-[#8f959e] font-medium uppercase tracking-wider px-2 mb-2">
        大纲
      </div>
      {headings.map((h) => (
        <button
          key={h.id}
          onClick={() => handleClick(h.id)}
          className={`
            w-full text-left px-2 py-1 rounded-md transition-colors duration-150 cursor-pointer
            truncate block
            ${activeId === h.id
              ? "bg-[#e8f0fe] text-[#3370ff]"
              : "text-[#646a73] hover:bg-[#f0f1f2] hover:text-[#1f2329]"
            }
            ${getTextSize(h.level)}
          `}
          style={{ paddingLeft: `${getIndent(h.level) + 8}px` }}
          title={h.text}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
