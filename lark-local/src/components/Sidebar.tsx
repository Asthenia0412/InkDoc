import React, { useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { FileNode } from "@/types";
import { useEditorStore } from "@/stores/editor";

interface TreeNodeProps {
  node: FileNode;
  depth: number;
}

/** 文件名去掉扩展名 */
function getDisplayName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex > 0) {
    return name.substring(0, dotIndex);
  }
  return name;
}

/** 判断是否为 Markdown 文件 */
function isMarkdownFile(node: FileNode): boolean {
  if (node.type !== "file") return false;
  const ext = node.ext?.toLowerCase();
  return ext === "md" || ext === "markdown" || ext === "mdx";
}

/** 单个树节点 */
function TreeNode({ node, depth }: TreeNodeProps) {
  const { openFile, toggleFolder, currentFilePath } = useEditorStore();

  const handleClick = useCallback(() => {
    if (node.type === "folder") {
      toggleFolder(node.path);
    } else if (isMarkdownFile(node)) {
      openFile(node.path);
    }
  }, [node, openFile, toggleFolder]);

  const isActive =
    node.type === "file" && node.path === currentFilePath;

  if (node.type === "file") {
    return (
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md
          transition-colors duration-150 cursor-pointer
          ${isActive
            ? "bg-feishu-active text-feishu-accent font-medium"
            : "text-feishu-text hover:bg-feishu-hover"
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.path}
      >
        <FileText size={14} className="shrink-0 text-feishu-text-secondary" />
        <span className="truncate">{getDisplayName(node.name)}</span>
      </button>
    );
  }

  // Folder
  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md
          transition-colors duration-150 cursor-pointer
          text-feishu-text hover:bg-feishu-hover font-medium"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.path}
      >
        {node.isExpanded ? (
          <ChevronDown size={14} className="shrink-0 text-feishu-text-secondary" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-feishu-text-secondary" />
        )}
        {node.isExpanded ? (
          <FolderOpen size={14} className="shrink-0 text-feishu-accent" />
        ) : (
          <Folder size={14} className="shrink-0 text-feishu-text-secondary" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 侧边栏文件树 */
export function Sidebar() {
  const { fileTree, rootPath, openFolder, sidebarVisible } = useEditorStore();

  if (!sidebarVisible) return null;

  return (
    <aside className="w-sidebar h-full bg-feishu-sidebar border-r border-feishu-border flex flex-col shrink-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-feishu-border">
        <span className="text-xs font-medium text-feishu-text-secondary uppercase tracking-wider">
          {rootPath ? rootPath.split("/").pop() : "文件"}
        </span>
        <button
          onClick={async () => {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({ directory: true, multiple: false });
            if (selected) {
              openFolder(selected as string);
            }
          }}
          className="p-1 rounded hover:bg-feishu-hover transition-colors"
          title="打开文件夹"
        >
          <FolderOpen size={16} className="text-feishu-text-secondary" />
        </button>
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-feishu-text-placeholder text-sm px-4 text-center">
            <Folder size={32} className="mb-2 opacity-40" />
            <p>点击上方按钮</p>
            <p>打开一个文件夹</p>
          </div>
        ) : (
          fileTree.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} />
          ))
        )}
      </div>
    </aside>
  );
}
