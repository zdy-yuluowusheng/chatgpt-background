"""
Inspect the exact innerHTML and child elements of the first few shortcut rows.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Examine the DOM structure and computed styles of items inside the shortcuts card.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        const card = document.querySelector('div.rounded-2xl.overflow-hidden.border.border-default');
        if (!card) return { error: '未找到快捷键卡片容器' };

        const items = Array.from(card.children).slice(0, 5);
        return items.map((item, idx) => {
            const allDescendants = Array.from(item.querySelectorAll('*')).map(el => {
                const cs = window.getComputedStyle(el);
                return {
                    tag: el.tagName,
                    className: el.className,
                    text: el.innerText,
                    color: cs.color,
                    opacity: cs.opacity,
                    visibility: cs.visibility,
                    display: cs.display,
                    fontSize: cs.fontSize,
                    rect: el.getBoundingClientRect()
                };
            });
            return {
                idx,
                itemClass: item.className,
                itemRect: item.getBoundingClientRect(),
                outerHTML: item.outerHTML.slice(0, 300),
                descendantsCount: allDescendants.length,
                descendants: allDescendants
            };
        });
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Items:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
