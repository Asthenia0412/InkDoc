# API 设计文档

## Block 协议

```typescript
interface Block {
  id: string;          // 唯一标识: "{行号}:{内容哈希}"
  type: BlockType;     // heading | paragraph | list_item | code | blockquote | thematic_break | empty
  content: string;     // 文本内容
  metadata?: Record<string, any>; // 扩展字段
}
```

## Tauri Commands

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `read_folder` | `dirPath: string` | `FileNode[]` | 递归读取文件夹 |
| `read_and_parse_file` | `filePath: string` | `Block[]` | 读取并解析 Markdown |
| `write_file` | `WriteFileRequest` | `FileOperationResult` | 写入文件 |
| `create_file` | `filePath: string` | `FileOperationResult` | 创建文件 |
| `delete_item` | `itemPath: string` | `FileOperationResult` | 删除文件/文件夹 |
| `rename_item` | `oldPath, newPath` | `FileOperationResult` | 重命名 |
| `start_file_watcher` | `dirPath: string` | `string` | 启动文件监听 |

## 事件系统

| 事件名 | Payload | 说明 |
|--------|---------|------|
| `file-created` | `string` (path) | 文件创建 |
| `file-modified` | `string` (path) | 文件修改 |
| `file-deleted` | `string` (path) | 文件删除 |
