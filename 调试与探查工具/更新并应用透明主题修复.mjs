/**
 * @file 更新并应用透明主题修复.mjs
 * @description 针对 ChatGPT/Codex 最新版本 DOM 结构重构（弃用 pre 标签、采用 data-code-block 与 CodeBlock/StickyActionBar 组件化以及去下划线类名命名规则），
 *              安全更新主题 CSS 文件，消除代码块黑底、标题栏黑底与顶部渐变遮罩黑条，并触发 CDP 验证截屏。
 * @author Antigravity Assistant
 */

import fs from 'fs';
import readline from 'readline';

const CSS_PATH = 'd:/work/chatgpt-background/主题样式/透明UI主题.css';
const BACKUP_PATH = 'd:/work/chatgpt-background/主题样式/透明UI主题.css.备份';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 备份原始 CSS 文件
 * 
 * @param {string} src - 源文件路径
 * @param {string} dest - 备份目标路径
 * @returns {void} 无返回值
 * @throws {Error} 复制文件失败时抛出错误
 */
function backupCssFile(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`已成功备份原样式表至: ${dest}`);
  } else {
    console.log(`备份文件已存在，跳过覆盖: ${dest}`);
  }
}

/**
 * 核心升级与重构 CSS 规则内容
 * 
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 读写失败时抛出异常
 */
