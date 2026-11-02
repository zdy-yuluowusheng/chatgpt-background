"""
Inspect settings and keyboard shortcuts in ChatGPT/Codex via CDP.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Main function to inspect DOM elements for settings tabs, billing, and shortcuts.

    :return: None
    :raises Exception: On connection or evaluation failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    # 1. 抓取当前页面所有侧边栏选项卡
    script = """
    (() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a, [data-testid]')).map(el => ({
            tag: el.tagName,
            role: el.getAttribute('role'),
            text: el.innerText ? el.innerText.trim() : '',
            id: el.id,
            className: el.className,
            testId: el.getAttribute('data-testid')
        })).filter(x => x.text && x.text.length < 30);
        return {
            title: document.title,
            tabs: tabs.slice(0, 50)
        };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Tabs / Nav:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
