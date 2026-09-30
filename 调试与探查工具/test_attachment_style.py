"""
测试最终附件透明样式并在正常状态和悬停状态下分别截图验收。
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

async def test_and_capture_all_states(ws_url: str) -> None:
    """
    注入完整的附件透明化样式规则，分别截取默认状态和悬停状态图片。

    :param ws_url: 页面 WebSocket 地址
    :return: None
    :raises websockets.WebSocketException: 当通信异常时抛出
    """
    css_content = """
    /* 6.1 用户上传文件、附件卡片与资源胶囊（消除默认黑底，与主题背景与操作卡片统一纯透明） */
    [class*="composer-attachment-surface"],
    [class*="group/resource-card"],
    span[class*="composer-attachment-surface"],
    div[class*="composer-attachment-surface"],
    [class*="group/resource-card"][class*="bg-primary-soft"],
    [class*="extension:bg-background-primary-soft"] {
        background: transparent !important;
        background-color: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        box-shadow: none !important;
        border-radius: 16px !important;
        transition: background-color 0.15s ease, border-color 0.15s ease !important;
    }

    /* 附件卡片鼠标悬停效果：通透微光提亮 */
    [class*="composer-attachment-surface"]:hover,
    [class*="group/resource-card"]:hover,
    [class*="composer-attachment-surface"]:has(button:hover),
    [class*="group/resource-card"]:has(button:hover) {
        background: rgba(255, 255, 255, 0.08) !important;
        background-color: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(255, 255, 255, 0.28) !important;
    }

    /* 附件卡片内部文件图标底色（CSV、Excel、图片、代码等）透明化，彻底去除默认暗黑小方块 */
    [class*="composer-attachment-surface"] [class*="bg-surface-secondary"],
    [class*="group/resource-card"] [class*="bg-surface-secondary"],
    [class*="composer-attachment-surface"] [class*="size-10"],
    [class*="group/resource-card"] [class*="size-10"],
    [class*="composer-attachment-surface"] span:has(> svg),
    [class*="group/resource-card"] span:has(> svg) {
        background: rgba(255, 255, 255, 0.08) !important;
        background-color: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.10) !important;
        border-radius: 10px !important;
    }

    /* 附件内部按钮点击遮罩纯透明，避免原生 hover 引入局部灰黑层 */
    [class*="composer-attachment-surface"] button[class*="peer/resource-card"],
    [class*="group/resource-card"] button[class*="peer/resource-card"] {
        background: transparent !important;
        background-color: transparent !important;
    }
    """

    inject_js = f"""
    (() => {{
        let el = document.getElementById('__test_attachment_style__');
        if (!el) {{
            el = document.createElement('style');
            el.id = '__test_attachment_style__';
            document.head.appendChild(el);
        }}
        el.textContent = `{css_content}`;
        return true;
    }})()
    """

    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": inject_js, "returnByValue": True, "awaitPromise": True}
        }))
        await ws.recv()

        await asyncio.sleep(0.4)

        # 1. 默认状态截图
        await ws.send(json.dumps({
            "id": 2,
            "method": "Page.captureScreenshot",
            "params": {"format": "png"}
        }))
        while True:
            resp2 = json.loads(await ws.recv())
            if resp2.get("id") == 2:
                img_bytes = base64.b64decode(resp2["result"]["data"])
                with open(r"d:\work\chatgpt-background\验收_上传文件默认透明效果.png", "wb") as f:
                    f.write(img_bytes)
                print("默认状态截图已保存")
                break

        # 2. 鼠标移动到卡片上以触发 hover
        hover_js = """
        (() => {
            const card = document.querySelector('[class*="composer-attachment-surface"]');
            if (card) {
                const rect = card.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
            return null;
        })()
        """
        await ws.send(json.dumps({
            "id": 3,
            "method": "Runtime.evaluate",
            "params": {"expression": hover_js, "returnByValue": True}
        }))
        resp3 = json.loads(await ws.recv())
        pos = resp3.get("result", {}).get("result", {}).get("value")
        if pos:
            # 发送鼠标移动事件
            await ws.send(json.dumps({
                "id": 4,
                "method": "Input.dispatchMouseEvent",
                "params": {
                    "type": "mouseMoved",
                    "x": pos["x"],
                    "y": pos["y"]
                }
            }))
            await ws.recv()
            await asyncio.sleep(0.4)

            # 悬停截图
            await ws.send(json.dumps({
                "id": 5,
                "method": "Page.captureScreenshot",
                "params": {"format": "png"}
            }))
            while True:
                resp5 = json.loads(await ws.recv())
                if resp5.get("id") == 5:
                    img_bytes2 = base64.b64decode(resp5["result"]["data"])
                    with open(r"d:\work\chatgpt-background\验收_上传文件悬停微光效果.png", "wb") as f:
                        f.write(img_bytes2)
                    print("悬停状态截图已保存")
                    break

if __name__ == "__main__":
    url = get_page_ws_url()
    if url:
        asyncio.run(test_and_capture_all_states(url))
