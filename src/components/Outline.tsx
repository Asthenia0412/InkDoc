import { useEffect, useRef, useState, useCallback } from "react";

interface HeadingItem {
  index: number;
  text: string;
  level: number;
}

interface OutlineProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  editorRootRef: React.RefObject<HTMLDivElement | null>;
}

function getIndent(level: number): number {
  return (level - 1) * 12;
}

function getTextSize(level: number): string {
  if (level === 1) return "text-[13px] font-medium";
  if (level === 2) return "text-[12px] font-medium";
  return "text-[12px]";
}

/** 等待 ProseMirror DOM 出现 */
function waitForProseMirror(root: HTMLElement, maxWait = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = root.querySelector(".ProseMirror");
    if (existing) { resolve(existing); return; }
    let elapsed = 0;
    const timer = setInterval(() => {
      const el = root.querySelector(".ProseMirror");
      if (el) { clearInterval(timer); resolve(el); }
      else { elapsed += 50; if (elapsed >= maxWait) { clearInterval(timer); resolve(null); } }
    }, 50);
  });
}

/** 获取所有标题元素（实时查询，不缓存） */
function getHeadingElements(root: HTMLElement): { el: Element; level: number; text: string; index: number }[] {
  const els = root.querySelectorAll(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4");
  const items: { el: Element; level: number; text: string; index: number }[] = [];
  els.forEach((el, index) => {
    const level = parseInt(el.tagName[1], 10);
    const text = el.textContent?.trim() || "";
    if (text) items.push({ el, level, text, index });
  });
  return items;
}

export function Outline({ scrollContainerRef, editorRootRef }: OutlineProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 提取标题列表（纯数据，不操作 DOM id）
  const extractHeadings = useCallback(() => {
    if (!editorRootRef.current) return;
    const items = getHeadingElements(editorRootRef.current);
    setHeadings(items.map(({ level, text, index }) => ({ index, text, level })));
  }, [editorRootRef]);

  // 等待编辑器就绪
  useEffect(() => {
    if (!editorRootRef.current) return;
    let cancelled = false;

    waitForProseMirror(editorRootRef.current).then((dom) => {
      if (cancelled || !dom) return;
      extractHeadings();

      const observer = new MutationObserver(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(extractHeadings, 300);
      });

      observer.observe(dom, { childList: true, subtree: true, characterData: true });
    });

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editorRootRef, extractHeadings]);

  // 滚动时追踪当前标题（用 scroll 事件而非 IntersectionObserver，更可靠）
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateActive = () => {
      if (!editorRootRef.current) return;
      const items = getHeadingElements(editorRootRef.current);
      if (items.length === 0) return;

      let current = 0;

      for (let i = 0; i < items.length; i++) {
        const rect = items[i].el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // 标题在容器可视区域顶部以上
        if (rect.top - containerRect.top < 60) {
          current = i;
        } else {
          break;
        }
      }

      setActiveIndex(current);
    };

    // 防抖滚动监听
    const onScroll = () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(updateActive, 50);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    // 初始更新
    setTimeout(updateActive, 500);

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [scrollContainerRef, editorRootRef]);

  // 点击跳转 — 实时查询 DOM，不依赖 id
  const handleClick = useCallback(
    (headingIndex: number) => {
      const container = scrollContainerRef.current;
      if (!editorRootRef.current || !container) return;

      const items = getHeadingElements(editorRootRef.current);
      const target = items[headingIndex];
      if (!target) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = target.el.getBoundingClientRect();
      const offsetTop = elRect.top - containerRect.top + container.scrollTop;

      container.scrollTo({
        top: offsetTop - 20,
        behavior: "smooth",
      });

      setActiveIndex(headingIndex);
    },
    [scrollContainerRef, editorRootRef]
  );

  return (
    <nav className="w-[180px] shrink-0 border-r border-[#dee0e3] bg-[#fafafa] overflow-y-auto py-3 px-2">
      <div className="text-[11px] text-[#8f959e] font-medium uppercase tracking-wider px-2 mb-2">
        大纲
      </div>
      {headings.length === 0 ? (
        <div className="px-2 text-[12px] text-[#c0c4cc]">暂无标题</div>
      ) : (
        headings.map((h) => (
          <button
            key={`${h.index}-${h.text}`}
            onClick={() => handleClick(h.index)}
            className={`
              w-full text-left px-2 py-1 rounded-md transition-colors duration-150 cursor-pointer
              truncate block
              ${activeIndex === h.index
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
        ))
      )}
    </nav>
  );
}
