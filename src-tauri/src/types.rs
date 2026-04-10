use serde::{Deserialize, Serialize};

/// 文件树节点
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FileNode {
    #[serde(rename = "file")]
    File {
        name: String,
        path: String,
        #[serde(rename = "ext")]
        extension: Option<String>,
    },
    #[serde(rename = "folder")]
    Folder {
        name: String,
        path: String,
        children: Vec<FileNode>,
        #[serde(rename = "isExpanded")]
        is_expanded: bool,
    },
}

/// Markdown Block 结构（前后端通信的核心协议）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Block {
    #[serde(rename = "heading")]
    Heading {
        id: String,
        content: String,
        level: u8,
    },
    #[serde(rename = "paragraph")]
    Paragraph {
        id: String,
        content: String,
    },
    #[serde(rename = "list_item")]
    ListItem {
        id: String,
        content: String,
        ordered: bool,
        index: Option<u32>,
    },
    #[serde(rename = "code")]
    Code {
        id: String,
        content: String,
        language: Option<String>,
    },
    #[serde(rename = "blockquote")]
    Blockquote {
        id: String,
        content: String,
    },
    #[serde(rename = "thematic_break")]
    ThematicBreak {
        id: String,
    },
    #[serde(rename = "empty")]
    Empty {
        id: String,
    },
}

#[allow(dead_code)]
impl Block {
    /// 获取 Block 的 ID
    pub fn id(&self) -> &str {
        match self {
            Block::Heading { id, .. } => id,
            Block::Paragraph { id, .. } => id,
            Block::ListItem { id, .. } => id,
            Block::Code { id, .. } => id,
            Block::Blockquote { id, .. } => id,
            Block::ThematicBreak { id } => id,
            Block::Empty { id } => id,
        }
    }
}

/// 文件写入请求
#[derive(Debug, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
}

/// 文件操作结果
#[derive(Debug, Serialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub message: String,
}

/// 简单哈希函数，用于生成 Block ID
pub fn simple_hash(s: &str) -> u32 {
    let mut hash: u32 = 0;
    for byte in s.bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
    }
    hash
}

/// 生成 Block ID: "{line_number}:{content_hash}"
pub fn generate_block_id(line_number: usize, content: &str) -> String {
    let hash = simple_hash(content);
    format!("{}:{:08x}", line_number, hash)
}
