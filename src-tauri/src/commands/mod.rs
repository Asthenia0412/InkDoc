use tauri::{AppHandle, Emitter};
use std::path::PathBuf;

use crate::types::{Block, FileNode, FileOperationResult, WriteFileRequest};
use crate::services::{file_system, markdown, git};

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

/// 检测目录是否是 Git 仓库
#[tauri::command]
pub fn check_git_repo(dir_path: String) -> Result<bool, String> {
    Ok(git::is_git_repo(&dir_path))
}

/// 获取 Git 仓库信息（分支 + remote URL）
#[tauri::command]
pub fn get_git_info(dir_path: String) -> Result<serde_json::Value, String> {
    if !git::is_git_repo(&dir_path) {
        return Err("Not a git repository".to_string());
    }

    let branch = git::get_current_branch(&dir_path)?;
    let remote_url = git::get_remote_url(&dir_path).unwrap_or_default();

    Ok(serde_json::json!({
        "isGitRepo": true,
        "branch": branch,
        "remoteUrl": remote_url,
    }))
}

/// 执行自动 commit + push
#[tauri::command]
pub fn git_auto_push(dir_path: String, commit_message: String) -> Result<String, String> {
    git::auto_commit_push(&dir_path, &commit_message)
}

/// 读取图片文件并返回 base64 data URL
#[tauri::command]
pub fn read_image_as_data_url(file_path: String) -> Result<String, String> {
    use std::fs;
    use base64::Engine;

    let path = std::path::Path::new(&file_path);

    // 检查文件是否存在
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // 根据扩展名确定 MIME 类型
    let mime = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        _ => "image/png", // 默认
    };

    // 读取文件内容
    let data = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    // 编码为 base64
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);

    Ok(format!("data:{};base64,{}", mime, b64))
}
