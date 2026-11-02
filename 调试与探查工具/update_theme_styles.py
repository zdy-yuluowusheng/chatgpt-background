"""
主题样式表更新与热重载工具。
更新主题 CSS 并通过 CDP 协议同步至正在运行的 ChatGPT / Codex 实例。
"""
import os
import sys
import json
import asyncio
import urllib.request
from typing import Optional, Dict, Any

CSS_PATH = r"d:\work\chatgpt-background\主题样式\透明UI主题.css"
CDP_PORT = 9335
STYLE_ID = "__chatgpt_codex_custom_theme_style__"

OLD_BLOCK = """/* 设置界面内所有详情分组卡片（常规、权限、通知、快捷键、编辑器等所有子页面的详情卡片） */
.group\\/settings div.rounded-2xl:has([class*="settings-row"]),
div[class*="group/settings"] div.rounded-2xl:has([class*="settings-row"]),
section div.rounded-2xl:has([class*="settings-row"]),
div.rounded-2xl.overflow-hidden.border.border-default,
div.rounded-2xl:has(> [class*="@container/settings-row"]),
div[class*="group-data-[density=compact]/settings"].rounded-2xl {
    background-color: rgba(255, 255, 255, 0.05) !important;
    backdrop-filter: blur(20px) saturate(160%) !important;
    -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

/* 确保卡片内部各行保持纯透明，消除行内多余的子级背景 */
[class*="@container/settings-row"],
[class*="settings-row"],
[class*="settings-row"] > div {
    background-color: transparent !important;
    background: transparent !important;
}

/* 设置卡片内部行之间的分割微光线 */
div:has(> [class*="@container/settings-row"]) > *:not(:last-child)::after {
    background-color: rgba(255, 255, 255, 0.08) !important;
}

/* 设置卡片内的次级下拉框与按钮透明化微光 */
div[class*="settings-row"] button[class*="button-toolbar"],
div[class*="settings-row"] [class*="_ComposerFooterDropdown_"],
div[class*="settings-row"] button[class*="rounded-button-toolbar"] {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    border-radius: 8px !important;
}

div[class*="settings-row"] button[class*="button-toolbar"]:hover {
    background-color: rgba(255, 255, 255, 0.16) !important;
    border-color: rgba(255, 255, 255, 0.20) !important;
}"""

