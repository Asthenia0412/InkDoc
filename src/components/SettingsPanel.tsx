import { useState, useEffect, useCallback } from "react";
import { X, GitBranch, Clock, MessageSquare, RefreshCw, Check, AlertCircle } from "lucide-react";
import { checkGitRepo, getGitInfo, gitAutoPush } from "@/lib/tauri-api";

interface SettingsPanelProps {
  rootPath: string | null;
  onClose: () => void;
}

interface GitInfo {
  isGitRepo: boolean;
  branch: string;
  remoteUrl: string;
}

const STORAGE_KEY_AUTO_PUSH = "inkdoc:auto-push";
const STORAGE_KEY_PUSH_INTERVAL = "inkdoc:push-interval";
const STORAGE_KEY_COMMIT_MSG = "inkdoc:commit-message";

const INTERVAL_OPTIONS = [
  { label: "5 分钟", value: 5 },
  { label: "15 分钟", value: 15 },
  { label: "30 分钟", value: 30 },
  { label: "1 小时", value: 60 },
  { label: "2 小时", value: 120 },
];

export function SettingsPanel({ rootPath, onClose }: SettingsPanelProps) {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoPushEnabled, setAutoPushEnabled] = useState(() =>
    localStorage.getItem(STORAGE_KEY_AUTO_PUSH) === "true"
  );
  const [pushInterval, setPushInterval] = useState(() =>
    Number(localStorage.getItem(STORAGE_KEY_PUSH_INTERVAL)) || 60
  );
  const [commitMessage, setCommitMessage] = useState(() =>
    localStorage.getItem(STORAGE_KEY_COMMIT_MSG) || "docs: auto sync"
  );
  const [pushResult, setPushResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pushing, setPushing] = useState(false);

  // 检测 Git 状态
  useEffect(() => {
    if (!rootPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    checkGitRepo(rootPath).then((isRepo) => {
      if (isRepo) {
        getGitInfo(rootPath).then(setGitInfo).catch(() => setGitInfo(null));
      } else {
        setGitInfo(null);
      }
      setLoading(false);
    }).catch(() => {
      setGitInfo(null);
      setLoading(false);
    });
  }, [rootPath]);

  // 保存设置到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_AUTO_PUSH, String(autoPushEnabled));
  }, [autoPushEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PUSH_INTERVAL, String(pushInterval));
  }, [pushInterval]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COMMIT_MSG, commitMessage);
  }, [commitMessage]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleManualPush = useCallback(async () => {
    if (!rootPath) return;
    setPushing(true);
    setPushResult(null);
    try {
      const result = await gitAutoPush(rootPath, commitMessage);
      setPushResult({ type: "success", message: result });
    } catch (e) {
      setPushResult({ type: "error", message: String(e) });
    } finally {
      setPushing(false);
      setTimeout(() => setPushResult(null), 4000);
    }
  }, [rootPath, commitMessage]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* 面板 */}
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#dee0e3] w-[420px] max-h-[80vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#dee0e3]">
          <h2 className="text-[15px] font-semibold text-[#1f2329]">设置</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f0f1f2] transition-colors"
          >
            <X size={16} className="text-[#8f959e]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Git 状态 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={15} className="text-[#3370ff]" />
              <span className="text-[13px] font-medium text-[#1f2329]">Git 同步</span>
            </div>

            {loading ? (
              <div className="text-[13px] text-[#8f959e]">检测中...</div>
            ) : !rootPath ? (
              <div className="text-[13px] text-[#8f959e]">请先打开一个文件夹</div>
            ) : !gitInfo?.isGitRepo ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#fff8f0] border border-[#ffe4c4]">
                <AlertCircle size={14} className="text-[#ff8800] mt-0.5 shrink-0" />
                <div className="text-[12px] text-[#646a73]">
                  当前文件夹不是 Git 仓库。如需自动同步，请先执行：
                  <code className="block mt-1 px-2 py-1 bg-[#f5f6f7] rounded text-[11px] text-[#1f2329]">
                    cd {rootPath.split("/").pop()} && git init
                  </code>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 仓库信息 */}
                <div className="p-3 rounded-lg bg-[#f5f6f7] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <GitBranch size={12} className="text-[#8f959e]" />
                    <span className="text-[12px] text-[#8f959e]">分支</span>
                    <span className="text-[12px] text-[#1f2329] font-medium">{gitInfo.branch}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#8f959e] ml-[14px]">远程</span>
                    <span className="text-[12px] text-[#3370ff] truncate">{gitInfo.remoteUrl}</span>
                  </div>
                </div>

                {/* 自动推送开关 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#8f959e]" />
                    <span className="text-[13px] text-[#1f2329]">定时自动推送</span>
                  </div>
                  <button
                    onClick={() => setAutoPushEnabled(!autoPushEnabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      autoPushEnabled ? "bg-[#3370ff]" : "bg-[#c0c4cc]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        autoPushEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* 推送间隔 */}
                {autoPushEnabled && (
                  <div className="flex items-center justify-between pl-6">
                    <span className="text-[12px] text-[#8f959e]">推送间隔</span>
                    <select
                      value={pushInterval}
                      onChange={(e) => setPushInterval(Number(e.target.value))}
                      className="h-7 px-2 text-[12px] rounded border border-[#dee0e3] bg-white text-[#1f2329]
                        focus:outline-none focus:border-[#3370ff]"
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Commit message */}
                <div className="pl-6 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={12} className="text-[#8f959e]" />
                    <span className="text-[12px] text-[#8f959e]">Commit message</span>
                  </div>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full h-8 px-2.5 text-[12px] rounded border border-[#dee0e3] bg-white text-[#1f2329]
                      focus:outline-none focus:border-[#3370ff] placeholder:text-[#c0c4cc]"
                    placeholder="docs: auto sync"
                  />
                </div>

                {/* 手动推送按钮 */}
                <button
                  onClick={handleManualPush}
                  disabled={pushing}
                  className="w-full flex items-center justify-center gap-2 h-8 rounded-lg text-[13px] font-medium
                    bg-[#3370ff] text-white hover:bg-[#2860e1] disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors"
                >
                  {pushing ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <GitBranch size={14} />
                  )}
                  {pushing ? "推送中..." : "立即推送"}
                </button>

                {/* 推送结果 */}
                {pushResult && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${
                      pushResult.type === "success"
                        ? "bg-[#e8f5e9] text-[#2da44e]"
                        : "bg-[#fff0f0] text-[#f54a45]"
                    }`}
                  >
                    {pushResult.type === "success" ? (
                      <Check size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    {pushResult.message}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** 导出设置读取函数，供 App.tsx 定时器使用 */
export function getAutoPushSettings(): {
  enabled: boolean;
  intervalMinutes: number;
  commitMessage: string;
} {
  return {
    enabled: localStorage.getItem(STORAGE_KEY_AUTO_PUSH) === "true",
    intervalMinutes: Number(localStorage.getItem(STORAGE_KEY_PUSH_INTERVAL)) || 60,
    commitMessage: localStorage.getItem(STORAGE_KEY_COMMIT_MSG) || "docs: auto sync",
  };
}
