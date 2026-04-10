import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Replace, ArrowDown, ArrowUp, X } from "lucide-react";

interface SearchReplaceProps {
  onClose: () => void;
}

/** 获取 ProseMirror DOM */
function getEditor(): Element | null {
  return document.querySelector(".ProseMirror");
}

/** 在 ProseMirror 内搜索所有文本匹配，返回 Range 数组 */
function findTextRanges(root: Element, keyword: string): Range[] {
  const ranges: Range[] = [];
  const lowerKeyword = keyword.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || "";
    const lowerText = text.toLowerCase();
    let pos = 0;
    while (true) {
      const index = lowerText.indexOf(lowerKeyword, pos);
      if (index === -1) break;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + keyword.length);
      ranges.push(range);
      pos = index + 1;
    }
  }
  return ranges;
}

export function SearchReplacePanel({ onClose }: SearchReplaceProps) {
  const [keyword, setKeyword] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rangesRef = useRef<Range[]>([]);
  const originalSelectionRef = useRef<Range | null>(null);

  // 保存当前选区（关闭时恢复）
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      originalSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && originalSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(originalSelectionRef.current);
    }
  }, []);

  // 选中指定索引的匹配文本（不修改 DOM，只改变选区）
  const selectMatch = useCallback((index: number) => {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();

    const range = rangesRef.current[index];
    if (range) {
      sel.addRange(range);
      // 滚动到选区
      const editor = getEditor();
      if (editor) {
        const rect = range.getBoundingClientRect();
        const container = editor.closest(".overflow-y-auto");
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const offsetTop = rect.top - containerRect.top + container.scrollTop;
          container.scrollTo({ top: offsetTop - 80, behavior: "smooth" });
        }
      }
    }
  }, []);

  // 执行搜索（只计算匹配，不移动选区）
  const performSearch = useCallback((newIndex: number, shouldSelect = false) => {
    const editor = getEditor();
    if (!editor) return;

    if (!keyword) {
      rangesRef.current = [];
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const ranges = findTextRanges(editor, keyword);
    rangesRef.current = ranges;
    setMatchCount(ranges.length);

    if (ranges.length === 0) {
      setCurrentMatch(0);
      return;
    }

    const idx = Math.max(0, Math.min(newIndex, ranges.length - 1));
    setCurrentMatch(idx);

    // 只在明确要求时才移动选区（避免抢焦点）
    if (shouldSelect) {
      selectMatch(idx);
    }
  }, [keyword, selectMatch]);

  // keyword 变化时只计算匹配数，不移动选区
  useEffect(() => {
    saveSelection();
    performSearch(0, false);
  }, [keyword, performSearch, saveSelection]);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        restoreSelection();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, restoreSelection]);

  const findNext = useCallback(() => {
    if (matchCount === 0) return;
    performSearch((currentMatch + 1) % matchCount, true);
  }, [matchCount, currentMatch, performSearch]);

  const findPrev = useCallback(() => {
    if (matchCount === 0) return;
    performSearch((currentMatch - 1 + matchCount) % matchCount, true);
  }, [matchCount, currentMatch, performSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? findPrev() : findNext();
    }
  }, [findNext, findPrev]);

  // 替换当前选中的匹配
  const replaceCurrent = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || matchCount === 0) {
      findNext();
      return;
    }

    const selectedText = sel.toString();
    if (selectedText.toLowerCase() !== keyword.toLowerCase()) {
      findNext();
      return;
    }

    // 用 execCommand 替换 — ProseMirror 会感知 contenteditable 的变化
    document.execCommand("insertText", false, replaceText);

    // 重新搜索
    setTimeout(() => performSearch(currentMatch), 10);
  }, [keyword, replaceText, matchCount, currentMatch, findNext, performSearch]);

  // 替换全部
  const replaceAll = useCallback(() => {
    const editor = getEditor();
    if (!editor || !keyword) return;

    // 获取纯文本内容，替换后通过 ProseMirror 的 input 事件更新
    const ranges = findTextRanges(editor, keyword);
    if (ranges.length === 0) return;

    // 从后往前替换，避免偏移
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i];
      const sel = window.getSelection();
      if (!sel) continue;
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("insertText", false, replaceText);
    }

    rangesRef.current = [];
    setMatchCount(0);
    setCurrentMatch(0);
  }, [keyword, replaceText]);

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 w-[420px] bg-white rounded-xl shadow-2xl border border-[#dee0e3]">
      {/* 搜索行 */}
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8f959e] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索..."
            className="w-full h-7 pl-7 pr-2 text-[13px] rounded border border-[#dee0e3] bg-[#fafafa]
              text-[#1f2329] placeholder:text-[#c0c4cc]
              focus:outline-none focus:border-[#3370ff] focus:bg-white"
          />
        </div>
        {keyword && (
          <span className="text-[11px] text-[#8f959e] whitespace-nowrap min-w-[40px] text-center">
            {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "无结果"}
          </span>
        )}
        <button
          onClick={findNext}
          disabled={matchCount === 0}
          className="p-1 rounded hover:bg-[#f0f1f2] disabled:opacity-30 transition-colors"
          title="下一个 (Enter)"
        >
          <ArrowDown size={14} className="text-[#646a73]" />
        </button>
        <button
          onClick={findPrev}
          disabled={matchCount === 0}
          className="p-1 rounded hover:bg-[#f0f1f2] disabled:opacity-30 transition-colors"
          title="上一个 (Shift+Enter)"
        >
          <ArrowUp size={14} className="text-[#646a73]" />
        </button>
        <button
          onClick={() => setShowReplace(!showReplace)}
          className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
          title="替换"
        >
          <Replace size={14} className="text-[#646a73]" />
        </button>
        <button
          onClick={() => { restoreSelection(); onClose(); }}
          className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
          title="关闭 (Esc)"
        >
          <X size={14} className="text-[#8f959e]" />
        </button>
      </div>

      {/* 替换行 */}
      {showReplace && (
        <div className="flex items-center gap-1.5 px-2.5 py-2 border-t border-[#dee0e3]">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="替换为..."
            className="flex-1 h-7 px-2.5 text-[13px] rounded border border-[#dee0e3] bg-[#fafafa]
              text-[#1f2329] placeholder:text-[#c0c4cc]
              focus:outline-none focus:border-[#3370ff] focus:bg-white"
          />
          <button
            onClick={replaceCurrent}
            disabled={matchCount === 0}
            className="h-7 px-3 text-[12px] rounded border border-[#dee0e3] text-[#646a73]
              hover:bg-[#f0f1f2] disabled:opacity-30 transition-colors whitespace-nowrap"
          >
            替换
          </button>
          <button
            onClick={replaceAll}
            disabled={matchCount === 0}
            className="h-7 px-3 text-[12px] rounded bg-[#3370ff] text-white
              hover:bg-[#2860e1] disabled:opacity-30 transition-colors whitespace-nowrap"
          >
            全部替换
          </button>
        </div>
      )}
    </div>
  );
}
