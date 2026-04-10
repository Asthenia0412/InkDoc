import { useEffect, useRef } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { useEditorStore } from "@/stores/editor";

/** Milkdown 所见即所得编辑器（飞书风格） */
export function MarkdownView() {
  const { markdownContent, currentFilePath, updateMarkdown, saveCurrentFile } = useEditorStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownContentRef = useRef(markdownContent);

  // 保持 markdownContent 的 ref 同步（避免闭包陷阱）
  useEffect(() => {
    markdownContentRef.current = markdownContent;
  }, [markdownContent]);

  // 初始化 / 重建编辑器：当 currentFilePath 变化时重建
  useEffect(() => {
    if (!currentFilePath || !editorRef.current) return;

    // 清理旧实例
    if (crepeRef.current) {
      crepeRef.current.destroy();
      crepeRef.current = null;
    }

    const root = editorRef.current;
    const content = markdownContentRef.current || "";

    const crepe = new Crepe({
      root,
      defaultValue: content,
      // 禁用会导致滚动到顶部的功能
      features: {
        [CrepeFeature.TopBar]: false,      // 禁用顶部浮动工具栏（会导致滚动到顶部）
        [CrepeFeature.BlockEdit]: false,   // 禁用块编辑浮动菜单
      },
    });

    crepe.create().then(() => {
      crepeRef.current = crepe;

      // 绑定编辑器内容变化事件
      const dom = root.querySelector(".ProseMirror");
      if (dom) {
        dom.addEventListener("input", handleEditorInput);
      }
    });

    const handleEditorInput = () => {
      if (!crepeRef.current) return;
      const md = crepeRef.current.getMarkdown();
      updateMarkdown(md);

      // 防抖保存
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveCurrentFile();
      }, 1000);
    };

    return () => {
      const dom = root.querySelector(".ProseMirror");
      if (dom) {
        dom.removeEventListener("input", handleEditorInput);
      }
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
    };
  }, [currentFilePath]); // 文件切换时重建编辑器

  // Cmd+S 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (crepeRef.current) {
          updateMarkdown(crepeRef.current.getMarkdown());
        }
        saveCurrentFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [updateMarkdown, saveCurrentFile]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 空状态
  if (!currentFilePath) {
    return (
      <div className="flex items-center justify-center h-full text-[#8f959e]">
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-30">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="mt-3 text-sm">选择一个文件开始编辑</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 编辑器容器 */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          className="milkdown-editor max-w-[750px] mx-auto px-4 py-8 min-h-full"
        />
      </div>
    </div>
  );
}
