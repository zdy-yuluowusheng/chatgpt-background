"""
Audit all settings tabs for black borders, gradients, and rendering bugs.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Loop through all tabs in Settings and detect anomalies.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    # 获取所有侧边栏选项
    get_tabs_script = """
    (() => {
        const items = Array.from(document.querySelectorAll('button.sidebar-item, div.sidebar-item, [role="tab"]'))
            .filter(el => el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 20);
        return items.map((el, index) => ({
            index,
            text: el.innerText.trim().split('\\n')[0]
        }));
    })()
    """
    tabs = await evaluate_script(ws_url, get_tabs_script)
    print("Found tabs:", [t['text'] for t in tabs])

    # 针对几个核心且有代表性的 tab 进行深入检查：
    # 常规、外观、键盘快捷键、使用情况和计费、数据管理、插件、密码
    target_tabs = ["常规", "外观", "账户", "语音", "个性化", "键盘快捷键", "使用情况和计费", "数据管理", "插件"]

    results = {}

    for tab_name in target_tabs:
        click_script = f"""
        (() => {{
            const all = Array.from(document.querySelectorAll('*'));
            const el = all.find(e => e.children.length === 0 && e.textContent.trim() === '{tab_name}');
            if (!el) return {{ error: 'not found' }};
            const btn = el.closest('button, [role="tab"], div.sidebar-item') || el;
            btn.click();
            return {{ success: true }};
        }})()
        """
        await evaluate_script(ws_url, click_script)
        await asyncio.sleep(0.6)

        scan_script = """
        (() => {
            const all = Array.from(document.querySelectorAll('*'));
            const gradients = [];
            const tallCards = [];
            const darkBorders = [];
            const solidBackgrounds = [];

            for (const el of all) {
                const cls = typeof el.className === 'string' ? el.className : '';
                const cs = window.getComputedStyle(el);
                const before = window.getComputedStyle(el, '::before');
                const after = window.getComputedStyle(el, '::after');
                const r = el.getBoundingClientRect();

                // 检查渐变黑遮罩 (如 after:bg-linear-to-b after:from-surface)
                if (after.backgroundImage.includes('gradient') || before.backgroundImage.includes('gradient') || (cs.backgroundImage.includes('gradient') && el.tagName !== 'BODY')) {
                    if (r.width > 100 && r.height > 0) {
                        gradients.push({
                            tag: el.tagName,
                            className: cls,
                            rect: { top: r.top, left: r.left, width: r.width, height: r.height },
                            csGrad: cs.backgroundImage.slice(0, 60),
                            afterGrad: after.backgroundImage.slice(0, 60),
                            beforeGrad: before.backgroundImage.slice(0, 60)
                        });
                    }
                }

                // 检查高度超长的大卡片 (可能触发 backdrop-filter GPU 崩溃导致文字丢失)
                if (cs.backdropFilter !== 'none' && cs.backdropFilter !== '' && r.height > 800) {
                    tallCards.push({
                        tag: el.tagName,
                        className: cls,
                        height: r.height,
                        backdropFilter: cs.backdropFilter
                    });
                }

                // 检查是否有未处理的深色实体背景 (纯黑/深灰)
                if (cs.backgroundColor.startsWith('rgb(1') || cs.backgroundColor.startsWith('rgb(2') || cs.backgroundColor.startsWith('rgb(3') || cs.backgroundColor.startsWith('rgb(0')) {
                    // 如果不是透明的
                    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !cs.backgroundColor.includes('/ 0') && r.width > 200 && r.height > 30) {
                        solidBackgrounds.push({
                            tag: el.tagName,
                            className: cls,
                            bg: cs.backgroundColor,
                            rect: { top: r.top, left: r.left, width: r.width, height: r.height }
                        });
                    }
                }
            }

            return {
                gradients,
                tallCards,
                solidBackgrounds: solidBackgrounds.slice(0, 5)
            };
        })()
        """
        audit_res = await evaluate_script(ws_url, scan_script)
        results[tab_name] = audit_res

    print("Audit results:", json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
