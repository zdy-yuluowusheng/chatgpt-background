"""
Find all dark background patterns across settings.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Search for all classes with surface-secondary, bg-surface, or dark borders.

    :return: None
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("No ws_url")
        return

    script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const darkElements = [];

        for (const el of all) {
            const cls = typeof el.className === 'string' ? el.className : '';
            const cs = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();

            // 检查宽度>30、高度>15的可见元素
            if (r.width > 30 && r.height > 15 && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
                const bg = cs.backgroundColor;
                // 检查是否为深黑/深灰不透明色 (不是透明，且不是白色半透明)
                // 如 oklab 亮度低，或者 rgb 值都在 50 以下且 alpha > 0.3
                let isDarkSolid = false;
                if (bg.startsWith('rgb(')) {
                    const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    if (m) {
                        const [_, r, g, b] = m.map(Number);
                        if (r < 60 && g < 60 && b < 60) isDarkSolid = true;
                    }
                } else if (bg.startsWith('rgba(')) {
                    const m = bg.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                    if (m) {
                        const [_, r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), parseFloat(m[4])];
                        if (r < 60 && g < 60 && b < 60 && a > 0.4) isDarkSolid = true;
                    }
                } else if (bg.includes('oklab') && bg.includes('/ 0.')) {
                    const alpha = parseFloat(bg.split('/')[1]);
                    if (alpha > 0.4) isDarkSolid = true;
                }

                if (isDarkSolid || cls.includes('bg-surface-secondary') || cls.includes('after:from-surface')) {
                    // 排除 webview/iframe
                    if (el.tagName !== 'WEBVIEW' && el.tagName !== 'IFRAME') {
                        darkElements.push({
                            tag: el.tagName,
                            className: cls,
                            text: el.innerText ? el.innerText.slice(0, 30) : '',
                            bg: bg,
                            rect: { top: r.top, left: r.left, width: r.width, height: r.height }
                        });
                    }
                }
            }
        }
        return darkElements;
    })()
    """
    res = await evaluate_script(ws_url, script)
    print(f"Found {len(res)} dark elements:")
    for item in res[:20]:
        print(f"[{item['tag']}] {item['className']} (bg: {item['bg']}) text: {item['text']}")

if __name__ == "__main__":
    asyncio.run(main())
