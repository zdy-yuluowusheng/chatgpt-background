"""
将右侧边栏全景透明与子面板毛玻璃定制样式（排除内置浏览器）精准注入主题 CSS，并验证客户端渲染。
"""
import os
import asyncio
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

CSS_FILE_PATH = r"d:\work\chatgpt-background\主题样式\晨雾森林毛玻璃主题.css"

SECTION_CONTENT = """

/* ================= 12. 右侧边栏全景透明与子面板（文件预览、Markdown、查看审批、命令行）毛玻璃美化（排除内置浏览器） ================= */

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

/* 12.6 查看审批与操作栏（编辑、拒绝、接受）毛玻璃浮动胶囊化 */
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

.popcorn-review-bar-overlay,
.popcorn-review-bar-overlay-content,
.popcorn-annotation-batch,
.popcorn-paged-annotation-preview {
  background-color: rgba(18, 22, 28, 0.55) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
}

/* 12.7 顶部选项卡标签条 (Tab Strip) 微光通透美化 */
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

/* 12.8 文件树内搜索筛选输入框微光半透明美化 */
aside[data-app-shell-focus-area="right-panel"] input[placeholder*="筛选"],
aside[data-app-shell-focus-area="right-panel"] input[placeholder*="Filter"],
aside[data-app-shell-focus-area="right-panel"] div:has(> input[placeholder*="筛选"]) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
}

/* 12.9 【核心保护】内置浏览器专用实体底色保护（排除内置浏览器，确保网页渲染与阅读清晰） */
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
}
"""

def update_css_file() -> None:
    """
    检查并向晨雾森林毛玻璃主题.css中追加第12节右侧边栏全景透明规则。

    :return: None
    :raises IOError: 当文件写入失败时抛出
    """
    with open(CSS_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    section_header = "/* ================= 12. 右侧边栏全景透明与子面板"
    if section_header in content:
        print("已存在第12节样式，正在替换为最新规则...")
        idx = content.find(section_header)
        base_content = content[:idx].rstrip()
        new_content = base_content + SECTION_CONTENT
    else:
        print("未检测到第12节样式，正在追加新规则...")
        new_content = content.rstrip() + SECTION_CONTENT

    with open(CSS_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("主题 CSS 文件更新成功！")

async def verify_and_capture() -> None:
    """
    清理临时测试样式节点，等待热重载生效，截取验收截图。

    :return: None
    :raises Exception: 当 CDP 连接失败时抛出
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("未找到页面 WebSocket 地址")
        return

    # 清理临时测试样式节点
    cleanup_script = """
    (() => {
        const testStyle = document.getElementById('__test_sidebar_style__');
        if (testStyle) {
            testStyle.remove();
            return '已清理测试节点';
        }
        return '无测试节点';
    })()
    """
    clean_res = await evaluate_script(ws_url, cleanup_script)
    print(f"临时样式清理状态: {clean_res}")

    # 等待热重载推送完成
    await asyncio.sleep(1.2)

    # 截图验收
    out_img = r"d:\work\chatgpt-background\验收_右侧边栏全景透明最终效果.png"
    await capture_screen(ws_url, out_img)
    print(f"最终验收截图已保存: {out_img}")

if __name__ == "__main__":
    update_css_file()
    asyncio.run(verify_and_capture())
