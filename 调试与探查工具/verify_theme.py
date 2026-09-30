"""
清理临时测试节点，通过 CDP 将最新的主题 CSS 热重载至客户端，并生成正式的最终验收截图。
"""
import asyncio
import base64
import json
import urllib.request
import websockets
from typing import Optional

def get_page_ws_url() -> Optional[str]:
    """
    获取活动主窗口的 WebSocket URL。

    :return: WebSocket 调试地址，如果未找到则返回 None
    :raises urllib.error.URLError: 当无法访问 CDP 接口时抛出
    """
    req = urllib.request.urlopen("http://127.0.0.1:9335/json/list", timeout=3)
    data = json.loads(req.read().decode("utf-8"))
    for item in data:
        if item.get("type") == "page" and "initialRoute" not in item.get("url", ""):
            return item.get("webSocketDebuggerUrl")
    return None

async def reload_theme_and_capture(ws_url: str, css_file_path: str) -> None:
    """
    读取本地完整 CSS 文件，移除测试 style 节点，并将完整 CSS 挂载至正式 style 节点，截取最终效果图。

    :param ws_url: 页面 WebSocket 地址
    :param css_file_path: 主题 CSS 文件的完整本地路径
    :return: None
    :raises websockets.WebSocketException: 当通信或解析异常时抛出
    """
    with open(css_file_path, "r", encoding="utf-8") as f:
        full_css = f.read()

    js_code = f"""
    (() => {{
        // 1. 移除测试节点
        const testStyle = document.getElementById('__test_attachment_style__');
        if (testStyle) {{
            testStyle.remove();
        }}

        // 2. 更新或创建正式主题节点
        const id = '__chatgpt_codex_custom_theme_style__';
        let style = document.getElementById(id);
        if (!style) {{
            style = document.createElement('style');
            style.id = id;
            style.setAttribute('data-injected-by', 'chatgpt-background-cdp');
            (document.head || document.documentElement).appendChild(style);
        }}
        style.textContent = {json.dumps(full_css)};

        // 3. 检查卡片计算样式
        const card = document.querySelector('[class*="composer-attachment-surface"]');
        const icon = card ? card.querySelector('[class*="size-10"]') : null;
        return {{
            success: true,
            hasRule: full_css.includes('composer-attachment-surface'),
            cardBg: card ? window.getComputedStyle(card).backgroundColor : null,
            cardBorder: card ? window.getComputedStyle(card).border : null,
            iconBg: icon ? window.getComputedStyle(icon).backgroundColor : null
        }};
    }})()
    """

    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": js_code, "returnByValue": True, "awaitPromise": True}
        }))
        resp = json.loads(await ws.recv())
        result = resp.get("result", {}).get("result", {}).get("value")
        print(f"热重载执行结果: {result}")

        await asyncio.sleep(0.5)

        # 截取最终验收图
        await ws.send(json.dumps({
            "id": 2,
            "method": "Page.captureScreenshot",
            "params": {"format": "png"}
        }))
        while True:
            resp2 = json.loads(await ws.recv())
            if resp2.get("id") == 2:
                img_bytes = base64.b64decode(resp2["result"]["data"])
                out_path = r"d:\work\chatgpt-background\验收_上传文件卡片全景透明效果.png"
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                print(f"最终验收截图已保存: {out_path}")
                break

if __name__ == "__main__":
    url = get_page_ws_url()
    if url:
        asyncio.run(reload_theme_and_capture(url, r"d:\work\chatgpt-background\主题样式\晨雾森林毛玻璃主题.css"))
    else:
        print("未找到活动窗口")
