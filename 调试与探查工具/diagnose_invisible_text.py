"""
Diagnose why shortcut text in Card 1 is invisible.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Inspect the exact layout, styles, clipping, and parents of the '新聊天' row.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        // 找到包含 "新聊天" 的第一个元素
        const card1 = document.querySelectorAll('div.rounded-2xl.overflow-hidden.border.border-default')[1];
        if (!card1) return { error: '未找到 Card 1' };

        const firstRow = card1.children[0];
        if (!firstRow) return { error: 'Card 1 没有子元素' };

        // 遍历 firstRow 内部所有子节点
        const nodes = Array.from(firstRow.querySelectorAll('*')).map(el => {
            const cs = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                tag: el.tagName,
                className: el.className,
                text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.childNodes[0].nodeValue : (el.children.length === 0 ? el.textContent : ''),
                rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                color: cs.color,
                bg: cs.backgroundColor,
                opacity: cs.opacity,
                visibility: cs.visibility,
                display: cs.display,
                clip: cs.clip,
                clipPath: cs.clipPath,
                mask: cs.mask || cs.webkitMask,
                filter: cs.filter,
                transform: cs.transform
            };
        });

        // 检查 firstRow 本身及其父级
        const rRow = firstRow.getBoundingClientRect();
        const csRow = window.getComputedStyle(firstRow);
        const rCard = card1.getBoundingClientRect();
        const csCard = window.getComputedStyle(card1);

        return {
            rRow: { top: rRow.top, left: rRow.left, width: rRow.width, height: rRow.height },
            csRow: {
                display: csRow.display,
                color: csRow.color,
                opacity: csRow.opacity,
                overflow: csRow.overflow
            },
            rCard: { top: rCard.top, left: rCard.left, width: rCard.width, height: rCard.height },
            nodes
        };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Diagnosis:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
