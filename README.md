<div align="center">

# InkDoc

**墨迹所至，文档自成。**

一款极简的本地 Markdown 编辑器，飞书风格渲染，文件即数据库。

<img src="src-tauri/icons/512x512.png" width="128" alt="InkDoc Logo">

</div>

---

## 为什么做 InkDoc？

市面上不缺 Markdown 工具，但每一款都有让我不舒服的地方：

**Obsidian** 的默认渲染太"程序员"了。我不喜欢那种生硬的 Markdown 源码预览风格，更偏爱飞书那种干净、优雅的排版。而且 Obsidian 的双向链接、插件生态虽然强大，但对我来说太重了——我只是想安安静静写文档，不想管理一张关系网。

**飞书** 的文档体验我确实喜欢，但它有两个硬伤：一是和 Markdown 之间无法无损互转，格式丢来丢去；二是文件永远在云端，心里不踏实。我的知识库，我想自己拿着。

**Typora** 不错，但它只管单个文件。我需要的是管理一整个知识库文件夹，能快速检索、切换、组织。

所以我做了 InkDoc：

> 本地文件系统即数据库，飞书风格即审美，Markdown 即格式。
> 不云端、不社交、不复杂。打开文件夹，开始写。

---

## 特性

- **所见即所得编辑** — 基于 Milkdown（ProseMirror + Remark），点击即编辑，无需切换模式
- **飞书风格渲染** — 标题、引用、代码块、表格、任务列表，干净优雅
- **本地文件夹即知识库** — 打开一个文件夹，所有 `.md` 文件自动纳入管理
- **文件树 + 搜索** — 侧边栏树形浏览，实时搜索过滤
- **右键菜单** — 新建文件/文件夹、重命名、删除，全部通过 Rust 后端执行
- **自动保存** — 编辑后 1 秒自动保存，⌘S 手动保存
- **文件监听** — 外部修改自动同步，多工具协作无冲突
- **记住上次打开的文件夹** — 下次启动自动恢复
- **macOS 原生体验** — Overlay 标题栏、红绿灯按钮、全屏启动

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 |
| 后端 | Rust (notify, serde, pulldown-cmark) |
| 前端 | React 19 + TypeScript |
| 编辑器 | Milkdown Crepe (ProseMirror + Remark) |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |

## 快速开始

```bash
# 克隆
git clone https://github.com/Asthenia0412/InkDoc.git
cd inkdoc

# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev
```

## 系统要求

- macOS 12+（Apple Silicon 推荐）
- Node.js 18+
- Rust 1.70+
- Xcode Command Line Tools

## 项目结构

```
inkdoc/
├── src/                       # 前端 React
│   ├── components/
│   │   ├── Sidebar.tsx        # 文件树 + 搜索 + 右键菜单
│   │   ├── MarkdownView.tsx   # Milkdown WYSIWYG 编辑器
│   │   └── ContextMenu.tsx    # 右键菜单组件
│   ├── stores/
│   │   └── editor.ts          # Zustand 全局状态
│   ├── lib/
│   │   └── tauri-api.ts       # Tauri IPC 封装
│   ├── types/
│   │   └── index.ts           # TypeScript 类型
│   ├── App.tsx                # 主应用
│   └── index.css              # 飞书风格 CSS 覆盖
├── src-tauri/                 # Rust 后端
│   ├── src/
│   │   ├── commands/mod.rs    # Tauri Commands
│   │   ├── services/
│   │   │   ├── file_system.rs # 文件系统操作
│   │   │   └── markdown.rs    # Markdown 解析
│   │   ├── types.rs           # 共享类型
│   │   ├── lib.rs             # Tauri 入口
│   │   └── main.rs            # 程序入口
│   ├── icons/                 # 应用图标
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## License

MIT
