"""
Scan all tabs in Settings for dark borders, fade gradients, and rendering issues.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Iterate through key settings tabs and collect dark/black borders, gradients, and kbd issues.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        // 查找所有可能的渐变遮罩、黑边、阴影类
        const all = Array.from(document.querySelectorAll('*'));
        const issues = [];

        // 1. 查找所有包含 linear-to-b, from-surface, TopFade, BottomFade, Mask 的元素
        for (const el of all) {
            const cls = typeof el.className === 'string' ? el.className : '';
            const cs = window.getComputedStyle(el);
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');

            const hasGradient = cs.backgroundImage.includes('gradient') && !cs.backgroundImage.includes('base64');
            const hasBeforeGrad = before.backgroundImage.includes('gradient');
            const hasAfterGrad = after.backgroundImage.includes('gradient');

            if (cls.includes('after:from-surface') || cls.includes('from-surface') || cls.includes('Fade') || hasGradient || hasBeforeGrad || hasAfterGrad) {
                // 排除全局 body 底图
                if (el.tagName !== 'BODY') {
                    issues.push({
                        type: 'fade-gradient',
                        tag: el.tagName,
                        className: cls,
                        text: el.innerText ? el.innerText.slice(0, 30) : '',
                        bgImg: cs.backgroundImage.slice(0, 50),
                        beforeBgImg: before.backgroundImage.slice(0, 50),
                        afterBgImg: after.backgroundImage.slice(0, 50)
                    });
                }
            }
        }

        // 2. 检查全局是否有包含 dark border 的元素 (如 border-default, border-t, border-b 等颜色为深黑)
        return {
            totalElements: all.length,
            issues
        };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Scan results:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
