import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Search,
  X,
  LocateFixed,
} from "lucide-react";
import type { FileNode } from "@/types";
import { useEditorStore } from "@/stores/editor";
import {
  ContextMenu,
  type ContextMenuState,
  InlineInput,
  type InlineInputState,
} from "@/components/ContextMenu";

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
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

/** 递归过滤文件树 */
function filterTree(nodes: FileNode[], keyword: string): FileNode[] {
  if (!keyword) return nodes;
  const lower = keyword.toLowerCase();

  return nodes.reduce<FileNode[]>((acc, node) => {
    if (node.type === "file") {
      if (getDisplayName(node.name).toLowerCase().includes(lower)) {
        acc.push(node);
      }
    } else if (node.type === "folder") {
      const filteredChildren = filterTree(node.children, keyword);
      if (filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren, isExpanded: true });
      }
      if (node.name.toLowerCase().includes(lower) && filteredChildren.length === 0) {
        acc.push({ ...node, isExpanded: true });
      }
    }
    return acc;
  }, []);
}

/** 单个树节点 */
function TreeNode({ node, depth, onContextMenu }: TreeNodeProps) {
  const { openFile, toggleFolder, currentFilePath } = useEditorStore();
  const ref = useRef<HTMLButtonElement>(null);

  // 当前文件高亮时自动滚动到可见区域
  useEffect(() => {
    if (node.type === "file" && node.path === currentFilePath && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [node.path, node.type, currentFilePath]);

  const handleClick = useCallback(() => {
    if (node.type === "folder") {
      toggleFolder(node.path);
    } else if (isMarkdownFile(node)) {
      openFile(node.path);
    }
  }, [node, openFile, toggleFolder]);

  const isActive = node.type === "file" && node.path === currentFilePath;

  if (node.type === "file") {
    return (
      <button
        ref={ref}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
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

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
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
            <TreeNode key={child.path} node={child} depth={depth + 1} onContextMenu={onContextMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 侧边栏文件树 */
export function Sidebar() {
  const { fileTree, rootPath, openFolder, sidebarVisible, currentFilePath, revealCurrentFile } = useEditorStore();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);

  // 监听内联输入事件（来自 ContextMenu 的 CustomEvent）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setInlineInput(detail);
    };
    window.addEventListener("sidebar:inline-input", handler);
    return () => window.removeEventListener("sidebar:inline-input", handler);
  }, []);

  const displayTree = useMemo(() => {
    if (!searchKeyword.trim()) return fileTree;
    return filterTree(fileTree, searchKeyword.trim());
  }, [fileTree, searchKeyword]);

  const matchCount = useMemo(() => {
    if (!searchKeyword.trim()) return 0;
    const countFiles = (nodes: FileNode[]): number => {
      return nodes.reduce((sum, n) => {
        if (n.type === "file") return sum + 1;
        return sum + countFiles(n.children);
      }, 0);
    };
    return countFiles(displayTree);
  }, [searchKeyword, displayTree]);

  /** 右键菜单处理 */
  const handleContextMenu = useCallback((e: React.MouseEvent, node?: FileNode) => {
    e.preventDefault();
    e.stopPropagation();

    let containerPath: string | null = null;
    let targetNode: FileNode | null = null;

    if (node) {
      targetNode = node;
      containerPath = node.type === "folder" ? node.path : node.path.substring(0, node.path.lastIndexOf("/"));
    } else {
      // 右键空白区域
      containerPath = rootPath;
    }

    setContextMenu({ x: e.clientX, y: e.clientY, targetNode, containerPath });
  }, [rootPath]);

  /** 关闭右键菜单 */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /** 内联输入完成后关闭 */
  const closeInlineInput = useCallback(() => {
    setInlineInput(null);
  }, []);

  if (!sidebarVisible) return null;

  return (
    <aside className="w-sidebar h-full bg-feishu-sidebar border-r border-feishu-border flex flex-col shrink-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-feishu-border">
        <span className="text-xs font-medium text-feishu-text-secondary uppercase tracking-wider">
          {rootPath ? rootPath.split("/").pop() : "文件"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={revealCurrentFile}
            disabled={!currentFilePath}
            className="p-1 rounded hover:bg-feishu-hover transition-colors disabled:opacity-30"
            title="定位当前文件"
          >
            <LocateFixed size={16} className="text-feishu-text-secondary" />
          </button>
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
      </div>

      {/* 搜索框 */}
      {rootPath && (
        <div className="px-2 py-1.5 border-b border-feishu-border">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-feishu-text-placeholder pointer-events-none"
            />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索文件..."
              className="w-full h-7 pl-7 pr-7 text-[13px] rounded-md
                bg-[#f5f6f7] border border-transparent
                text-feishu-text placeholder:text-feishu-text-placeholder
                focus:outline-none focus:border-[#3370ff] focus:bg-white
                transition-colors duration-150"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded
                  hover:bg-[#e8e9eb] transition-colors"
              >
                <X size={12} className="text-feishu-text-placeholder" />
              </button>
            )}
          </div>
          {searchKeyword.trim() && (
            <div className="mt-1 px-1 text-[11px] text-feishu-text-placeholder">
              找到 {matchCount} 个文件
            </div>
          )}
        </div>
      )}

      {/* 文件树 */}
      <div
        className="flex-1 overflow-y-auto py-1"
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {!rootPath ? (
          <div className="flex flex-col items-center justify-center h-full text-feishu-text-placeholder text-sm px-4 text-center">
            <Folder size={32} className="mb-2 opacity-40" />
            <p>点击上方按钮</p>
            <p>打开一个文件夹</p>
          </div>
        ) : displayTree.length === 0 && searchKeyword.trim() ? (
          <div className="flex flex-col items-center justify-center h-full text-feishu-text-placeholder text-sm px-4 text-center">
            <Search size={24} className="mb-2 opacity-30" />
            <p>没有匹配的文件</p>
          </div>
        ) : displayTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-feishu-text-placeholder text-sm px-4 text-center">
            <Folder size={32} className="mb-2 opacity-40" />
            <p>文件夹为空</p>
          </div>
        ) : (
          <>
            {/* 内联输入（插入到文件树顶部或对应位置） */}
            {inlineInput && (
              <InlineInput
                state={inlineInput}
                onCancel={closeInlineInput}
                depth={0}
              />
            )}
            {displayTree.map((node) => (
              <TreeNode key={node.path} node={node} depth={0} onContextMenu={handleContextMenu} />
            ))}
          </>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu state={contextMenu} onClose={closeContextMenu} />
      )}
    </aside>
  );
}
