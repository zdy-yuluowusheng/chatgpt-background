"""
Inspect DOM elements and compute styles around billing tabs and '当前套餐'.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Inspect the billing page DOM structure and identify black borders or gradient masks.

    :return: None
    :raises Exception: On connection or evaluation failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        // 找到包含 "当前套餐" 的元素
        const all = Array.from(document.querySelectorAll('*'));
        const pkgEl = all.find(el => el.children.length === 0 && el.textContent.includes('当前套餐'));
        const overviewEl = all.find(el => el.children.length === 0 && el.textContent.trim() === '概览');

        function getInfo(el) {
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');
            return {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                rect: el.getBoundingClientRect(),
                bg: cs.backgroundColor,
                bgImage: cs.backgroundImage,
                boxShadow: cs.boxShadow,
                borderTop: cs.borderTop,
                borderBottom: cs.borderBottom,
                border: cs.border,
                backdropFilter: cs.backdropFilter,
                beforeBg: before.backgroundColor,
                beforeBgImage: before.backgroundImage,
                afterBg: after.backgroundColor,
                afterBgImage: after.backgroundImage
            };
        }

        // 收集 pkgEl 的所有祖先元素及其前后的兄弟元素
        let ancestors = [];
        let curr = pkgEl;
        while (curr && curr !== document.body) {
            ancestors.push(getInfo(curr));
            curr = curr.parentElement;
        }

        // 收集 overviewEl 所在的容器和它的兄弟节点
        let overviewInfo = getInfo(overviewEl);
        let overviewParentInfo = overviewEl ? getInfo(overviewEl.parentElement) : null;
        let overviewContainer = overviewEl ? overviewEl.closest('nav, div') : null;
        let overviewContainerInfo = overviewContainer ? getInfo(overviewContainer) : null;

        // 收集所有在 Y 坐标介于 概览 和 当前套餐 之间的元素
        let yOverview = overviewEl ? overviewEl.getBoundingClientRect().bottom : 0;
        let yPkg = pkgEl ? pkgEl.getBoundingClientRect().top : 0;

        let betweenEls = all.filter(el => {
            const r = el.getBoundingClientRect();
            // 在这一横条区域内
            return r.width > 200 && r.height > 0 && r.bottom >= yOverview - 10 && r.top <= yPkg + 10;
        }).map(el => getInfo(el));

        return {
            yOverview,
            yPkg,
            ancestors,
            overviewInfo,
            overviewContainerInfo,
            betweenEls
        };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Billing DOM inspection:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
