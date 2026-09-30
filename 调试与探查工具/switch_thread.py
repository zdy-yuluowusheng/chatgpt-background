"""
切换当前 Codex 会话线程至包含指定标题的会话，并截取屏幕验证效果。
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

async def switch_and_capture(ws_url: str, thread_name: str, output_image: str) -> None:
    """
    点击侧边栏对应的会话项，并保存切换后的屏幕截图。

    :param ws_url: 页面 WebSocket 地址
    :param thread_name: 会话标题关键字
    :param output_image: 截图输出路径
    :return: None
    :raises websockets.WebSocketException: 当通信异常时抛出
    """
    js_code = f"""
    (() => {{
        const allNodes = Array.from(document.querySelectorAll('aside *'));
        for (const el of allNodes) {{
            if (el.children.length === 0 && el.textContent.includes('{thread_name}')) {{
                // 向上寻找可点击元素
                let clickTarget = el;
                while (clickTarget && clickTarget.tagName !== 'A' && clickTarget.tagName !== 'BUTTON' && !clickTarget.getAttribute('role')) {{
                    clickTarget = clickTarget.parentElement;
                }}
                if (clickTarget) {{
                    clickTarget.click();
                    return 'Clicked: ' + el.textContent.trim();
                }}
                el.click();
                return 'Clicked el directly: ' + el.textContent.trim();
            }}
        }}
        return 'Not found in aside';
    }})()
    """
    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": js_code, "returnByValue": True, "awaitPromise": True}
        }))
        resp = json.loads(await ws.recv())
        print(f"切换结果: {resp.get('result', {}).get('result', {}).get('value')}")

        await asyncio.sleep(0.8)

        await ws.send(json.dumps({
            "id": 2,
            "method": "Page.captureScreenshot",
            "params": {"format": "png"}
        }))
        while True:
            resp2 = json.loads(await ws.recv())
            if resp2.get("id") == 2:
                img_bytes = base64.b64decode(resp2["result"]["data"])
                with open(output_image, "wb") as f:
                    f.write(img_bytes)
                print(f"截图已保存: {output_image}")
                break

if __name__ == "__main__":
    url = get_page_ws_url()
    if url:
        print(f"连接 CDP: {url}")
        asyncio.run(switch_and_capture(url, "梳理统计", r"d:\work\chatgpt-background\调试与探查工具\测试切换到目标会话.png"))
    else:
        print("未找到活动窗口")