NEW_BLOCK = """/* 顶部吸顶条及渐变淡出遮罩彻底消除黑底（彻底解决使用情况和计费等页面上方黑横条） */
div[class*="bg-surface"][class*="sticky"],
div[class*="bg-surface"][class*="sticky"]::before,
div[class*="bg-surface"][class*="sticky"]::after,
[class*="after:from-surface"]::after,
[class*="after:bg-linear"]::after,
[class*="_MainContentTopFade_"],
[class*="_MainContentTopFade_"]::before,
[class*="_MainContentTopFade_"]::after {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
}

/* 设置界面内常规尺寸详情分组卡片透明雾化（排除超长卡片，防止 Chromium GPU 纹理溢出崩溃） */
.group\\/settings div.rounded-2xl:has([class*="settings-row"]):not(:has([class*="@container/keyboard-shortcuts"])),
div[class*="group/settings"] div.rounded-2xl:has([class*="settings-row"]):not(:has([class*="@container/keyboard-shortcuts"])),
section div.rounded-2xl:has([class*="settings-row"]):not(:has([class*="@container/keyboard-shortcuts"])),
div.rounded-2xl.overflow-hidden.border.border-default:not(:has([class*="@container/keyboard-shortcuts"])),
div.rounded-2xl:has(> [class*="@container/settings-row"]):not(:has([class*="@container/keyboard-shortcuts"])),
div[class*="group-data-[density=compact]/settings"].rounded-2xl:not(:has([class*="@container/keyboard-shortcuts"])) {
    background-color: rgba(255, 255, 255, 0.05) !important;
    backdrop-filter: blur(20px) saturate(160%) !important;
    -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

/* 【核心修复】键盘快捷键超长卡片防御：禁用 backdrop-filter，避免 Chromium GPU 合成器超限丢弃文本 Pass，完美恢复字符 */
div.rounded-2xl:has([class*="@container/keyboard-shortcuts"]),
div.rounded-2xl:has([class*="keyboard-shortcuts"]),
div[class*="@container/keyboard-shortcuts"],
div[class*="@container/keyboard-shortcuts"] div.rounded-2xl {
    background-color: rgba(18, 22, 28, 0.72) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35) !important;
}

/* 键盘快捷键文本与说明对比度增强 */
div[class*="@container/keyboard-shortcuts"] {
    color: #f3f4f6 !important;
}

/* 键盘快捷键 <kbd> 胶囊与按键字符高保真清晰化 */
kbd,
[data-key],
[class*="keyboard-shortcuts"] kbd {
    background-color: rgba(255, 255, 255, 0.15) !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
    color: #ffffff !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.20) !important;
    font-weight: 600 !important;
    border-radius: 6px !important;
}

/* 确保卡片内部各行保持纯透明，消除行内多余的子级背景 */
[class*="@container/settings-row"],
[class*="settings-row"],
[class*="settings-row"] > div {
    background-color: transparent !important;
    background: transparent !important;
}

/* 设置卡片内部行之间的分割微光线 */
div:has(> [class*="@container/settings-row"]) > *:not(:last-child)::after {
    background-color: rgba(255, 255, 255, 0.08) !important;
}

/* 设置卡片内的次级下拉框与按钮透明化微光（排除未悬停的方形占位按钮，消除幽灵方块） */
div[class*="settings-row"] button[class*="button-toolbar"]:not([class*="aspect-square"]),
div[class*="settings-row"] [class*="_ComposerFooterDropdown_"],
div[class*="settings-row"] button[class*="rounded-button-toolbar"] {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    border-radius: 8px !important;
}

div[class*="settings-row"] button[class*="button-toolbar"]:not([class*="aspect-square"]):hover {
    background-color: rgba(255, 255, 255, 0.16) !important;
    border-color: rgba(255, 255, 255, 0.20) !important;
}

/* 消除快捷键未悬停行中出现的浅色方框（幽灵方块），悬停时再优雅展示 */
div[class*="settings-row"] button[class*="aspect-square"]:not(:hover) {
    background-color: transparent !important;
    border-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
}

div[class*="settings-row"] button[class*="aspect-square"]:hover {
    background-color: rgba(255, 255, 255, 0.14) !important;
    border: 1px solid rgba(255, 255, 255, 0.20) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border-radius: 8px !important;
}

/* 快捷键搜索框透明微光美化（消除实心暗紫色底） */
div.bg-page-search,
div[class*="bg-page-search"] {
    background-color: rgba(255, 255, 255, 0.07) !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border-radius: 10px !important;
}

/* 使用情况和计费周期切换胶囊（7天/30天、5小时/每周）微光毛玻璃化（消除 92% 深黑底色） */
div.inline-grid[class*="bg-surface-secondary/92"],
div[class*="bg-surface-secondary/92"] {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
}

div.inline-grid[class*="bg-surface-secondary/92"] span[class*="bg-surface"],
div[class*="bg-surface-secondary/92"] span[class*="bg-surface"] {
    background-color: rgba(255, 255, 255, 0.20) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
    border-radius: 8px !important;
}

/* 使用情况分析表格表头半透明雾化美化（消除深色残留表头） */
thead[class*="bg-surface-secondary/92"],
thead[class*="bg-surface-secondary"],
th[class*="bg-surface-secondary/92"],
th[class*="bg-surface-secondary"] {
    background-color: rgba(18, 22, 28, 0.65) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
}

/* 模型切换分段控制器透明微光 */
div[class*="bg-(--segmented-control-background)"] {
    background-color: rgba(255, 255, 255, 0.08) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
}"""

