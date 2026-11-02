"""
Inspect the DOM elements inside the Keyboard Shortcuts view to find why content is blurred/hidden.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Inspect the shortcuts list elements, their ancestors, backgrounds, backdrop-filters, opacities, and colors.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        // 查找包含“新聊天”或“新建”的元素（快捷键列表第一项通常是新聊天 Ctrl+N）
        const all = Array.from(document.querySelectorAll('*'));
        const newChatEl = all.find(el => el.children.length === 0 && (el.textContent.includes('新聊天') || el.textContent.includes('New chat')));
        const ctrlNEl = all.find(el => el.children.length === 0 && el.textContent.includes('Ctrl+N'));

        function getInfo(el) {
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                tag: el.tagName,
                className: el.className,
                id: el.id,
                rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                color: cs.color,
                bg: cs.backgroundColor,
                bgImg: cs.backgroundImage.slice(0, 50),
                filter: cs.filter,
                backdropFilter: cs.backdropFilter,
                opacity: cs.opacity,
                visibility: cs.visibility,
                display: cs.display,
                overflow: cs.overflow,
                zIndex: cs.zIndex
            };
        }

        // 收集 ctrlNEl 的祖先链
        let ancestors = [];
        let curr = ctrlNEl || newChatEl;
        while (curr && curr !== document.body) {
            ancestors.push(getInfo(curr));
            curr = curr.parentElement;
        }

        // 查找当前屏幕中央区域的所有大卡片 (width > 400, height > 200)
        const bigCards = all.filter(el => {
            const r = el.getBoundingClientRect();
            return r.left > 300 && r.top > 150 && r.width > 400 && r.height > 200;
        }).map(el => getInfo(el));

        return {
            hasCtrlN: !!ctrlNEl,
            ctrlNInfo: getInfo(ctrlNEl),
            hasNewChat: !!newChatEl,
            newChatInfo: getInfo(newChatEl),
            ancestors: ancestors.slice(0, 15),
            bigCards: bigCards.slice(0, 10)
        };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Shortcuts detailed inspection:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
