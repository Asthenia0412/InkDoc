use std::path::Path;
use std::process::Command;

/// 检测目录是否是 Git 仓库
pub fn is_git_repo(dir_path: &str) -> bool {
    Path::new(dir_path).join(".git").exists()
}

/// 获取当前分支名
pub fn get_current_branch(dir_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("Failed to get branch: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not a git repository".to_string())
    }
}

/// 获取 remote origin URL
pub fn get_remote_url(dir_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .arg("remote")
        .arg("get-url")
        .arg("origin")
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("Failed to get remote: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("No remote origin found".to_string())
    }
}

/// 执行 git add + commit + push
pub fn auto_commit_push(dir_path: &str, commit_message: &str) -> Result<String, String> {
    // git add -A
    let add_output = Command::new("git")
        .arg("add")
        .arg("-A")
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("git add failed: {}", e))?;

    if !add_output.status.success() {
        return Err(format!("git add failed: {}", String::from_utf8_lossy(&add_output.stderr)));
    }

    // 检查是否有变更需要提交
    let status_output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("git status failed: {}", e))?;

    let status = String::from_utf8_lossy(&status_output.stdout).trim().to_string();
    if status.is_empty() {
        return Ok("No changes to commit".to_string());
    }

    // git commit -m "message"
    let commit_output = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(commit_message)
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("git commit failed: {}", e))?;

    if !commit_output.status.success() {
        return Err(format!("git commit failed: {}", String::from_utf8_lossy(&commit_output.stderr)));
    }

    // git push
    let push_output = Command::new("git")
        .arg("push")
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("git push failed: {}", e))?;

    if !push_output.status.success() {
        return Err(format!("git push failed: {}", String::from_utf8_lossy(&push_output.stderr)));
    }

    Ok("Committed and pushed successfully".to_string())
}
