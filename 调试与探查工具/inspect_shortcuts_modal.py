"""
Inspect keyboard shortcuts triggers, modal DOM, and styles in ChatGPT/Codex.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Search for keyboard shortcuts in menus or dispatch shortcut to open it.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    # 1. 查找页面中所有包含“快捷键”的文本或菜单
    script1 = """
    (() => {
        // 搜索帮助菜单或者全局
        const all = Array.from(document.querySelectorAll('*'));
        const matches = all.filter(el => {
            return el.children.length === 0 && (
                el.textContent.includes('快捷键') ||
                el.textContent.includes('Shortcuts') ||
                el.textContent.includes('键盘')
            );
        }).map(el => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            parentTag: el.parentElement ? el.parentElement.tagName : '',
            parentClass: el.parentElement ? el.parentElement.className : '',
            className: el.className
        }));

        // 检查是否有 help menu trigger
        const helpBtn = document.getElementById('application-menu-trigger-help-menu');

        // 检查设置列表里的所有菜单项
        const settingsNav = Array.from(document.querySelectorAll('[role="tab"], [role="menuitem"], aside button')).map(b => b.innerText ? b.innerText.trim() : '');

        return { matches, hasHelpBtn: !!helpBtn, settingsNav };
    })()
    """
    res1 = await evaluate_script(ws_url, script1)
    print("Search result:", json.dumps(res1, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
