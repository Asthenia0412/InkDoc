// 与 Rust 后端对齐的类型定义

/** 文件树节点 */
export type FileNode =
  | {
      type: "file";
      name: string;
      path: string;
      ext?: string;
    }
  | {
      type: "folder";
      name: string;
      path: string;
      children: FileNode[];
      isExpanded: boolean;
    };

/** Markdown Block（核心协议） */
export type Block =
  | { type: "heading"; id: string; content: string; level: number }
  | { type: "paragraph"; id: string; content: string }
  | { type: "list_item"; id: string; content: string; ordered: boolean; index?: number }
  | { type: "code"; id: string; content: string; language?: string }
  | { type: "blockquote"; id: string; content: string }
  | { type: "thematic_break"; id: string }
  | { type: "empty"; id: string };

/** 文件操作结果 */
export interface FileOperationResult {
  success: boolean;
  message: string;
}

/** 写入文件请求 */
export interface WriteFileRequest {
  path: string;
  content: string;
}

/** 判断是否为文件节点 */
export function isFileNode(node: FileNode): node is FileNode & { type: "file" } {
  return node.type === "file";
}

/** 判断是否为文件夹节点 */
export function isFolderNode(node: FileNode): node is FileNode & { type: "folder" } {
  return node.type === "folder";
}

/** 获取 Block 的 ID */
export function getBlockId(block: Block): string {
  return block.id;
}
