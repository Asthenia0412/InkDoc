import { useEffect, useRef, useState, useCallback } from "react";

interface HeadingItem {
  index: number;
  text: string;
  level: number;
}

interface OutlineProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** 当前文件路径，用于触发重新提取 */
  filePath: string | null;
}

function getIndent(level: number): number {
  return (level - 1) * 12;
}

function getTextSize(level: number): string {
  if (level === 1) return "text-[13px] font-medium";
  if (level === 2) return "text-[12px] font-medium";
  return "text-[12px]";
}

/** 获取所有标题元素 */
function getHeadingElements(): { el: Element; level: number; text: string; index: number }[] {
  const pm = document.querySelector(".ProseMirror");
  if (!pm) return [];
  const els = pm.querySelectorAll("h1, h2, h3, h4");
  const items: { el: Element; level: number; text: string; index: number }[] = [];
  els.forEach((el, index) => {
    const level = parseInt(el.tagName[1], 10);
    const text = el.textContent?.trim() || "";
    if (text) items.push({ el, level, text, index });
  });
  return items;
}

export function Outline({ scrollContainerRef, filePath }: OutlineProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // 提取标题列表
  const extractHeadings = useCallback(() => {
    if (!mountedRef.current) return;
    const items = getHeadingElements();
    setHeadings(items.map(({ level, text, index }) => ({ index, text, level })));
  }, []);

  // 等待 ProseMirror 出现后开始监听
  useEffect(() => {
    mountedRef.current = true;

    const tryStart = () => {
      const pm = document.querySelector(".ProseMirror");
      if (!pm) {
        // 还没准备好，继续等
        if (mountedRef.current) {
          setTimeout(tryStart, 200);
        }
        return;
      }

      // 初始提取
      extractHeadings();

      // 监听 DOM 变化
      const observer = new MutationObserver(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(extractHeadings, 300);
      });

      observer.observe(pm, { childList: true, subtree: true, characterData: true });

      // 清理
      return () => {
        observer.disconnect();
      };
    };

    // 延迟启动，给 Crepe 时间初始化
    const timer = setTimeout(tryStart, 300);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filePath, extractHeadings]);

  // 滚动追踪
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateActive = () => {
      const items = getHeadingElements();
      if (items.length === 0) return;

      let current = 0;
      const containerRect = container.getBoundingClientRect();

      for (let i = 0; i < items.length; i++) {
        const rect = items[i].el.getBoundingClientRect();
        if (rect.top - containerRect.top < 60) {
          current = i;
        } else {
          break;
        }
      }
      setActiveIndex(current);
    };

    const onScroll = () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(updateActive, 50);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    setTimeout(updateActive, 800);

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [scrollContainerRef, filePath]);

  // 点击跳转
  const handleClick = useCallback(
    (headingIndex: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const items = getHeadingElements();
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
    [scrollContainerRef]
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