def update_css_file(path: str) -> bool:
    """
    更新主题样式表文件中的规则定义，替换深色残留及超长卡片崩溃样式。

    :param path: 本地 CSS 文件的绝对路径
    :return: 替换成功返回 True，已包含或未找到返回 False
    :raises IOError: 当文件读取或写入失败时抛出异常
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        norm_content = content.replace("\r\n", "\n")
        norm_old = OLD_BLOCK.replace("\r\n", "\n")
        norm_new = NEW_BLOCK.replace("\r\n", "\n")

        if norm_new in norm_content:
            print("[CSS] 样式表中已包含最新样式规则，无需重复写入。")
            return True

        if norm_old in norm_content:
            updated = norm_content.replace(norm_old, norm_new)
            # 保持 Windows CRLF
            with open(path, "w", encoding="utf-8", newline="\r\n") as f:
                f.write(updated)
            print("[CSS] 成功更新样式表文件！")
            return True
        else:
            print("[CSS] 警告：未找到待替换的原始规则块，尝试追加至末尾。")
            with open(path, "a", encoding="utf-8", newline="\r\n") as f:
                f.write("\n\n" + NEW_BLOCK + "\n")
            print("[CSS] 已成功将最新规则追加至样式表末尾！")
            return True
    except Exception as err:
        print(f"[CSS 写入异常] {err}")
        return False

def get_page_ws_url() -> Optional[str]:
    """
    通过 HTTP 查询本地 CDP 接口，获取 ChatGPT / Codex 活跃页面的 WebSocket 调试地址。

    :return: WebSocket 调试 URL 字符串，找不到时返回 None
    :raises urllib.error.URLError: 当 CDP 端口不可达时抛出异常
    """
    try:
        req = urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/list", timeout=3)
        data = json.loads(req.read().decode("utf-8"))
        for item in data:
            if item.get("type") == "page" and "initialRoute" not in item.get("url", ""):
                return item.get("webSocketDebuggerUrl")
    except Exception as err:
        print(f"[CDP 连接查询异常] {err}")
    return None

async def hot_reload_theme(ws_url: str, css_content: str) -> bool:
    """
    通过 CDP WebSocket 连接向当前运行中的渲染页面热重载注入最新 CSS 样式。

    :param ws_url: 页面 WebSocket 调试地址
    :param css_content: 最新的 CSS 文本内容
    :return: 注入成功返回 True，失败返回 False
    :raises Exception: 当 WebSocket 连接或数据传输异常时抛出
    """
    import websockets
    script = f"""
    (() => {{
        try {{
            let style = document.getElementById("{STYLE_ID}");
            if (!style) {{
                style = document.createElement("style");
                style.id = "{STYLE_ID}";
                (document.head || document.documentElement).appendChild(style);
            }}
            style.textContent = {json.dumps(css_content)};
            return {{ success: true, length: style.textContent.length }};
        }} catch(e) {{
            return {{ success: false, error: e.message }};
        }}
    }})();
    """
    try:
        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            msg = {
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": script,
                    "returnByValue": True,
                    "awaitPromise": True
                }
            }
            await ws.send(json.dumps(msg))
            while True:
                resp = json.loads(await ws.recv())
                if resp.get("id") == 1:
                    result = resp.get("result", {}).get("result", {}).get("value")
                    print(f"[CDP 热重载响应] {result}")
                    return True
    except Exception as err:
        print(f"[CDP 热重载异常] {err}")
        return False

def main() -> None:
    """
    主执行函数：更新样式表文件并即时触发运行时 CDP 热重载注入。

    :return: None
    :raises SystemExit: 当关键步骤失败时退出
    """
    print(">>> 正在更新主题样式表...")
    updated = update_css_file(CSS_PATH)
    if not updated:
        sys.exit(1)

    with open(CSS_PATH, "r", encoding="utf-8") as f:
        latest_css = f.read()

    print(">>> 正在连接本地 CDP 实例 (端口 9335)...")
    ws_url = get_page_ws_url()
    if not ws_url:
        print("未获取到活跃页面 WebSocket 地址，请确认 Codex / ChatGPT 正在运行。")
        return

    print(f"锁定渲染页面: {ws_url}")
    print(">>> 正在下发热重载指令...")
    asyncio.run(hot_reload_theme(ws_url, latest_css))
    print(">>> 主题热重载完成！")

if __name__ == "__main__":
    main()
