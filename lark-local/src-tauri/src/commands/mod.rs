use tauri::{AppHandle, Emitter};
use std::path::PathBuf;

use crate::types::{Block, FileNode, FileOperationResult, WriteFileRequest};
use crate::services::{file_system, markdown};

/// 读取文件夹树
#[tauri::command]
pub fn read_folder(dir_path: String) -> Result<Vec<FileNode>, String> {
    file_system::read_directory(&dir_path, 10)
}

/// 读取文件内容并解析为 Block 列表
#[tauri::command]
pub fn read_and_parse_file(file_path: String) -> Result<Vec<Block>, String> {
    let content = file_system::read_file_content(&file_path)?;
    let blocks = markdown::parse_markdown(&content);
    Ok(blocks)
}

/// 读取文件原始内容
#[tauri::command]
pub fn read_file_raw(file_path: String) -> Result<String, String> {
    file_system::read_file_content(&file_path)
}

/// 写入文件
#[tauri::command]
pub fn write_file(request: WriteFileRequest) -> Result<FileOperationResult, String> {
    match file_system::write_file_content(&request.path, &request.content) {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            message: "File saved successfully".to_string(),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: e,
        }),
    }
}

/// 创建新文件
#[tauri::command]
pub fn create_file(file_path: String) -> Result<FileOperationResult, String> {
    match file_system::create_file(&file_path) {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            message: format!("Created: {}", file_path),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: e,
        }),
    }
}

/// 创建新文件夹
#[tauri::command]
pub fn create_folder(folder_path: String) -> Result<FileOperationResult, String> {
    match file_system::create_folder(&folder_path) {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            message: format!("Created folder: {}", folder_path),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: e,
        }),
    }
}

/// 删除文件或文件夹
#[tauri::command]
pub fn delete_item(item_path: String) -> Result<FileOperationResult, String> {
    match file_system::delete_item(&item_path) {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            message: format!("Deleted: {}", item_path),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: e,
        }),
    }
}

/// 重命名文件或文件夹
#[tauri::command]
pub fn rename_item(old_path: String, new_path: String) -> Result<FileOperationResult, String> {
    match file_system::rename_item(&old_path, &new_path) {
        Ok(_) => Ok(FileOperationResult {
            success: true,
            message: "Renamed successfully".to_string(),
        }),
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: e,
        }),
    }
}

/// 启动文件监听
#[tauri::command]
pub fn start_file_watcher(app: AppHandle, dir_path: String) -> Result<String, String> {
    use notify::{Watcher, RecursiveMode, EventKind};

    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&path, RecursiveMode::Recursive) {
            eprintln!("Failed to watch directory: {}", e);
            return;
        }

        // 防抖：收集 300ms 内的所有事件，只发送最后一次
        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    let event_path = event.paths.first()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    // 过滤隐藏文件
                    if event_path.contains("/.") {
                        continue;
                    }

                    match event.kind {
                        EventKind::Create(_) => {
                            let _ = app.emit("file-created", &event_path);
                        }
                        EventKind::Modify(_) => {
                            let _ = app.emit("file-modified", &event_path);
                        }
                        EventKind::Remove(_) => {
                            let _ = app.emit("file-deleted", &event_path);
                        }
                        _ => {}
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Watch error: {}", e);
                }
                Err(_) => {
                    // Channel closed
                    break;
                }
            }
        }
    });

    Ok(format!("Watching: {}", dir_path))
}
