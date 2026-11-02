"""
Switch to Usage and Billing, capture screenshot, and inspect all elements.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Switch to billing tab and inspect elements.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    # 点击使用情况和计费
    click_script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const tabEl = all.find(el => el.children.length === 0 && el.textContent.trim() === '使用情况和计费');
        if (!tabEl) return { error: '未找到使用情况和计费' };
        const clickable = tabEl.closest('button, [role="tab"], div.sidebar-item') || tabEl;
        clickable.click();
        return { success: true };
    })()
    """
    await evaluate_script(ws_url, click_script)
    await asyncio.sleep(0.8)

    # 截图
    screenshot_path = r"d:\work\chatgpt-background\验收_使用情况和计费当前效果.png"
    await capture_screen(ws_url, screenshot_path)
    print(f"Billing screenshot saved to: {screenshot_path}")

    # 探查使用情况和计费中所有具有非透明背景、边框、阴影或渐变的元素
    inspect_script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const elements = [];

        for (const el of all) {
            const cls = typeof el.className === 'string' ? el.className : '';
            const cs = window.getComputedStyle(el);
            const before = window.getComputedStyle(el, '::before');
            const after = window.getComputedStyle(el, '::after');
            const r = el.getBoundingClientRect();

            if (r.width > 50 && r.height > 10 && r.left > 200) {
                const hasDarkBg = cs.backgroundColor.startsWith('rgb(1') || cs.backgroundColor.startsWith('rgb(2') || cs.backgroundColor.startsWith('rgb(3');
                const hasGrad = cs.backgroundImage.includes('gradient') || after.backgroundImage.includes('gradient') || before.backgroundImage.includes('gradient');
                const hasDarkBorder = cs.borderTopColor.startsWith('rgb(0') || cs.borderBottomColor.startsWith('rgb(0');

                if (hasDarkBg || hasGrad) {
                    elements.push({
                        tag: el.tagName,
                        className: cls,
                        text: el.innerText ? el.innerText.slice(0, 40) : '',
                        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                        bg: cs.backgroundColor,
                        bgImg: cs.backgroundImage.slice(0, 50),
                        afterBgImg: after.backgroundImage.slice(0, 50),
                        beforeBgImg: before.backgroundImage.slice(0, 50)
                    });
                }
            }
        }
        return elements;
    })()
    """
    res = await evaluate_script(ws_url, inspect_script)
    print("Billing elements:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
