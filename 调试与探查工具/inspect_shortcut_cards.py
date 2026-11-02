"""
Inspect the second card in keyboard shortcuts which has height 10504px.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Inspect the children of all cards in the keyboard shortcuts view.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        const cards = Array.from(document.querySelectorAll('div.rounded-2xl.overflow-hidden.border.border-default'));
        return cards.map((c, i) => {
            const cs = window.getComputedStyle(c);
            const firstChildren = Array.from(c.children).slice(0, 3).map(ch => {
                const chs = window.getComputedStyle(ch);
                return {
                    tag: ch.tagName,
                    className: ch.className,
                    text: ch.innerText.slice(0, 100),
                    color: chs.color,
                    bg: chs.backgroundColor,
                    rect: ch.getBoundingClientRect(),
                    html: ch.outerHTML.slice(0, 200)
                };
            });
            return {
                cardIndex: i,
                className: c.className,
                childrenCount: c.children.length,
                rect: c.getBoundingClientRect(),
                backdropFilter: cs.backdropFilter,
                filter: cs.filter,
                bg: cs.backgroundColor,
                firstChildren
            };
        });
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Cards:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
