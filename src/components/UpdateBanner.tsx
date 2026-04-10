import { useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

type UpdateState =
  | { status: "idle" }
  | { status: "available"; info: UpdateInfo }
  | { status: "downloading"; progress: number }
  | { status: "installing" }
  | { status: "error"; message: string };

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  const checkForUpdate = async () => {
    try {
      const update = await check();
      if (update) {
        setState({
          status: "available",
          info: {
            version: update.version,
            date: update.date || "",
            body: update.body || "",
          },
        });
      }
    } catch {
      // 静默失败
    }
  };

  const downloadAndInstall = async () => {
    try {
      setState({ status: "downloading", progress: 0 });

      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength: number | undefined;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength && contentLength > 0) {
              const pct = Math.round((downloaded / contentLength) * 100);
              setState({ status: "downloading", progress: pct });
            }
            break;
          case "Finished":
            setState({ status: "installing" });
            break;
        }
      });

      // 安装完成，重启应用
      await relaunch();
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  };

  const dismiss = () => {
    setState({ status: "idle" });
  };

  return { state, checkForUpdate, downloadAndInstall, dismiss };
}

export function UpdateBanner({
  state,
  onDownload,
  onDismiss,
}: {
  state: UpdateState;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  if (state.status === "idle") return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[400px] bg-white rounded-xl shadow-2xl border border-[#dee0e3] overflow-hidden">
      {state.status === "available" && (
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-[#3370ff] shrink-0" />
                <span className="text-[14px] font-medium text-[#1f2329]">
                  发现新版本 v{state.info.version}
                </span>
              </div>
              {state.info.body && (
                <p className="mt-1 text-[12px] text-[#8f959e] line-clamp-2">
                  {state.info.body}
                </p>
              )}
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded hover:bg-[#f0f1f2] transition-colors shrink-0"
            >
              <X size={14} className="text-[#8f959e]" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={onDismiss}
              className="h-8 px-3 text-[13px] rounded-lg border border-[#dee0e3] text-[#646a73]
                hover:bg-[#f0f1f2] transition-colors"
            >
              稍后
            </button>
            <button
              onClick={onDownload}
              className="h-8 px-4 text-[13px] rounded-lg bg-[#3370ff] text-white font-medium
                hover:bg-[#2860e1] transition-colors flex items-center gap-1.5"
            >
              <Download size={14} />
              更新
            </button>
          </div>
        </div>
      )}

      {state.status === "downloading" && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={14} className="text-[#3370ff] animate-spin" />
            <span className="text-[13px] text-[#1f2329]">
              正在下载更新... {state.progress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#f0f1f2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3370ff] rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {state.status === "installing" && (
        <div className="px-4 py-3 flex items-center gap-2">
          <RefreshCw size={14} className="text-[#3370ff] animate-spin" />
          <span className="text-[13px] text-[#1f2329]">正在安装，即将重启...</span>
        </div>
      )}

      {state.status === "error" && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#f54a45]">
              更新失败：{state.message}
            </span>
            <button
              onClick={onDismiss}
              className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
            >
              <X size={14} className="text-[#8f959e]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
