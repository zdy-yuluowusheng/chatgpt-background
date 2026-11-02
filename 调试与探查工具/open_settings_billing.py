"""
Open Settings via Ctrl+, switch to '使用情况和计费', and capture screenshot.
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def send_ctrl_comma(ws_url: str) -> None:
    """
    Send Ctrl+, key event via CDP.

    :param ws_url: WebSocket URL
    :return: None
    """
    import websockets
    import json
    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        # Control down
        await ws.send(json.dumps({
            "id": 1,
            "method": "Input.dispatchKeyEvent",
            "params": {"type": "rawKeyDown", "windowsVirtualKeyCode": 17, "key": "Control", "code": "ControlLeft", "modifiers": 2}
        }))
        # Comma down
        await ws.send(json.dumps({
            "id": 2,
            "method": "Input.dispatchKeyEvent",
            "params": {"type": "keyDown", "windowsVirtualKeyCode": 188, "key": ",", "code": "Comma", "modifiers": 2}
        }))
        # Comma up
        await ws.send(json.dumps({
            "id": 3,
            "method": "Input.dispatchKeyEvent",
            "params": {"type": "keyUp", "windowsVirtualKeyCode": 188, "key": ",", "code": "Comma", "modifiers": 2}
        }))
        # Control up
        await ws.send(json.dumps({
            "id": 4,
            "method": "Input.dispatchKeyEvent",
            "params": {"type": "keyUp", "windowsVirtualKeyCode": 17, "key": "Control", "code": "ControlLeft", "modifiers": 0}
        }))
        await asyncio.sleep(0.5)

async def main() -> None:
    """
    Open Settings, navigate to '使用情况和计费', and capture screenshot.

    :return: None
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("No ws_url")
        return

    print("Sending Ctrl+, ...")
    await send_ctrl_comma(ws_url)
    await asyncio.sleep(1.0)

    # 点击使用情况和计费
    click_script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const tabEl = all.find(el => el.children.length === 0 && el.textContent.trim() === '使用情况和计费');
        if (!tabEl) return { error: '未找到使用情况和计费' };
        const clickable = tabEl.closest('button, [role="tab"], div.sidebar-item') || tabEl;
        clickable.click();
        return { success: true, text: clickable.innerText };
    })()
    """
    res = await evaluate_script(ws_url, click_script)
    print("Click result:", res)
    await asyncio.sleep(0.8)

    screenshot_path = r"d:\work\chatgpt-background\验收_使用情况和计费实测.png"
    await capture_screen(ws_url, screenshot_path)
    print(f"Screenshot saved to: {screenshot_path}")

if __name__ == "__main__":
    asyncio.run(main())
