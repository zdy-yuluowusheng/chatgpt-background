"""
Capture screenshots of various settings tabs to visually verify their appearance.
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Capture screenshots of settings tabs: 常规, 外观, 账户, 数据管理.

    :return: None
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("No ws_url")
        return

    tabs_to_check = ["常规", "外观", "账户", "数据管理"]
    for tab in tabs_to_check:
        click_script = f"""
        (() => {{
            const all = Array.from(document.querySelectorAll('*'));
            const el = all.find(e => e.children.length === 0 && e.textContent.trim() === '{tab}');
            if (!el) return {{ error: 'not found' }};
            const btn = el.closest('button, [role="tab"], div.sidebar-item') || el;
            btn.click();
            return {{ success: true }};
        }})()
        """
        await evaluate_script(ws_url, click_script)
        await asyncio.sleep(0.6)
        path = f"d:\\work\\chatgpt-background\\验收_排查_{tab}界面.png"
        await capture_screen(ws_url, path)
        print(f"Captured {tab} to {path}")

if __name__ == "__main__":
    asyncio.run(main())
