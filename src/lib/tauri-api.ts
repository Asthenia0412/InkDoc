import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileNode, Block, FileOperationResult, WriteFileRequest } from "@/types";

/** 读取文件夹树 */
export async function readFolder(dirPath: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("read_folder", { dirPath });
}

/** 读取文件并解析为 Block 列表 */
export async function readAndParseFile(filePath: string): Promise<Block[]> {
  return invoke<Block[]>("read_and_parse_file", { filePath });
}

/** 读取文件原始内容 */
export async function readFileRaw(filePath: string): Promise<string> {
  return invoke<string>("read_file_raw", { filePath });
}

/** 写入文件 */
export async function writeFile(request: WriteFileRequest): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("write_file", { request });
}

/** 创建新文件 */
export async function createFile(filePath: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("create_file", { filePath });
}

/** 创建新文件夹 */
export async function createFolder(folderPath: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("create_folder", { folderPath });
}

/** 删除文件或文件夹 */
export async function deleteItem(itemPath: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("delete_item", { itemPath });
}

/** 重命名文件或文件夹 */
export async function renameItem(oldPath: string, newPath: string): Promise<FileOperationResult> {
  return invoke<FileOperationResult>("rename_item", { oldPath, newPath });
}

/** 启动文件监听 */
export async function startFileWatcher(dirPath: string): Promise<string> {
  return invoke<string>("start_file_watcher", { dirPath });
}

/** 检测目录是否是 Git 仓库 */
export async function checkGitRepo(dirPath: string): Promise<boolean> {
  return invoke<boolean>("check_git_repo", { dirPath });
}

/** 获取 Git 仓库信息 */
export async function getGitInfo(dirPath: string): Promise<{
  isGitRepo: boolean;
  branch: string;
  remoteUrl: string;
}> {
  return invoke("get_git_info", { dirPath });
}

/** 执行自动 commit + push */
export async function gitAutoPush(dirPath: string, commitMessage: string): Promise<string> {
  return invoke<string>("git_auto_push", { dirPath, commitMessage });
}

/** 读取图片文件为 base64 data URL */
export async function readImageAsDataUrl(filePath: string): Promise<string> {
  return invoke<string>("read_image_as_data_url", { filePath });
}

/** 监听文件变更事件 */
export async function onFileChange(
  callback: (event: { path: string; kind: string }) => void,
): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(
    await listen<string>("file-created", (e) => callback({ path: e.payload, kind: "created" })),
  );
  unlisteners.push(
    await listen<string>("file-modified", (e) => callback({ path: e.payload, kind: "modified" })),
  );
  unlisteners.push(
    await listen<string>("file-deleted", (e) => callback({ path: e.payload, kind: "deleted" })),
  );

  return unlisteners;
}
