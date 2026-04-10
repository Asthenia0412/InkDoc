import { useEffect, useRef, useState, useCallback } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { Code, Eye, X } from "lucide-react";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { useEditorStore } from "@/stores/editor";
import { Outline } from "@/components/Outline";
import { SearchReplacePanel } from "@/components/SearchReplace";
import { readImageAsDataUrl } from "@/lib/tauri-api";

/** 检测文本是否包含 Markdown 语法 */
function isMarkdownContent(text: string): boolean {
  const lines = text.split("\n");
  let score = 0;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) score++;          // 标题
    if (/^[-*+]\s/.test(line)) score++;             // 无序列表
    if (/^\d+\.\s/.test(line)) score++;             // 有序列表
    if (/^>\s/.test(line)) score++;                 // 引用
    if (/^```/.test(line)) score++;                 // 代码块
    if (/^\|/.test(line)) score++;                  // 表格
    if (/^-{3,}$/.test(line.trim())) score++;       // 分割线
    if (/\*\*[^*]+\*\*/.test(line)) score++;        // 粗体
    if (/\*[^*]+\*/.test(line)) score++;            // 斜体
    if (/\[.+\]\(.+\)/.test(line)) score++;        // 链接
    if (/!\[.+\]\(.+\)/.test(line)) score++;       // 图片
    if (/`[^`]+`/.test(line)) score++;              // 行内代码
    if (/^- \[[ x]\]/.test(line)) score++;          // 任务列表
    if (/^\s{2,}\S/.test(line)) score++;            // 缩进（可能是列表嵌套）
  }
  // 至少包含 2 个 Markdown 特征才认为是 Markdown
  return score >= 2;
}

/** 预处理 Markdown：将相对路径图片替换为 base64 data URL */
async function resolveImagePathsInMarkdown(markdown: string, currentFilePath: string): Promise<string> {
  const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf("/"));
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  const matches: { full: string; alt: string; src: string; index: number }[] = [];
  let match;
  while ((match = imgRegex.exec(markdown)) !== null) {
    const src = match[2];
    // 跳过非文件路径
    if (src.startsWith("http://") || src.startsWith("https://") ||
        src.startsWith("data:") || src.startsWith("/") ||
        src.startsWith("blob:") || src.startsWith("file://")) {
      continue;
    }
    // 只处理有图片扩展名的路径
    if (!/\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?)$/i.test(src)) {
      continue;
    }
    matches.push({ full: match[0], alt: match[1], src, index: match.index });
  }

  if (matches.length === 0) return markdown;

  // 并行读取所有图片
  const results = await Promise.allSettled(
    matches.map(async (m) => {
      const absolutePath = (dir + "/" + m.src)
        .split("/")
        .reduce((acc: string[], part) => {
          if (part === "..") acc.pop();
          else if (part !== ".") acc.push(part);
          return acc;
        }, [])
        .join("/");
      const dataUrl = await readImageAsDataUrl(absolutePath);
      return { ...m, dataUrl };
    })
  );

  // 从后往前替换（避免索引偏移）
  let result = markdown;
  const resolved = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.index - a.index);

  for (const { full, alt, dataUrl } of resolved) {
    result = result.replace(full, `![${alt}](${dataUrl})`);
  }

  return result;
}

/** 将编辑器中相对路径的图片转为 base64 data URL（通过 Rust 读取文件） */
async function fixRelativeImagePaths(editorDom: Element) {
  const filePath = useEditorStore.getState().currentFilePath;
  if (!filePath) return;

  const dir = filePath.substring(0, filePath.lastIndexOf("/"));

  const images = editorDom.querySelectorAll("img[src]");
  const promises: Promise<void>[] = [];

  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;

    // 跳过非文件路径
    if (src.startsWith("http://") || src.startsWith("https://") ||
        src.startsWith("asset://") || src.startsWith("data:") ||
        src.startsWith("blob:") || src.startsWith("/") ||
        src.startsWith("file://")) {
      return;
    }

    // 只处理有图片扩展名的路径
    if (!/\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?)$/i.test(src)) {
      return;
    }

    // 拼接绝对路径并规范化
    const absolutePath = (dir + "/" + src)
      .split("/")
      .reduce((acc: string[], part) => {
        if (part === "..") acc.pop();
        else if (part !== ".") acc.push(part);
        return acc;
      }, [])
      .join("/");

    // 异步读取图片为 base64
    const p = readImageAsDataUrl(absolutePath)
      .then((dataUrl) => {
        img.setAttribute("src", dataUrl);
      })
      .catch(() => {
        // 文件不存在，保持原样
      });

    promises.push(p);
  });

  await Promise.all(promises);
}

