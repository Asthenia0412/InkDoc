import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MarkdownView } from "@/components/MarkdownView";
import { useEditorStore } from "@/stores/editor";

/** 顶部标题栏（macOS 风格） */
function TitleBar() {
  const { currentFilePath, toggleSidebar, sidebarVisible } = useEditorStore();
  const fileName = currentFilePath?.split("/").pop() || "Lark Local";

  return (
    <header
      className="h-10 bg-white border-b border-[#dee0e3] flex items-center justify-between pl-[72px] pr-3 shrink-0 select-none"
      data-tauri-drag-region
    >
      {/* 左侧留空（macOS 红绿灯按钮占位） */}
      <div className="w-8 shrink-0" />

      {/* 中间：可拖拽区域 */}
      <div className="flex-1" data-tauri-drag-region />

      {/* 右侧：侧边栏切换 + 文件名 */}
      <div className="flex items-center gap-2 shrink-0" data-tauri-drag-region>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
          title={sidebarVisible ? "收起侧边栏" : "展开侧边栏"}
        >
          {sidebarVisible ? (
            <PanelLeftClose size={16} className="text-[#8f959e]" />
          ) : (
            <PanelLeft size={16} className="text-[#8f959e]" />
          )}
        </button>
        <span className="text-[13px] text-[#8f959e] truncate max-w-[300px]">
          {fileName}
        </span>
      </div>
    </header>
  );
}

/** 主应用组件 */
export default function App() {
  const { error } = useEditorStore();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#f5f6f7]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-white">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {error}
            </div>
          )}
          <MarkdownView />
        </main>
      </div>
    </div>
  );
}
