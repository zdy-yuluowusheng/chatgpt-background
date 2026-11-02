"""
Inspect shortcuts search bar, headers, and gradient masks across settings.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Inspect input search box in shortcuts page and sticky headers.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        const input = document.querySelector('input');
        let searchInfo = null;
        if (input) {
            const csIn = window.getComputedStyle(input);
            const p = input.parentElement;
            const csP = p ? window.getComputedStyle(p) : null;
            const pp = p ? p.parentElement : null;
            const csPP = pp ? window.getComputedStyle(pp) : null;
            searchInfo = {
                input: {
                    className: input.className,
                    bg: csIn.backgroundColor,
                    border: csIn.border,
                    color: csIn.color
                },
                parent: p ? {
                    className: p.className,
                    bg: csP.backgroundColor,
                    border: csP.border,
                    boxShadow: csP.boxShadow
                } : null,
                grandParent: pp ? {
                    className: pp.className,
                    bg: csPP.backgroundColor,
                    border: csPP.border
                } : null
            };
        }

        // 查找页面中所有的 sticky 容器或带 after/before 渐变的容器
        const all = Array.from(document.querySelectorAll('*'));
        const gradientEls = all.filter(el => {
            const cs = window.getComputedStyle(el);
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');
            const cls = typeof el.className === 'string' ? el.className : '';
            return (
                cs.backgroundImage.includes('gradient') ||
                before.backgroundImage.includes('gradient') ||
                after.backgroundImage.includes('gradient') ||
                cls.includes('bg-linear') ||
                cls.includes('after:bg-linear') ||
                cls.includes('before:bg-linear') ||
                cls.includes('sticky')
            );
        }).map(el => {
            const cs = window.getComputedStyle(el);
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');
            const r = el.getBoundingClientRect();
            return {
                tag: el.tagName,
                className: typeof el.className === 'string' ? el.className : '',
                rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                bgImg: cs.backgroundImage.slice(0, 60),
                beforeBgImg: before.backgroundImage.slice(0, 60),
                afterBgImg: after.backgroundImage.slice(0, 60)
            };
        });

        return { searchInfo, gradientEls };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Result:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
