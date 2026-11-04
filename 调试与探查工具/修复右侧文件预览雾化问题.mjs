/**
 * @file 修复右侧文件预览雾化问题.mjs
 * @description 修复右侧边栏中由于 .popcorn-paged-annotation-preview 误匹配导致的文档（Word / DOCX / PDF 等）整体雾化模糊问题，
 *              将模糊滤镜彻底从文档预览主容器中剔除，确保文档文字与表格 100% 清晰可读，并热重载生效。
 * @author Antigravity Assistant
 */

import fs from 'fs';
import readline from 'readline';

const CSS_PATH = 'd:/work/chatgpt-background/主题样式/透明UI主题.css';
const BACKUP_PATH = 'd:/work/chatgpt-background/主题样式/透明UI主题.css.文件预览修复前备份';

/**
 * 备份当前的 CSS 文件
 * 
 * @param {string} src - 源文件路径
 * @param {string} dest - 备份目标路径
 * @returns {void} 无返回值
 * @throws {Error} 复制失败时抛出异常
 */
function backupCssFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`已成功备份原样式表至: ${dest}`);
}

/**
 * 执行样式表第 12 章节的精确修复与更新
 * 
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 读写失败时抛出异常
 */
async function fixSection12() {
  const fileStream = fs.createReadStream(CSS_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }

  const s12Index = lines.findIndex(l => l.includes('/* ================= 12. 右侧边栏'));
  if (s12Index === -1) {
    throw new Error('未能在样式表中定位到第 12 章节');
  }

  const newSection12 = `/* ================= 12. 右侧边栏全景透明与子面板（文件预览、Markdown、查看审批、命令行）毛玻璃美化（排除内置浏览器与文档预览正文） ================= */

/* 12.1 右侧边栏根容器与分栏外壳全景穿透透明，根除黑底 */
aside[data-app-shell-focus-area="right-panel"],
aside[data-app-shell-focus-area="right-panel"] > div,
[data-app-shell-pane-frame],
[data-app-shell-tab-panel-controller="right"],
[data-app-shell-focus-area="right-panel"] [class*="bg-[var(--app-shell-panel-background"],
[data-app-shell-focus-area="right-panel"] [class*="bg-surface"]:not(:has(webview), :has(iframe)) {
  background-color: transparent !important;
  background: transparent !important;
  --app-shell-panel-background: transparent !important;
}

/* 右侧面板左侧分割线细化为通透微光线 */
div[data-app-shell-pane-frame].border-l,
div[data-app-shell-pane-frame] {
  border-left-color: rgba(255, 255, 255, 0.08) !important;
}

/* 右侧面板拖拽分隔条 (Separator) 悬停微光反馈 */
aside[data-app-shell-focus-area="right-panel"] div[role="separator"]:hover {
  background-color: rgba(255, 255, 255, 0.10) !important;
}

/* 12.2 右侧面板内局部变量覆盖：穿透 Web Components（file-tree-container 与 diffs-container） */
aside[data-app-shell-focus-area="right-panel"]:not(:has(webview), :has(iframe)),
[data-app-shell-tab-panel-controller="right"]:not(:has(webview), :has(iframe)),
file-tree-container,
diffs-container {
  --color-surface: transparent !important;
  --color-surface-secondary: transparent !important;
  --color-surface-tertiary: transparent !important;
  --trees-bg-override: transparent !important;
  --trees-item-background: transparent !important;
  --trees-bg-muted-override: rgba(255, 255, 255, 0.08) !important;
  --diffs-bg: transparent !important;
  --diffs-line-bg: transparent !important;
  --codex-diffs-surface: transparent !important;
  --codex-diffs-context-surface: transparent !important;
  --codex-diffs-header-surface: transparent !important;
  background-color: transparent !important;
  background: transparent !important;
}

/* 12.3 文件预览与代码预览 (File Preview / Code Preview / Editor) 全景透明 */
diffs-container,
file-tree-container,
[data-pierre-editor-surface],
[data-tab-id^="text-editor"],
[data-tab-id="diff"],
.group\\/file-diff,
[data-tab-preview-pin-exempt],
[data-file-tree-virtualized] {
  background-color: transparent !important;
  background: transparent !important;
}

/* 面包屑路径条与顶部信息条透明穿透 */
[data-testid="viewer-header"],
header._header_1oxlz_1,
aside[data-app-shell-focus-area="right-panel"] header,
aside[data-app-shell-focus-area="right-panel"] [class*="sticky"],
aside[data-app-shell-focus-area="right-panel"] [class*="_header_"] {
  background-color: transparent !important;
  background: transparent !important;
}

/* 12.4 Markdown 预览 (Markdown Preview) 纯透明穿透 */
[data-tab-id*="markdown"],
[class*="markdown-preview"],
[data-testid*="markdown-preview"],
[data-composer-markdown],
.vscode-markdown,
.prose,
[class*="_markdown_"] {
  background-color: transparent !important;
  background: transparent !important;
}

/* 12.5 命令行与终端 (Terminal / Console) 全景透明穿透 */
xterm,
.xterm,
.xterm-viewport,
.xterm-screen,
.xterm-rows,
[data-tab-id*="terminal"],
[data-tab-id*="console"],
[data-testid*="terminal"],
[class*="terminal-container"],
[class*="terminal-pane"] {
  background-color: transparent !important;
  background: transparent !important;
}

/* 12.6 【核心修复】文档与分页预览（Word / DOCX / PDF / 表格等）高清透亮保护，彻底根除雾化与模糊 */
.popcorn-paged-annotation-preview,
[class*="paged-annotation-preview"],
[class*="popcorn-paged"],
.popcorn-annotation-batch,
[class*="annotation-batch"],
[class*="document-preview"],
[class*="file-preview"],
[class*="office-preview"],
[data-tab-id*="docx"],
[data-tab-id*="doc"],
[data-tab-id*="xlsx"],
[data-tab-id*="xls"],
[data-tab-id*="pdf"] {
  background-color: transparent !important;
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  -webkit-filter: none !important;
  box-shadow: none !important;
  border: none !important;
}

/* 确保分页预览容器内部所有层级（纸张、段落、文字、表格、批注）100% 清晰锐利，严禁继承任何模糊滤镜 */
.popcorn-paged-annotation-preview *,
[class*="paged-annotation-preview"] *,
.popcorn-annotation-batch * {
  filter: none !important;
  -webkit-filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* 12.7 查看审批与浮动操作栏（编辑、拒绝、接受等胶囊条）毛玻璃美化（严格排除文档正文与分页预览） */
aside[data-app-shell-focus-area="right-panel"] div.flex.shrink-0.justify-end.border-t.border-default.bg-surface,
aside[data-app-shell-focus-area="right-panel"] [class*="border-t"][class*="bg-surface"]:not(:has(webview), :has(iframe)) {
  background-color: transparent !important;
  background: transparent !important;
  border-top-color: rgba(255, 255, 255, 0.08) !important;
}

aside[data-app-shell-focus-area="right-panel"] div:has(> button[class*="button-toolbar"]) {
  background-color: rgba(18, 22, 28, 0.45) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px 12px 0 0 !important;
}

/* 仅对底部悬浮的审批操作条应用暗色雾化胶囊，杜绝作用于文档正文 */
.popcorn-review-bar-overlay:not(.popcorn-paged-annotation-preview, [class*="paged-annotation-preview"]),
.popcorn-review-bar-overlay-content {
  background-color: rgba(18, 22, 28, 0.65) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
  border-radius: 12px !important;
}

/* 12.8 顶部选项卡标签条 (Tab Strip) 微光通透美化 */
[data-app-shell-header-toolbar] button[role="tab"] {
  transition: all 0.15s ease-out !important;
}

[data-app-shell-header-toolbar] button[role="tab"][aria-selected="true"] {
  background-color: rgba(255, 255, 255, 0.12) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  color: #ffffff !important;
}

[data-app-shell-header-toolbar] button[role="tab"][aria-selected="false"]:hover {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: #f0f0f0 !important;
}

/* 12.9 文件树内搜索筛选输入框微光半透明美化 */
aside[data-app-shell-focus-area="right-panel"] input[placeholder*="筛选"],
aside[data-app-shell-focus-area="right-panel"] input[placeholder*="Filter"],
aside[data-app-shell-focus-area="right-panel"] div:has(> input[placeholder*="筛选"]) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
}

/* 12.10 【核心保护】内置浏览器专用实体底色保护（排除内置浏览器，确保网页渲染与阅读清晰） */
webview,
iframe,
[data-codex-window-type="browser"],
[data-tab-id*="browser"],
[data-tab-id*="web-sandbox"],
[data-tab-id*="visualization"],
[role="tabpanel"]:has(webview),
[role="tabpanel"]:has(iframe),
[data-app-shell-tab-panel-controller="right"]:has(webview),
[data-app-shell-tab-panel-controller="right"]:has(iframe),
div:has(> webview),
div:has(> iframe) {
  background-color: #1e1e1e !important;
  background: #1e1e1e !important;
  --color-surface: #1e1e1e !important;
  --app-shell-panel-background: #1e1e1e !important;
}`;

  const finalLines = lines.slice(0, s12Index);
  finalLines.push(newSection12);

  const updatedContent = finalLines.join('\n');
  fs.writeFileSync(CSS_PATH, updatedContent, 'utf8');
  console.log(`[修复成功] 已更新第 12 章节并写回: ${CSS_PATH} (总行数: ${finalLines.length})`);
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>} 无返回值
 */
async function main() {
  try {
    backupCssFile(CSS_PATH, BACKUP_PATH);
    await fixSection12();
    console.log('等待 1.5 秒供后台注入引擎热重载...');
    await new Promise(r => setTimeout(r, 1500));
    console.log('文件预览雾化修复流程全部完成！');
  } catch (err) {
    console.error('修复异常:', err);
  }
}

main();
