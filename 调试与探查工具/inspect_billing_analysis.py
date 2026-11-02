"""
Inspect toggle in Usage and Billing, and click '分析' to check its UI.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Inspect billing components and switch to '分析'.

    :return: None
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("No ws_url")
        return

    # 1. 检查 sticky header 及其 ::after 样式
    sticky_script = """
    (() => {
        const sticky = document.querySelector('div.bg-surface.sticky, [class*="after:from-surface"]');
        if (!sticky) return { error: 'no sticky found' };
        const cs = window.getComputedStyle(sticky);
        const after = window.getComputedStyle(sticky, '::after');
        return {
            className: sticky.className,
            bg: cs.backgroundColor,
            afterContent: after.content,
            afterBg: after.backgroundColor,
            afterBgImg: after.backgroundImage,
            afterHeight: after.height
        };
    })()
    """
    res1 = await evaluate_script(ws_url, sticky_script)
    print("Sticky info:", json.dumps(res1, ensure_ascii=False, indent=2))

    # 2. 检查 "5 小时 / 每周" 切换按钮
    toggle_script = """
    (() => {
        const btn = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.textContent.trim() === '5 小时');
        if (!btn) return { error: 'no toggle found' };
        const p = btn.parentElement;
        return {
            btnTag: btn.tagName,
            btnClass: btn.className,
            parentClass: p ? p.className : '',
            parentBg: p ? window.getComputedStyle(p).backgroundColor : ''
        };
    })()
    """
    res2 = await evaluate_script(ws_url, toggle_script)
    print("Toggle info:", json.dumps(res2, ensure_ascii=False, indent=2))

    # 3. 点击“分析”
    click_analysis = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const analysis = all.find(e => e.children.length === 0 && e.textContent.trim() === '分析');
        if (analysis) {
            analysis.click();
            return { clicked: true };
        }
        return { clicked: false };
    })()
    """
    res3 = await evaluate_script(ws_url, click_analysis)
    print("Analysis click:", res3)
    await asyncio.sleep(0.8)

    await capture_screen(ws_url, r"d:\work\chatgpt-background\验收_使用情况和计费_分析页面.png")
    print("Analysis screenshot saved")

if __name__ == "__main__":
    asyncio.run(main())
