"""
CDP 交互辅助工具，提供截图与执行 JavaScript 表达式的功能。
"""
import asyncio
import json
import base64
import urllib.request
from typing import Any, Dict, Optional

def get_page_ws_url() -> Optional[str]:
    """
    通过 HTTP 接口查询本地 CDP 端口，获取主渲染页面的 WebSocket 调试地址。

    :return: 主页面调试 WebSocket URL 或 None
    :raises urllib.error.URLError: 当无法连接本地 CDP 端口时抛出
    """
    try:
        req = urllib.request.urlopen("http://127.0.0.1:9335/json/list", timeout=3)
        data = json.loads(req.read().decode("utf-8"))
        for item in data:
            if item.get("type") == "page" and "initialRoute" not in item.get("url", ""):
                return item.get("webSocketDebuggerUrl")
    except Exception as err:
        print(f"获取 targets 异常: {err}")
    return None

async def evaluate_script(ws_url: str, expression: str) -> Any:
    """
    在指定 CDP 页面上执行 JavaScript 表达式并返回结果。

    :param ws_url: 页面 WebSocket 地址
    :param expression: JavaScript 表达式字符串
    :return: 表达式执行结果对象
    :raises Exception: 当 WebSocket 连接或执行失败时抛出
    """
    import websockets
    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        msg = {
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": True
            }
        }
        await ws.send(json.dumps(msg))
        while True:
            resp = json.loads(await ws.recv())
            if resp.get("id") == 1:
                return resp.get("result", {}).get("result", {}).get("value")

async def capture_screen(ws_url: str, output_path: str) -> bool:
    """
    通过 CDP 协议截取当前页面的渲染画面并保存为 PNG 图片。

    :param ws_url: 页面 WebSocket 地址
    :param output_path: 保存 PNG 的本地路径
    :return: 截图成功返回 True，否则返回 False
    :raises Exception: 当截图或文件写入失败时抛出
    """
    import websockets
    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        msg = {
            "id": 1,
            "method": "Page.captureScreenshot",
            "params": {"format": "png"}
        }
        await ws.send(json.dumps(msg))
        while True:
            resp = json.loads(await ws.recv())
            if resp.get("id") == 1:
                img_data = base64.b64decode(resp["result"]["data"])
                with open(output_path, "wb") as f:
                    f.write(img_data)
                return True

if __name__ == "__main__":
    url = get_page_ws_url()
    if url:
        print(f"已锁定页面: {url}")
        asyncio.run(capture_screen(url, r"d:\work\chatgpt-background\验收_当前页面状态.png"))
        print("截图已保存")
    else:
        print("未找到页面 WebSocket URL")