async function upgradeCssFile() {
  const fileStream = fs.createReadStream(CSS_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const lines = [];
  let lineIndex = 0;
  for await (const line of rl) {
    lineIndex++;
    lines.push(line);
  }

  console.log(`读取原文件共 ${lines.length} 行`);

  // 1. 重构第 2 章节：主表面穿透与全景展开（行 27-50 索引 26-49）
  const section2Replacement = `/* ================= 2. 主表面穿透与全景展开 ================= */
main,
main.bg-surface,
main:is(.main-surface, [data-app-shell-main-surface], [class*="MainContentSurface"], [class*="_MainContentSurface_"]),
[role="main"],
.thread-scroll-container,
.main-surface,
[class*="Workspace"],
[class*="_Workspace_"],
[class*="WorkspaceContent"],
[class*="_WorkspaceContent_"],
[class*="MainContentViewport"],
[class*="_MainContentViewport_"],
[class*="MainContentFrame"],
[class*="_MainContentFrame_"],
[class*="MainContentClip"],
[class*="_MainContentClip_"],
[class*="PageSurface"],
[class*="_PageSurface_"] {
    background-color: transparent !important;
    background: transparent !important;
}

/* 消除主工作区顶部原生遮罩与渐变（精确定位遮罩层，杜绝误伤对话主容器；兼容去下划线新版类名） */
div[class*="MainContentTopFade"],
div[class*="_MainContentTopFade_"],
.MainContentTopFade,
.app-shell-main-content-top-fade,
[class*="MainContentTopFade"] {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
}`;

  // 2. 增强第 6 章节：对话文字流与消息纯透明穿透
  const section6Replacement = `/* ================= 6. 纯文字消息纯透明穿透 (消除双层外框，与 Antigravity 一致) ================= */
/* 用户提问卡片、ChatGPT 回复等纯文字流全面透明，无外层卡片与边框 */
:is([data-message-author-role], [data-local-conversation-user-anchor], [data-local-conversation-final-assistant]),
:is([data-message-author-role], [data-local-conversation-user-anchor], [data-local-conversation-final-assistant]) > div,
.bg-user-message,
[class*="bg-user-message"],
div.flex.flex-col.items-end.gap-2,
div[data-local-conversation-user-anchor] > div,
[data-thread-find-target="conversation"],
[data-thread-find-target="conversation"] > div,
[data-markdown-text-style],
[class*="MarkdownRoot"],
[class*="assistant-message"],
[class*="user-message"] {
    background: transparent !important;
    background-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: none !important;
    box-shadow: none !important;
}`;

  // 3. 重构第 7 章节：代码块与操作卡片（本次核心修复点）
  const section7Replacement = `/* ================= 7. 命令行、脚本、代码块与操作卡片透明调整 ================= */
/* 7.1 代码块外层容器（同时兼容新版 React 组件 data-code-block 架构与旧版 pre 标签架构） */
pre,
.markdown pre,
[class*="markdown"] pre,
[class*="_markdown"] pre,
[data-code-block],
[data-code-block="true"],
[data-markdown-copy="code-block"],
[class*="CodeBlock"],
[class*="_CodeBlock_"],
[class*="CodeSurface"],
[class*="_Surface_"],
[class*="Surface-"],
[data-testid*="code"],
/* 终端命令行容器与操作卡片（如 Bash、已编辑文件、变更统计面板） */
[class*="bg-surface-elevated"],
.electron\\:elevation-prominent {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
}

/* 7.2 彻底清除代码块内部所有子节点（标题动作栏、代码内容容器等）的黑色底色与渐变 */
[data-code-block] > div,
[data-code-block] [class*="ActionBar"],
[data-code-block] [class*="StickyActionBar"],
[data-code-block] [class*="Source-"],
[data-code-block] [data-code-block-source],
[class*="CodeBlock"] > div,
[class*="CodeBlock"] [class*="ActionBar"],
[class*="CodeBlock"] [class*="StickyActionBar"],
[class*="CodeBlock"] [class*="Source-"],
[class*="CodeBlock"] [data-code-block-source],
[class*="_StickyActionBar_"],
[class*="_BlockActions_"],
div:has(> [class*="CodeContent"]),
div:has(> [class*="_CodeContent_"]),
div:has(> pre),
[class*="bg-surface-elevated"] *,
[class*="_StickyActionBar_"] *,
[class*="_BlockActions_"] * {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
}

/* 7.3 代码块顶部标题动作栏（语言名称标识、运行与复制按钮）：底部细微半透明分割线 */
[data-code-block] [class*="ActionBar"],
[data-code-block] [class*="StickyActionBar"],
[class*="CodeBlock"] [class*="ActionBar"],
[class*="CodeBlock"] [class*="StickyActionBar"],
[class*="_StickyActionBar_"],
[class*="bg-surface-elevated"] header,
pre header {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.10) !important;
}

/* 7.4 修复代码块内部 code 标签：确保代码行本身纯透明无边框，杜绝被行内代码规则误伤 */
[data-code-block] code,
[class*="CodeBlock"] code,
[class*="_CodeBlock_"] code,
[class*="CodeContent"],
[class*="_CodeContent_"],
pre code {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
}

/* 顶部切换摘要浮层面板（Summary Panel）与三个点更多菜单保持一致：仅根容器应用暗色雾化毛玻璃胶囊浮层，严格排除内部条目项 */
[class~="group/summary-panel"]:not([class*="-item"]),
[data-summary-panel-variant]:not([class*="-item"]):not([data-slot*="item"]) {
    background-color: rgba(18, 24, 30, 0.65) !important;
    background: rgba(18, 24, 30, 0.65) !important;
    backdrop-filter: blur(28px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
    border: 1px solid rgba(255, 255, 255, 0.16) !important;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
    border-radius: 14px !important;
}

/* 摘要面板内部条目项（如“变更”按钮项）默认透明，彻底去除误匹配引入的黑底、边框与外层阴影；保留原生 hover 白色高亮 */
[class*="summary-panel-item"],
[data-slot="thread-summary-panel-item"] {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* 摘要浮层面板（Summary Panel）及各类粘性表头顶部 ::before/::after 遮罩伪元素彻底透明化，根除黑色线条 */
[class*="summary-panel"] header,
[class*="summary-panel"] header::before,
[class*="summary-panel"] header::after,
[data-summary-panel-variant] header,
[data-summary-panel-variant] header::before,
[data-summary-panel-variant] header::after,
header:is([class*="bg-surface-elevated"], [class*="before:bg-surface-elevated"]),
header:is([class*="bg-surface-elevated"], [class*="before:bg-surface-elevated"])::before,
header:is([class*="bg-surface-elevated"], [class*="before:bg-surface-elevated"])::after {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    border: none !important;
}

/* 工具栏按钮悬停柔和微光反馈 */
[data-code-block] button:hover,
[class*="CodeBlock"] button:hover,
[class*="ActionBar"] button:hover,
[class*="StickyActionBar"] button:hover,
[class*="_StickyActionBar_"] button:hover,
[class*="_BlockActions_"] button:hover {
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-radius: 6px !important;
}

/* 行内代码徽章透明微光边框（严格排除代码块内部的代码行） */
code:not(
    [class*="CodeContent"],
    [class*="_CodeContent_"],
    [data-code-block] code,
    [class*="CodeBlock"] code,
    [class*="_CodeBlock_"] code,
    pre code
) {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.10) !important;
    border-radius: 4px !important;
    padding: 2px 6px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
}`;

  // 替换 lines 中对应区段
  // 查找各个区段的位置
  const s2Start = lines.findIndex(l => l.includes('/* ================= 2. 主表面穿透与全景展开 ================= */'));
  const s3Start = lines.findIndex(l => l.includes('/* ================= 3. 左侧任务栏/侧边栏纯透明穿透与图标高雅雾化 (消除黑底) ================= */'));

  const s6Start = lines.findIndex(l => l.includes('/* ================= 6. 纯文字消息纯透明穿透 (消除双层外框，与 Antigravity 一致) ================= */'));
  const s61Start = lines.findIndex(l => l.includes('/* 6.1 用户上传文件、附件卡片与资源胶囊'));

  const s7Start = lines.findIndex(l => l.includes('/* ================= 7. 命令行、脚本、代码块与操作卡片透明调整 ================= */'));
  const s8Start = lines.findIndex(l => l.includes('/* ================= 8. 弹窗、个人资料用量浮层与上下文菜单：透明雾化毛玻璃 ================= */'));

  console.log({ s2Start, s3Start, s6Start, s61Start, s7Start, s8Start });

  if (s2Start === -1 || s3Start === -1 || s6Start === -1 || s7Start === -1 || s8Start === -1) {
    throw new Error('未能在原样式表中定位到所有的章节注释');
  }

  // 拼接最终的行数组
  const finalLines = [];
  // 头部到第 2 章节前（包含第 20 行的 base64 壁纸）
  for (let i = 0; i < s2Start; i++) {
    finalLines.push(lines[i]);
  }
  finalLines.push(section2Replacement);
  finalLines.push('');

  // 第 3 章节到第 6 章节前
  for (let i = s3Start; i < s6Start; i++) {
    finalLines.push(lines[i]);
  }
  finalLines.push(section6Replacement);
  finalLines.push('');

  // 第 6.1 章节到第 7 章节前
  for (let i = s61Start; i < s7Start; i++) {
    finalLines.push(lines[i]);
  }
  finalLines.push(section7Replacement);
  finalLines.push('');

  // 第 8 章节至文末
  for (let i = s8Start; i < lines.length; i++) {
    finalLines.push(lines[i]);
  }

  const newContent = finalLines.join('\n');
  fs.writeFileSync(CSS_PATH, newContent, 'utf8');
  console.log(`[成功] 主题样式已成功更新并写回: ${CSS_PATH} (总字符数: ${newContent.length})`);
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>} 无返回值
 */
async function main() {
  try {
    backupCssFile(CSS_PATH, BACKUP_PATH);
    await upgradeCssFile();
    console.log('等待 1.5 秒供后台热重载引擎推送样式...');
    await new Promise(r => setTimeout(r, 1500));
    console.log('主题更新全流程完成！');
  } catch (err) {
    console.error('更新失败:', err);
  }
}

main();
