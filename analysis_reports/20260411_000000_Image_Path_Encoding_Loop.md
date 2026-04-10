# 异常分析报告

## 基本信息
- **分析时间**：2026-04-11
- **问题简述**：Markdown 编辑器中图片路径被重复编码，导致图片无法正确展示
- **影响范围**：Markdown 编辑器中的图片展示功能
- **严重程度**：高（用户无法正常使用图片功能）

## 问题现象

用户在使用 Markdown 编辑器时，发现图片无法正确展示，并且路径显示异常：
- 图片路径被多次重复编码
- 出现 `asset://` 或 `blob://` 协议的路径
- 这些路径又被嵌套在路径中，形成无限循环编码的问题

## 环境信息
- **操作系统**：macOS
- **项目路径**：`/Users/yancy/Desktop/mydoc/`
- **框架**：Tauri (Rust + TypeScript) + React + Milkdown/Crepe
- **问题位置**：`src/components/MarkdownView.tsx`

## 排查过程

### 1. 初步假设

1. **图片路径处理逻辑问题**：`resolveImagePathsInMarkdown` 函数可能将转换后的路径保存到了文件中
2. **编辑器双向转换问题**：Crepe 编辑器在 `getMarkdown()` 时可能再次处理了图片 URL
3. **路径解析不完整**：没有正确处理 `asset://`、`blob://` 等特殊协议的路径

### 2. 验证步骤

**关键发现 1：图片路径转换流程**

查看 [MarkdownView.tsx](file:///Users/yancy/Desktop/mydoc/src/components/MarkdownView.tsx#L36-L87) 中的 `resolveImagePathsInMarkdown` 函数：
- 该函数将相对路径图片转换为 base64 data URL 传给 Crepe 编辑器
- 但在保存时，调用 `crepe.getMarkdown()` 获取内容时，Crepe 可能再次处理了图片链接
- 导致 base64 data URL 被转换为 `asset://` 或 `blob://` 协议的路径

**关键发现 2：内容同步问题**

查看 [MarkdownView.tsx](file:///Users/yancy/Desktop/mydoc/src/components/MarkdownView.tsx#L159-L169) 中的输入处理：
- `handleEditorInput` 函数直接使用编辑器返回的 Markdown 内容更新状态
- 这导致被编辑器转换过的图片路径被保存回文件
- 下次打开文件时，这些特殊协议路径又被重复处理

### 3. 根因定位

**根因：编辑器双向转换导致的路径污染**

1. 输入阶段：`resolveImagePathsInMarkdown` 将相对路径 → base64 data URL
2. 编辑阶段：Crepe 编辑器内部将 base64 data URL → `asset://` / `blob://` 路径
3. 保存阶段：`getMarkdown()` 将 `asset://` / `blob://` 路径保存回文件
4. 重新打开：这些特殊协议路径再次被处理，形成无限循环编码

## 解决方案

### 临时措施
无临时措施，需要从根本上修复。

### 根本修复

**方案：分离原始内容与渲染内容**

1. **维护原始内容引用**：始终保持对文件原始内容的引用，不从编辑器中获取完整内容
2. **增量更新机制**：只更新文本内容，保留原始图片链接
3. **完善路径解析**：确保 `resolveImagePathsInMarkdown` 能正确处理已被转换过的路径
4. **阻止双向污染**：保存时不使用编辑器转换后的内容

具体修改：
- 修改 [MarkdownView.tsx](file:///Users/yancy/Desktop/mydoc/src/components/MarkdownView.tsx) 中的输入处理逻辑
- 改进 `resolveImagePathsInMarkdown` 函数，识别并正确处理特殊协议路径
- 优化保存逻辑，避免污染原始文件

## 验证结果

修复后应满足：
1. 图片能正确渲染显示
2. 保存文件时，图片链接保持原始相对路径格式
3. 重新打开文件时，图片依然能正确显示
4. 不会出现路径重复编码的问题

## 经验总结

- **关键知识点**：
  - WYSIWYG 编辑器的双向转换可能导致内容污染
  - 始终区分"原始内容"和"渲染内容"
  - 特殊协议（`asset://`、`blob://`）是编辑器内部使用的，不应保存到文件

- **排查技巧**：
  - 观察路径的变化流程，定位每个环节的转换
  - 检查输入输出的完整链路，找出污染点
  - 对比原始内容与保存后的内容差异

- **预防建议**：
  - 设计时明确区分数据层与展示层
  - 保存操作应基于原始数据，而非渲染后的结果
  - 对编辑器的 `getMarkdown()` 结果保持警惕，可能包含内部转换产物

## 相关资源
- [Milkdown 官方文档](https://milkdown.dev/)
- [Crepe 编辑器文档](https://crepe.milkdown.dev/)
- [Tauri 2.0 文档](https://v2.tauri.app/)
