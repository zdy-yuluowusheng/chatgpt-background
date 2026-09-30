"""
模拟在文件树中打开 README.md 并检查 Markdown 预览的 DOM 结构与背景。
"""
import asyncio
import json
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def inspect_markdown_tab() -> None:
    """
    通过 CDP 在页面中查找 README.md 树项并点击，探查打开的 Markdown 预览视图。

    :return: None
    :raises Exception: 当 WebSocket 连接或 DOM 探查异常时抛出
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("未获取到 ws_url")
        return

    # 1. 查找并点击 README.md
    click_script = """
    (() => {
        const ft = document.querySelector('file-tree-container');
        if (!ft || !ft.shadowRoot) return { success: false, reason: 'no shadowRoot' };
        
        const allButtons = Array.from(ft.shadowRoot.querySelectorAll('button'));
        const readmeBtn = allButtons.find(b => b.textContent && b.textContent.includes('README.md'));
        if (readmeBtn) {
            readmeBtn.click();
            return { success: true, text: readmeBtn.textContent };
        }
        return { success: false, buttons: allButtons.map(b => b.textContent?.trim()).slice(0, 10) };
    })()
    """
    res = await evaluate_script(ws_url, click_script)
    print("点击 README 结果:", res)

    # 等待渲染
    await asyncio.sleep(1.0)

    # 2. 检查新打开的 Tab 和 TabPanel
    check_script = """
    (() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(t => ({
            text: t.textContent?.trim(),
            selected: t.getAttribute('aria-selected'),
            id: t.id
        }));
        const panels = Array.from(document.querySelectorAll('[role="tabpanel"]:not([hidden])')).map(p => ({
            id: p.id,
            label: p.getAttribute('aria-label'),
            tabId: p.getAttribute('data-tab-id'),
            className: p.className,
            bg: window.getComputedStyle(p).backgroundColor,
            outerSnippet: p.outerHTML.slice(0, 500)
        }));
        return { tabs, panels };
    })()
    """
    check_res = await evaluate_script(ws_url, check_script)
    print("当前活动 Tab 和 Panel:", json.dumps(check_res, ensure_ascii=False, indent=2))

    # 截图
    await capture_screen(ws_url, r"d:\work\chatgpt-background\验收_Markdown文件打开状态.png")
    print("已截图保存到 验收_Markdown文件打开状态.png")

if __name__ == "__main__":
    asyncio.run(inspect_markdown_tab())
