import { useEffect, useState, useRef } from "react";
import { PanelLeftClose, PanelLeft, Settings } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MarkdownView } from "@/components/MarkdownView";
import { SettingsPanel, getAutoPushSettings } from "@/components/SettingsPanel";
import { useAutoUpdater, UpdateBanner } from "@/components/UpdateBanner";
import { useEditorStore } from "@/stores/editor";
import { gitAutoPush } from "@/lib/tauri-api";

const STORAGE_KEY_LAST_FOLDER = "inkdoc:last-folder";

/** 顶部标题栏（macOS 风格） */
function TitleBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { currentFilePath, toggleSidebar, sidebarVisible } = useEditorStore();
  const fileName = currentFilePath?.split("/").pop() || "InkDoc";

  return (
    <header
      className="h-10 bg-white border-b border-[#dee0e3] flex items-center justify-between pl-[72px] pr-3 shrink-0 select-none"
      data-tauri-drag-region
    >
      <div className="w-8 shrink-0" />
      <div className="flex-1" data-tauri-drag-region />
      <div className="flex items-center gap-1.5 shrink-0" data-tauri-drag-region>
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
        <button
          onClick={onOpenSettings}
          className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
          title="设置"
        >
          <Settings size={16} className="text-[#8f959e]" />
        </button>
        <span className="text-[13px] text-[#8f959e] truncate max-w-[260px]">
          {fileName}
        </span>
      </div>
    </header>
  );
}

/** 主应用组件 */
export default function App() {
  const { error, rootPath, openFolder } = useEditorStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoPushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { state: updateState, checkForUpdate, downloadAndInstall, dismiss: dismissUpdate } = useAutoUpdater();

  // 启动时：恢复上次文件夹 或 自动弹出选择
  useEffect(() => {
    if (rootPath) return;

    const lastFolder = localStorage.getItem(STORAGE_KEY_LAST_FOLDER);

    if (lastFolder) {
      openFolder(lastFolder);
    } else {
      (async () => {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false });
        if (selected) {
          openFolder(selected as string);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 启动后检查更新（延迟 3 秒）
  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // 记住上次文件夹
  useEffect(() => {
    if (rootPath) {
      localStorage.setItem(STORAGE_KEY_LAST_FOLDER, rootPath);
    }
  }, [rootPath]);

  // 定时自动推送
  useEffect(() => {
    // 清除旧定时器
    if (autoPushTimerRef.current) {
      clearInterval(autoPushTimerRef.current);
      autoPushTimerRef.current = null;
    }

    if (!rootPath) return;

    const { enabled, intervalMinutes, commitMessage } = getAutoPushSettings();
    if (!enabled) return;

    const intervalMs = intervalMinutes * 60 * 1000;

    autoPushTimerRef.current = setInterval(async () => {
      try {
        await gitAutoPush(rootPath, commitMessage);
      } catch {
        // 静默失败，不打扰用户
      }
    }, intervalMs);

    return () => {
      if (autoPushTimerRef.current) {
        clearInterval(autoPushTimerRef.current);
      }
    };
  }, [rootPath]); // 只在 rootPath 变化时重建定时器

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#f5f6f7]">
      <TitleBar onOpenSettings={() => setSettingsOpen(true)} />
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

      {/* 设置面板 */}
      {settingsOpen && (
        <SettingsPanel
          rootPath={rootPath}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* 自动更新提示 */}
      <UpdateBanner
        state={updateState}
        onDownload={downloadAndInstall}
        onDismiss={dismissUpdate}
      />
    </div>
  );
}
