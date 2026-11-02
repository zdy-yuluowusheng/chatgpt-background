"""
Inspect analysis components: segment toggle and table in billing view.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Inspect 7天/30天 toggle and table styling in analysis view.

    :return: None
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("No ws_url")
        return

    script = """
    (() => {
        // 1. 查找包含 "7 天" 的按钮及其容器
        const all = Array.from(document.querySelectorAll('*'));
        const day7 = all.find(e => e.children.length === 0 && e.textContent.trim() === '7 天');
        let toggleInfo = null;
        if (day7) {
            const p = day7.parentElement;
            toggleInfo = {
                btnTag: day7.tagName,
                btnClass: day7.className,
                pTag: p.tagName,
                pClass: p.className,
                pBg: window.getComputedStyle(p).backgroundColor,
                pBorder: window.getComputedStyle(p).border
            };
        }

        // 2. 查找包含 "聊天用量排行" 的表格/列表
        const tableHeader = all.find(e => e.children.length === 0 && e.textContent.trim() === '聊天');
        let tableInfo = null;
        if (tableHeader) {
            const row = tableHeader.parentElement;
            const container = row.parentElement;
            tableInfo = {
                headerTag: row.tagName,
                headerClass: row.className,
                headerBg: window.getComputedStyle(row).backgroundColor,
                containerTag: container.tagName,
                containerClass: container.className,
                containerBg: window.getComputedStyle(container).backgroundColor
            };
        }

        return { toggleInfo, tableInfo };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Components:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
