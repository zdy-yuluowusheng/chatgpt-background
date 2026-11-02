"""
Switch to Keyboard Shortcuts tab, capture screenshot, and inspect DOM/styles.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Click '键盘快捷键' tab, capture screenshot, and inspect element styles.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    # 点击包含“键盘快捷键”的选项
    click_script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const tabEl = all.find(el => el.children.length === 0 && el.textContent.trim() === '键盘快捷键');
        if (!tabEl) return { error: '未找到键盘快捷键选项' };
        
        const clickable = tabEl.closest('button, [role="tab"], div.sidebar-item, a') || tabEl;
        clickable.click();
        return { success: true, clickedTag: clickable.tagName, clickedText: clickable.innerText };
    })()
    """
    click_res = await evaluate_script(ws_url, click_script)
    print("Click result:", click_res)

    # 等待界面切换渲染
    await asyncio.sleep(1.0)

    # 截图
    screenshot_path = r"d:\work\chatgpt-background\验收_快捷键界面当前效果.png"
    await capture_screen(ws_url, screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

    # 检查快捷键界面的 DOM 结构和文本/按键样式
    inspect_script = """
    (() => {
        // 查找所有快捷键按键元素，例如 kbd, span, div 等
        const kbds = Array.from(document.querySelectorAll('kbd, key, [class*="key"], [data-key]'));
        const all = Array.from(document.querySelectorAll('*'));

        // 找包含快捷键内容的容器
        const shortcutRows = all.filter(el => {
            const t = el.innerText || '';
            return (t.includes('Ctrl') || t.includes('Alt') || t.includes('Shift') || t.includes('⌘') || t.includes('Enter')) && el.children.length > 0 && el.children.length < 10;
        }).slice(0, 15).map(el => {
            const cs = window.getComputedStyle(el);
            const childrenInfo = Array.from(el.children).map(c => {
                const ccs = window.getComputedStyle(c);
                return {
                    tag: c.tagName,
                    text: c.innerText,
                    color: ccs.color,
                    bg: ccs.backgroundColor,
                    opacity: ccs.opacity,
                    visibility: ccs.visibility,
                    display: ccs.display,
                    className: c.className
                };
            });
            return {
                tag: el.tagName,
                text: el.innerText,
                className: el.className,
                color: cs.color,
                bg: cs.backgroundColor,
                children: childrenInfo
            };
        });

        // 查找所有 kbd 元素及其计算样式
        const kbdDetails = Array.from(document.querySelectorAll('kbd')).slice(0, 10).map(k => {
            const cs = window.getComputedStyle(k);
            return {
                tag: k.tagName,
                text: k.innerText,
                color: cs.color,
                bg: cs.backgroundColor,
                border: cs.border,
                boxShadow: cs.boxShadow,
                opacity: cs.opacity,
                className: k.className,
                parentTag: k.parentElement ? k.parentElement.tagName : '',
                parentClass: k.parentElement ? k.parentElement.className : ''
            };
        });

        return {
            totalKbds: document.querySelectorAll('kbd').length,
            kbdDetails,
            shortcutRows: shortcutRows.slice(0, 5)
        };
    })()
    """
    inspect_res = await evaluate_script(ws_url, inspect_script)
    print("Shortcuts DOM Inspection:", json.dumps(inspect_res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
