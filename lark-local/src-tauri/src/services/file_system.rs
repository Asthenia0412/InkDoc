use std::fs;
use std::path::Path;

use crate::types::FileNode;

/// 递归读取文件夹，生成文件树
pub fn read_directory(dir_path: &str, max_depth: usize) -> Result<Vec<FileNode>, String> {
    let path = Path::new(dir_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    read_dir_recursive(path, max_depth)
}

fn read_dir_recursive(dir: &Path, max_depth: usize) -> Result<Vec<FileNode>, String> {
    if max_depth == 0 {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut nodes: Vec<FileNode> = Vec::new();

    let mut entries: Vec<_> = entries
        .filter_map(|e| e.ok())
        .collect();

    // 排序：文件夹在前，文件在后，各自按名称排序
    entries.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in entries {
        let path = entry.path();

        // 跳过隐藏文件和 .git 目录
        if let Some(name) = path.file_name() {
            let name_str = name.to_string_lossy();
            if name_str.starts_with('.') {
                continue;
            }
        }

        if path.is_dir() {
            let children = read_dir_recursive(&path, max_depth - 1)?;
            nodes.push(FileNode::Folder {
                name: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                children,
                is_expanded: false,
            });
        } else if path.is_file() {
            let extension = path
                .extension()
                .map(|e| e.to_string_lossy().to_string().to_lowercase());

            nodes.push(FileNode::File {
                name: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                extension,
            });
        }
    }

    Ok(nodes)
}

/// 读取文件内容
pub fn read_file_content(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    fs::read_to_string(path).map_err(|e| format!("Failed to read file {}: {}", file_path, e))
}

/// 写入文件内容
pub fn write_file_content(file_path: &str, content: &str) -> Result<(), String> {
    let path = Path::new(file_path);

    // 确保父目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    fs::write(path, content).map_err(|e| format!("Failed to write file {}: {}", file_path, e))
}

/// 创建新文件
pub fn create_file(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }
    fs::write(path, "").map_err(|e| format!("Failed to create file {}: {}", file_path, e))
}

/// 创建新文件夹
pub fn create_folder(folder_path: &str) -> Result<(), String> {
    fs::create_dir_all(folder_path)
        .map_err(|e| format!("Failed to create folder {}: {}", folder_path, e))
}

/// 删除文件或文件夹（移至系统垃圾桶）
pub fn delete_item(item_path: &str) -> Result<(), String> {
    let path = Path::new(item_path);
    if path.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to delete folder {}: {}", item_path, e))
    } else {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to delete file {}: {}", item_path, e))
    }
}

/// 重命名文件或文件夹
pub fn rename_item(old_path: &str, new_path: &str) -> Result<(), String> {
    fs::rename(old_path, new_path)
        .map_err(|e| format!("Failed to rename {} to {}: {}", old_path, new_path, e))
}
