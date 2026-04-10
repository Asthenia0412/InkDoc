import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Code, Eye, X } from "lucide-react";
import "highlight.js/styles/github.css";
import { useEditorStore } from "@/stores/editor";
import { Outline } from "@/components/Outline";
import { SearchReplacePanel } from "@/components/SearchReplace";
import { readImageAsDataUrl, savePastedImage } from "@/lib/tauri-api";
import { convertFileSrc } from "@tauri-apps/api/core";

/** Milkdown 所见即所得编辑器（简单版） */
export function SimpleMarkdownEditor() {
  const { markdownContent, currentFilePath, updateMarkdown, saveCurrentFile, previewImagePath, setPreviewImage } = useEditorStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const sourceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (sourceSaveTimerRef.current) clearTimeout(sourceSaveTimerRef.current);
    };
  }, []);

  // 处理内容变化
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    updateMarkdown(text);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCurrentFile();
    }, 1000);
  }, [updateMarkdown, saveCurrentFile]);

  // 处理粘贴
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!currentFilePath) return;

    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        // 确定文件扩展名
        let extension = "png";
        if (item.type === "image/jpeg") extension = "jpg";
        else if (item.type === "image/gif") extension = "gif";
        else if (item.type === "image/svg+xml") extension = "svg";
        else if (item.type === "image/webp") extension = "webp";

        // 转换为 base64
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const imageData = reader.result as string;
            const relativePath = await savePastedImage(currentFilePath, imageData, extension);
            
            // 在光标位置插入图片标记
            if (textareaRef.current) {
              const start = textareaRef.current.selectionStart;
              const end = textareaRef.current.selectionEnd;
              const text = markdownContent;
              const before = text.substring(0, start);
              const after = text.substring(end);
              const newText = `${before}![粘贴的图片](${relativePath})${after}`;
              updateMarkdown(newText);
              saveCurrentFile();
            }
          } catch (error) {
            console.error("Failed to save pasted image:", error);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, [currentFilePath, markdownContent, updateMarkdown, saveCurrentFile]);

  // Cmd+S 保存 + Cmd+F 搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveCurrentFile]);

  // 自定义 Markdown 组件
  const MarkdownComponents = {
    img: ({ src, alt, ...props }: any) => {
      let imageSrc = src;
      
      // 如果是相对路径，转换为 Tauri asset URL
      if (currentFilePath && !src.startsWith("http://") && !src.startsWith("https://") && 
          !src.startsWith("data:") && !src.startsWith("asset://")) {
        const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf("/"));
        const absolutePath = (dir + "/" + src)
          .split("/")
          .reduce((acc: string[], part) => {
            if (part === "..") acc.pop();
            else if (part !== ".") acc.push(part);
            return acc;
          }, [])
          .join("/");
        try {
          imageSrc = convertFileSrc(absolutePath, "asset");
        } catch {
          imageSrc = src;
        }
      }
      
      return <img src={imageSrc} alt={alt} className="max-w-full rounded shadow-sm my-4" {...props} />;
    },
  };

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

          {/* 分屏编辑模式 */}
          <div className="flex h-full">
            {/* 左侧编辑区 */}
            <div className="flex-1 border-r border-[#dee0e3] h-full">
              <div className="px-6 py-4 bg-[#fafafa] border-b border-[#dee0e3] text-sm font-medium text-[#646a73]">
                编辑
              </div>
              <textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={handleContentChange}
                onPaste={handlePaste}
                spellCheck={false}
                className="w-full h-[calc(100%-57px)] px-6 py-8 bg-transparent
                  text-[14px] leading-relaxed text-[#1f2329] font-mono
                  resize-none outline-none border-none"
                placeholder="在此输入 Markdown 内容..."
              />
            </div>
            
            {/* 右侧预览区 */}
            <div className="flex-1 h-full">
              <div className="px-6 py-4 bg-[#fafafa] border-b border-[#dee0e3] text-sm font-medium text-[#646a73]">
                预览
              </div>
              <div className="px-6 py-8 h-[calc(100%-57px)] overflow-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={MarkdownComponents}
                  className="prose prose-slate max-w-none
                    prose-headings:font-bold prose-headings:text-[#1f2329]
                    prose-p:text-[#1f2329] prose-p:leading-relaxed
                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                    prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded-lg
                    prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:text-gray-600
                    prose-strong:text-[#1f2329]"
                >
                  {markdownContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
