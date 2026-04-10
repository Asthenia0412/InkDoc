import { create } from "zustand";
import type { FileNode } from "@/types";
import {
  readFolder, readFileRaw, writeFile, startFileWatcher, onFileChange,
  createFile, createFolder, deleteItem, renameItem,
} from "@/lib/tauri-api";

interface EditorState {
  /** 根文件夹路径 */
  rootPath: string | null;
  /** 文件树 */
  fileTree: FileNode[];
  /** 当前打开的文件路径 */
  currentFilePath: string | null;
  /** 当前文件的原始 Markdown 文本 */
  markdownContent: string;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 侧边栏是否可见 */
  sidebarVisible: boolean;
  /** 是否正在保存（防止文件监听器重复加载） */
  _saving: boolean;

  // Actions
  openFolder: (path: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  toggleFolder: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleSidebar: () => void;
  updateMarkdown: (content: string) => void;
  saveCurrentFile: () => Promise<void>;
  setError: (error: string | null) => void;

  // 文件操作
  createNewFile: (parentPath: string, name: string) => Promise<void>;
  createNewFolder: (parentPath: string, name: string) => Promise<void>;
  deleteFileItem: (path: string) => Promise<void>;
  renameFileItem: (oldPath: string, newName: string) => Promise<void>;
  ensureFolderExpanded: (folderPath: string) => void;
  revealCurrentFile: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  rootPath: null,
  fileTree: [],
  currentFilePath: null,
  markdownContent: "",
  loading: false,
  error: null,
  sidebarVisible: true,

  openFolder: async (path: string) => {
    set({ loading: true, error: null });
    try {
      const tree = await readFolder(path);
      set({ rootPath: path, fileTree: tree, loading: false });

      // 启动文件监听
      startFileWatcher(path).then(() => {
        onFileChange(async (event) => {
          const { rootPath: currentRoot } = get();
          if (currentRoot) {
            try {
              // 只在文件结构变化时刷新树（新建/删除/重命名），内容修改不刷新
              if (event.kind !== "modified") {
                const newTree = await readFolder(currentRoot);
                set({ fileTree: newTree });
              }
            } catch {
              // 静默失败
            }
          }

          // 如果当前打开的文件被删除，关闭编辑器
          const { currentFilePath } = get();
          if (currentFilePath && event.path === currentFilePath && event.kind === "deleted") {
            set({ currentFilePath: null, markdownContent: "" });
          }
          // 如果当前打开的文件被外部修改，重新加载（但跳过自身保存触发的修改）
          if (currentFilePath && event.path === currentFilePath && event.kind === "modified") {
            if (!get()._saving) {
              get().openFile(currentFilePath);
            }
          }
        });
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  openFile: async (path: string) => {
    set({ loading: true, error: null });
    try {
      const content = await readFileRaw(path);
      set({
        currentFilePath: path,
        markdownContent: content,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  toggleFolder: async (path: string) => {
    const toggleInTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.type === "folder" && node.path === path) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.type === "folder") {
          return { ...node, children: toggleInTree(node.children) };
        }
        return node;
      });
    };

    set({ fileTree: toggleInTree(get().fileTree) });
  },

  refreshTree: async () => {
    const { rootPath } = get();
    if (rootPath) {
      try {
        const tree = await readFolder(rootPath);
        set({ fileTree: tree });
      } catch {
        // 静默失败
      }
    }
  },

  toggleSidebar: () => {
    set({ sidebarVisible: !get().sidebarVisible });
  },

  updateMarkdown: (content: string) => set({ markdownContent: content }),

  // === 文件操作 ===

  /** 是否正在保存（用于防止文件监听器重复加载） */
  _saving: false,

  saveCurrentFile: async () => {
    const { currentFilePath, markdownContent } = get();
    if (!currentFilePath) return;
    try {
      set({ _saving: true });
      await writeFile({ path: currentFilePath, content: markdownContent });
      // 延迟重置，确保文件监听器的事件已经过去
      setTimeout(() => set({ _saving: false }), 500);
    } catch (e) {
      set({ error: String(e), _saving: false });
    }
  },

  setError: (error: string | null) => set({ error }),

  // === 文件操作 ===

  createNewFile: async (parentPath: string, name: string) => {
    const filePath = `${parentPath}/${name}`;
    const result = await createFile(filePath);
    if (!result.success) {
      set({ error: result.message });
      return;
    }
    // 确保父文件夹展开
    get().ensureFolderExpanded(parentPath);
    await get().refreshTree();
    // 自动打开新文件
    await get().openFile(filePath);
  },

  createNewFolder: async (parentPath: string, name: string) => {
    const folderPath = `${parentPath}/${name}`;
    const result = await createFolder(folderPath);
    if (!result.success) {
      set({ error: result.message });
      return;
    }
    get().ensureFolderExpanded(parentPath);
    await get().refreshTree();
  },

  deleteFileItem: async (path: string) => {
    const result = await deleteItem(path);
    if (!result.success) {
      set({ error: result.message });
      return;
    }
    // 如果删除的是当前打开的文件，关闭编辑器
    const { currentFilePath } = get();
    if (currentFilePath === path) {
      set({ currentFilePath: null, markdownContent: "" });
    }
    await get().refreshTree();
  },

  renameFileItem: async (oldPath: string, newName: string) => {
    const lastSlash = oldPath.lastIndexOf("/");
    const parentPath = oldPath.substring(0, lastSlash);
    const newPath = `${parentPath}/${newName}`;
    const result = await renameItem(oldPath, newPath);
    if (!result.success) {
      set({ error: result.message });
      return;
    }
    // 如果重命名的是当前打开的文件，更新路径
    const { currentFilePath } = get();
    if (currentFilePath === oldPath) {
      set({ currentFilePath: newPath });
    }
    await get().refreshTree();
  },

  /** 确保指定文件夹在树中展开 */
  ensureFolderExpanded: (folderPath: string) => {
    const expandInTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.type === "folder") {
          const shouldExpand = node.path === folderPath ||
            node.path.startsWith(folderPath + "/");
          return {
            ...node,
            isExpanded: shouldExpand || node.isExpanded,
            children: expandInTree(node.children),
          };
        }
        return node;
      });
    };
    set({ fileTree: expandInTree(get().fileTree) });
  },

  /** 展开文件树并定位到当前打开的文件 */
  revealCurrentFile: () => {
    const { currentFilePath } = get();
    if (!currentFilePath) return;

    // 提取文件路径上的所有父文件夹路径
    const parts = currentFilePath.split("/");
    const folderPaths: string[] = [];
    for (let i = 1; i < parts.length - 1; i++) {
      folderPaths.push(parts.slice(0, i + 1).join("/"));
    }

    // 展开所有父文件夹
    const expandInTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.type === "folder") {
          const shouldExpand = folderPaths.includes(node.path);
          return {
            ...node,
            isExpanded: shouldExpand || node.isExpanded,
            children: expandInTree(node.children),
          };
        }
        return node;
      });
    };
    set({ fileTree: expandInTree(get().fileTree) });
  },
}));