/** Milkdown 所见即所得编辑器（飞书风格） */
export function MarkdownView() {
  const { markdownContent, currentFilePath, updateMarkdown, saveCurrentFile, previewImagePath, setPreviewImage } = useEditorStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownContentRef = useRef(markdownContent);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [rebuildTrigger, setRebuildTrigger] = useState(0);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const sourceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保持 markdownContent 的 ref 同步（避免闭包陷阱）
  useEffect(() => {
    markdownContentRef.current = markdownContent;
  }, [markdownContent]);

  // 加载图片预览
  useEffect(() => {
    if (!previewImagePath) {
      setPreviewDataUrl(null);
      return;
    }
    readImageAsDataUrl(previewImagePath)
      .then(setPreviewDataUrl)
      .catch(() => setPreviewDataUrl(null));
  }, [previewImagePath]);

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

        // 粘贴 Markdown 自动渲染
        dom.addEventListener("paste", handlePaste as EventListener);

        // 修复相对路径图片
        fixRelativeImagePaths(dom);
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

    // 粘贴 Markdown 内容自动解析渲染
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const text = clipboardData.getData("text/plain");
      const html = clipboardData.getData("text/html");

      // 如果有 HTML（从浏览器/其他富文本编辑器复制），让默认行为处理
      if (html && html.trim()) return;

      // 检测是否为 Markdown 内容（包含常见 Markdown 语法）
      if (!isMarkdownContent(text)) return;

      // 阻止默认粘贴行为
      e.preventDefault();

      // 获取当前编辑器内容，在光标位置插入 Markdown 后重新解析
      if (!crepeRef.current) return;

      // 通过 ProseMirror 的 dispatch 插入解析后的 Markdown
      const view = (crepeRef.current as any).editor?.view;
      if (view) {
        // 使用 Milkdown 的 parser 解析 Markdown 并插入
        const parser = (crepeRef.current as any).editor?.context?.parser;
        if (parser) {
          try {
            const slice = parser(text);
            if (slice) {
              const tr = view.state.tr.replaceSelection(slice);
              view.dispatch(tr);
              return;
            }
          } catch {
            // 解析失败，回退到纯文本
          }
        }
      }

      // 回退：直接用 insertText 插入（不会渲染，但至少不丢内容）
      document.execCommand("insertText", false, text);
    };

    return () => {
      const dom = root.querySelector(".ProseMirror");
      if (dom) {
          dom.removeEventListener("input", handleEditorInput);
          dom.removeEventListener("paste", handlePaste as EventListener);
        }
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
    };
  }, [currentFilePath, rebuildTrigger]); // 文件切换或源码模式退出时重建编辑器

  // Cmd+S 保存 + Cmd+F 搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (crepeRef.current) {
          updateMarkdown(crepeRef.current.getMarkdown());
        }
        saveCurrentFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [updateMarkdown, saveCurrentFile]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (sourceSaveTimerRef.current) clearTimeout(sourceSaveTimerRef.current);
    };
  }, []);

  // 切换到源码模式时，同步当前 Markdown 内容
  const toggleSourceMode = useCallback(() => {
    if (!sourceMode) {
      // 进入源码模式：从编辑器获取最新 Markdown
      let md = markdownContent;
      if (crepeRef.current) {
        try { md = crepeRef.current.getMarkdown(); } catch { /* ignore */ }
      }
      setSourceText(md);
    } else {
        // 退出源码模式：更新内容并触发编辑器重建
        updateMarkdown(sourceText);
        markdownContentRef.current = sourceText;
        setRebuildTrigger((n) => n + 1);
      }
    setSourceMode(!sourceMode);
  }, [sourceMode, markdownContent, sourceText, updateMarkdown]);

  // 源码模式下的内容变化 → 防抖保存
  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSourceText(text);
    updateMarkdown(text);
    if (sourceSaveTimerRef.current) clearTimeout(sourceSaveTimerRef.current);
    sourceSaveTimerRef.current = setTimeout(() => {
      saveCurrentFile();
    }, 1000);
  }, [updateMarkdown, saveCurrentFile]);

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
    <div className="h-full flex">
      {/* 左侧大纲 */}
      <Outline
        key={currentFilePath}
        scrollContainerRef={scrollContainerRef}
        filePath={currentFilePath}
      />

      {/* 右侧编辑区 */}
      <div className="flex-1 relative">
        {/* 图片预览 */}
        {previewImagePath && (
          <div className="absolute inset-0 z-40 bg-[#f5f6f7] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#dee0e3] bg-white">
              <span className="text-[13px] text-[#1f2329] truncate flex-1">
                {previewImagePath.split("/").pop()}
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
              >
                <X size={16} className="text-[#8f959e]" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt={previewImagePath.split("/").pop()}
                  className="max-w-full max-h-full object-contain rounded shadow-lg"
                />
              ) : (
                <div className="text-[#8f959e] text-sm">加载中...</div>
              )}
            </div>
          </div>
        )}
        <div className="h-full overflow-y-auto" ref={scrollContainerRef}>
          {/* 搜索替换面板 */}
          {searchOpen && (
            <SearchReplacePanel onClose={() => setSearchOpen(false)} />
          )}

          {/* 源码模式 */}
          {sourceMode ? (
            <textarea
              value={sourceText}
              onChange={handleSourceChange}
              spellCheck={false}
              className="w-full h-full max-w-[750px] mx-auto px-6 py-8 bg-transparent
                text-[14px] leading-relaxed text-[#1f2329] font-mono
                resize-none outline-none border-none"
              placeholder="Markdown 源码..."
            />
          ) : (
            <div
              ref={editorRef}
              className="milkdown-editor max-w-[750px] mx-auto px-6 py-8 min-h-full"
            />
          )}
        </div>

        {/* 右下角模式切换按钮（固定在编辑区右下角，不随内容滚动） */}
        <button
          onClick={toggleSourceMode}
          className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5
            h-8 px-3 rounded-lg border border-[#dee0e3] bg-white/90 backdrop-blur-sm
            text-[12px] text-[#646a73] hover:bg-[#f0f1f2] hover:text-[#1f2329]
            shadow-sm transition-colors"
          title={sourceMode ? "切换到富文本模式" : "切换到源码模式"}
        >
          {sourceMode ? (
            <>
              <Eye size={14} />
              <span>预览</span>
            </>
          ) : (
            <>
              <Code size={14} />
              <span>源码</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
