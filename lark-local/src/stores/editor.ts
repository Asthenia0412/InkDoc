import { create } from "zustand";
import type { FileNode } from "@/types";
import { readFolder, readFileRaw, writeFile, startFileWatcher, onFileChange } from "@/lib/tauri-api";

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

  // Actions
  openFolder: (path: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  toggleFolder: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleSidebar: () => void;
  updateMarkdown: (content: string) => void;
  saveCurrentFile: () => Promise<void>;
  setError: (error: string | null) => void;
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
              const newTree = await readFolder(currentRoot);
              set({ fileTree: newTree });
            } catch {
              // 静默失败
            }
          }

          // 如果当前打开的文件被修改，重新加载
          const { currentFilePath } = get();
          if (currentFilePath && event.path === currentFilePath && event.kind === "modified") {
            get().openFile(currentFilePath);
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

  saveCurrentFile: async () => {
    const { currentFilePath, markdownContent } = get();
    if (!currentFilePath) return;
    try {
      await writeFile({ path: currentFilePath, content: markdownContent });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
