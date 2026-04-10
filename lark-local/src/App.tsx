import React from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MarkdownView } from "@/components/MarkdownView";
import { useEditorStore } from "@/stores/editor";

/** 顶部标题栏（macOS 风格，配合 Overlay title bar） */
function TitleBar() {
  const { currentFilePath, toggleSidebar, sidebarVisible } = useEditorStore();

  const fileName = currentFilePath?.split("/").pop() || "Lark Local";

  return (
    <header
      className="h-10 bg-feishu-sidebar border-b border-feishu-border flex items-center px-3 gap-2 shrink-0"
      data-tauri-drag-region
    >
      <button
        onClick={toggleSidebar}
        className="p-1 rounded hover:bg-feishu-hover transition-colors"
        title={sidebarVisible ? "收起侧边栏" : "展开侧边栏"}
      >
        {sidebarVisible ? (
          <PanelLeftClose size={16} className="text-feishu-text-secondary" />
        ) : (
          <PanelLeft size={16} className="text-feishu-text-secondary" />
        )}
      </button>
      <span className="text-sm font-medium text-feishu-text truncate" data-tauri-drag-region>
        {fileName}
      </span>
    </header>
  );
}

/** 主应用组件 */
export default function App() {
  const { blocks, error } = useEditorStore();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-feishu-bg">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {error}
            </div>
          )}
          <MarkdownView blocks={blocks} />
        </main>
      </div>
    </div>
  );
}
