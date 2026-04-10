# Lark Local

> 一款基于本地文件系统的 Markdown 浏览器与编辑器。

## 快速开始

```bash
# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev
```

## 项目结构

```
lark-local/
├── src/                    # 前端 React 代码
│   ├── components/         # UI 组件
│   │   ├── Sidebar.tsx     # 文件树侧边栏
│   │   └── MarkdownView.tsx # Markdown 渲染视图
│   ├── stores/             # Zustand 状态管理
│   ├── types/              # TypeScript 类型定义
│   ├── lib/                # 工具函数 & Tauri API 封装
│   ├── App.tsx             # 主应用组件
│   └── main.tsx            # 入口文件
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands/       # Tauri Commands
│   │   ├── services/       # 业务逻辑
│   │   │   ├── file_system.rs  # 文件系统操作
│   │   │   └── markdown.rs     # Markdown 解析
│   │   ├── types.rs        # 共享类型定义
│   │   └── lib.rs          # Tauri 入口
│   ├── Cargo.toml
│   └── tauri.conf.json
├── sample-vault/           # 示例 Markdown 仓库
└── package.json
```

## 技术栈

- **框架**: Tauri v2
- **后端**: Rust (pulldown-cmark, notify, serde)
- **前端**: React 19 + TypeScript + Tailwind CSS + Zustand

## 系统要求

- macOS 12+ (Apple Silicon 推荐)
- Node.js 18+
- Rust 1.70+
- Xcode Command Line Tools
