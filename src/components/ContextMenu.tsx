import { useEffect, useRef, useState, useCallback } from "react";
import {
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
} from "lucide-react";
import type { FileNode } from "@/types";
import { useEditorStore } from "@/stores/editor";

/* ============================================
   右键菜单
   ============================================ */

export interface ContextMenuState {
  x: number;
  y: number;
  targetNode: FileNode | null;
  /** 如果右键的是文件夹，此值为文件夹路径；如果右键的是文件，此值为其父文件夹路径；如果是空白区域，此值为 rootPath */
  containerPath: string | null;
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
}

export function ContextMenu({ state, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { deleteFileItem } = useEditorStore();

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟绑定，避免右键事件本身触发关闭
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // 计算菜单位置，防止超出视口
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${state.x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${state.y - rect.height}px`;
    }
  }, [state.x, state.y]);

  const handleNewFile = useCallback(async () => {
    if (!state.containerPath) return;
    onClose();
    // 触发自定义事件，让 Sidebar 显示内联输入
    window.dispatchEvent(new CustomEvent("sidebar:inline-input", {
      detail: { type: "file", parentPath: state.containerPath },
    }));
  }, [state.containerPath, onClose]);

  const handleNewFolder = useCallback(async () => {
    if (!state.containerPath) return;
    onClose();
    window.dispatchEvent(new CustomEvent("sidebar:inline-input", {
      detail: { type: "folder", parentPath: state.containerPath },
    }));
  }, [state.containerPath, onClose]);

  const handleRename = useCallback(() => {
    if (!state.targetNode) return;
    onClose();
    window.dispatchEvent(new CustomEvent("sidebar:inline-input", {
      detail: { type: "rename", node: state.targetNode },
    }));
  }, [state.targetNode, onClose]);

  const handleDelete = useCallback(async () => {
    if (!state.targetNode) return;
    onClose();
    await deleteFileItem(state.targetNode.path);
  }, [state.targetNode, onClose, deleteFileItem]);

  if (!state.containerPath) return null;

  const isFolder = state.targetNode?.type === "folder";
  const isFile = state.targetNode?.type === "file";

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-lg border border-[#dee0e3] bg-white"
      style={{ left: state.x, top: state.y }}
    >
      {/* 新建文件 */}
      <button
        onClick={handleNewFile}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#1f2329]
          hover:bg-[#f0f5ff] transition-colors cursor-pointer"
      >
        <FilePlus size={14} className="text-[#3370ff]" />
        <span>新建文件</span>
      </button>

      {/* 新建文件夹 */}
      <button
        onClick={handleNewFolder}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#1f2329]
          hover:bg-[#f0f5ff] transition-colors cursor-pointer"
      >
        <FolderPlus size={14} className="text-[#3370ff]" />
        <span>新建文件夹</span>
      </button>

      {/* 分隔线 — 仅对文件/文件夹显示 */}
      {(isFile || isFolder) && (
        <div className="my-1 border-t border-[#dee0e3]" />
      )}

      {/* 重命名 — 仅对文件/文件夹显示 */}
      {(isFile || isFolder) && (
        <button
          onClick={handleRename}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#1f2329]
            hover:bg-[#f0f5ff] transition-colors cursor-pointer"
        >
          <Pencil size={14} className="text-[#8f959e]" />
          <span>重命名</span>
        </button>
      )}

      {/* 删除 — 仅对文件/文件夹显示 */}
      {(isFile || isFolder) && (
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#f54a45]
            hover:bg-[#fff0f0] transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          <span>删除</span>
        </button>
      )}
    </div>
  );
}

/* ============================================
   内联输入组件（新建文件/文件夹 + 重命名）
   ============================================ */

export interface InlineInputState {
  type: "file" | "folder" | "rename";
  parentPath?: string;
  node?: FileNode;
}

interface InlineInputProps {
  state: InlineInputState;
  onCancel: () => void;
  depth: number;
}

export function InlineInput({ state, onCancel, depth }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { createNewFile, createNewFolder, renameFileItem } = useEditorStore();
  const [value, setValue] = useState(() => {
    if (state.type === "rename" && state.node) {
      // 重命名时显示当前名称
      return state.node.name;
    }
    return state.type === "file" ? "untitled.md" : "新建文件夹";
  });

  // 自动聚焦并选中（只在挂载时执行一次）
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    if (state.type === "rename") {
      const dotIndex = value.lastIndexOf(".");
      inputRef.current.setSelectionRange(0, dotIndex > 0 ? dotIndex : value.length);
    } else {
      inputRef.current.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }

    if (state.type === "file" && state.parentPath) {
      // 确保有 .md 扩展名
      const fileName = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
      await createNewFile(state.parentPath, fileName);
    } else if (state.type === "folder" && state.parentPath) {
      await createNewFolder(state.parentPath, trimmed);
    } else if (state.type === "rename" && state.node) {
      await renameFileItem(state.node.path, trimmed);
    }
    onCancel();
  }, [value, state, createNewFile, createNewFolder, renameFileItem, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  return (
    <div
      className="w-full flex items-center gap-1.5 py-0.5 text-sm"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {state.type === "folder" ? (
        <FolderIcon size={14} className="shrink-0 text-[#3370ff]" />
      ) : (
        <FilePlus size={14} className="shrink-0 text-[#3370ff]" />
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        className="flex-1 min-w-[120px] h-6 px-1.5 text-[13px] rounded
          border border-[#3370ff] bg-white text-[#1f2329]
          font-sans
          focus:outline-none focus:ring-1 focus:ring-[#3370ff]/30"
      />
    </div>
  );
}

/** 简单的文件夹图标占位 */
function FolderIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
    </svg>
  );
}
