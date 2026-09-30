"""
详细探查上传附件卡片的子树结构、背景、边框及伪元素样式。
"""
import asyncio
import json
import urllib.request
import websockets
from typing import Any, Dict, Optional

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

async def dump_attachment_card(ws_url: str) -> None:
    """
    导出上传文件卡片节点及其全部子元素的样式与属性。

    :param ws_url: 页面 WebSocket URL
    :return: None
    :raises websockets.WebSocketException: 当 WebSocket 连接出现异常时抛出
    """
    js_code = """
    (() => {
        const card = document.querySelector('.composer-attachment-surface, [class*="group/resource-card"]');
        if (!card) return 'Not found';

        function dump(node) {
            const comp = window.getComputedStyle(node);
            const before = window.getComputedStyle(node, '::before');
            const after = window.getComputedStyle(node, '::after');
            return {
                tag: node.tagName.toLowerCase(),
                className: node.className,
                bg: comp.backgroundColor,
                bgImage: comp.backgroundImage,
                border: comp.border,
                borderRadius: comp.borderRadius,
                boxShadow: comp.boxShadow,
                backdropFilter: comp.backdropFilter,
                beforeBg: before.backgroundColor,
                afterBg: after.backgroundColor,
                children: Array.from(node.children).map(dump)
            };
        }
        return dump(card);
    })()
    """
    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": js_code, "returnByValue": True, "awaitPromise": True}
        }))
        resp = json.loads(await ws.recv())
        val = resp.get("result", {}).get("result", {}).get("value")
        print(json.dumps(val, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    url = get_page_ws_url()
    if url:
        print(f"连接 CDP: {url}")
        asyncio.run(dump_attachment_card(url))
    else:
        print("未找到活动窗口")
