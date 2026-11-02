"""
Find the exact element causing the dark strip in the billing page.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Search for elements in the billing view that have non-transparent background,
    box-shadow, linear-gradient, or pseudo-elements.

    :return: None
    :raises Exception: On connection or evaluation failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const pkgEl = all.find(el => el.children.length === 0 && el.textContent.includes('当前套餐'));
        if (!pkgEl) return { error: '未找到当前套餐' };

        const pkgRect = pkgEl.getBoundingClientRect();
        // 搜索在 pkgEl 上方 150px 以内且宽度大于 300px 的可见元素
        const candidates = [];

        for (const el of all) {
            const r = el.getBoundingClientRect();
            // 位于当前套餐上方，高度 > 0，宽度 > 200
            if (r.width > 200 && r.height > 0 && r.bottom <= pkgRect.top + 50 && r.top >= pkgRect.top - 200) {
                const cs = window.getComputedStyle(el);
                const before = window.getComputedStyle(el, '::before');
                const after = window.getComputedStyle(el, '::after');

                const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
                const hasBgImg = cs.backgroundImage !== 'none';
                const hasShadow = cs.boxShadow !== 'none';
                const hasBeforeBg = before.backgroundColor !== 'rgba(0, 0, 0, 0)' && before.backgroundColor !== 'transparent';
                const hasBeforeImg = before.backgroundImage !== 'none';
                const hasAfterBg = after.backgroundColor !== 'rgba(0, 0, 0, 0)' && after.backgroundColor !== 'transparent';
                const hasAfterImg = after.backgroundImage !== 'none';

                if (hasBg || hasBgImg || hasShadow || hasBeforeBg || hasBeforeImg || hasAfterBg || hasAfterImg) {
                    candidates.push({
                        tag: el.tagName,
                        className: typeof el.className === 'string' ? el.className : '',
                        id: el.id,
                        rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height },
                        bg: cs.backgroundColor,
                        bgImg: cs.backgroundImage.slice(0, 80),
                        boxShadow: cs.boxShadow,
                        beforeContent: before.content,
                        beforeBg: before.backgroundColor,
                        beforeBgImg: before.backgroundImage.slice(0, 80),
                        afterContent: after.content,
                        afterBg: after.backgroundColor,
                        afterBgImg: after.backgroundImage.slice(0, 80)
                    });
                }
            }
        }
        return candidates;
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Candidates:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
