"""
验收测试与截图生成脚本。
验证使用情况和计费的黑横条消除、键盘快捷键文本恢复与通透胶囊效果，并生成验收图片。
"""
import os
import sys
import json
import asyncio
from typing import Dict, Any, Optional

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

OUTPUT_DIR = r"d:\work\chatgpt-background"

async def click_tab_by_name(ws_url: str, tab_name: str) -> bool:
    """
    通过文本内容在设置侧边栏中定位并点击指定选项卡。

    :param ws_url: 页面 WebSocket 调试连接地址
    :param tab_name: 待点击的选项卡显示文本
    :return: 点击成功返回 True，未找到对应选项卡返回 False
    :raises Exception: 当 CDP 通信或执行报错时抛出异常
    """
    script = f"""
    (() => {{
        const all = Array.from(document.querySelectorAll('*'));
        const el = all.find(e => e.children.length === 0 && e.textContent.trim() === '{tab_name}');
        if (!el) return false;
        const btn = el.closest('button, [role="tab"], div.sidebar-item') || el;
        btn.click();
        return true;
    }})()
    """
    return bool(await evaluate_script(ws_url, script))

async def inspect_billing_page(ws_url: str) -> Dict[str, Any]:
    """
    探查使用情况和计费页面的顶部吸顶遮罩和切换胶囊计算样式。

    :param ws_url: 页面 WebSocket 调试连接地址
    :return: 包含遮罩背景、分段胶囊样式的诊断字典
    :raises Exception: 当页面查询异常时抛出
    """
    script = """
    (() => {
        const sticky = document.querySelector('div.bg-surface.sticky, div[class*="sticky"]');
        let stickyAfterBg = 'none';
        let stickyBg = 'none';
        if (sticky) {
            const cs = window.getComputedStyle(sticky);
            const after = window.getComputedStyle(sticky, '::after');
            stickyBg = cs.backgroundColor;
            stickyAfterBg = after.backgroundImage;
        }

        const capsules = Array.from(document.querySelectorAll('div[class*="bg-surface-secondary/92"], div.inline-grid')).map(el => {
            const cs = window.getComputedStyle(el);
            return {
                text: el.innerText.replace(/\\n/g, ' '),
                bg: cs.backgroundColor,
                backdrop: cs.backdropFilter || cs.webkitBackdropFilter
            };
        });

        return {
            stickyBg,
            stickyAfterBg,
            capsules
        };
    })()
    """
    return await evaluate_script(ws_url, script) or {}

async def inspect_shortcuts_page(ws_url: str) -> Dict[str, Any]:
    """
    探查键盘快捷键页面的卡片 backdrop-filter、可见字符总数及操作按钮状态。

    :param ws_url: 页面 WebSocket 调试连接地址
    :return: 包含卡片样式、文字恢复条数及幽灵方块检查结果的字典
    :raises Exception: 当页面查询异常时抛出
    """
    script = """
    (() => {
        const card = document.querySelector('div[class*="@container/keyboard-shortcuts"], div.rounded-2xl:has([class*="keyboard-shortcuts"])');
        let cardBackdrop = 'not found';
        let cardBg = 'not found';
        let cardHeight = 0;
        if (card) {
            const cs = window.getComputedStyle(card);
            cardBackdrop = cs.backdropFilter || cs.webkitBackdropFilter;
            cardBg = cs.backgroundColor;
            cardHeight = card.getBoundingClientRect().height;
        }

        // 收集快捷键行内的文字和按键
        const rows = Array.from(document.querySelectorAll('div[class*="settings-row"], [class*="@container/settings-row"]'));
        const visibleRows = [];
        for (const row of rows.slice(0, 15)) {
            const textEl = row.querySelector('p, span, div');
            const kbds = Array.from(row.querySelectorAll('kbd, [data-key]')).map(k => k.innerText.trim());
            if (textEl) {
                visibleRows.push({
                    title: textEl.innerText.trim(),
                    keys: kbds
                });
            }
        }

        // 检查未 hover 方形按钮是否有灰色背景
        const squareBtns = Array.from(document.querySelectorAll('div[class*="settings-row"] button[class*="aspect-square"]'));
        const ghostButtons = squareBtns.filter(b => {
            const cs = window.getComputedStyle(b);
            return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
        }).length;

        return {
            cardHeight,
            cardBackdrop,
            cardBg,
            totalRows: rows.length,
            sampleRows: visibleRows,
            ghostButtons
        };
    })()
    """
    return await evaluate_script(ws_url, script) or {}

async def run_verification() -> None:
    """
    执行完整的自动化验收工作流：依次跳转、探查、截取高清验收图。

    :return: None
    :raises Exception: 当任意环节发生严重错误时抛出异常
    """
    print(">>> 正在连接本地 CDP 调试端口...")
    ws_url = get_page_ws_url()
    if not ws_url:
        print("[错误] 未能连接到页面 WebSocket 地址")
        return

    # 1. 验证“使用情况和计费”主页面
    print(">>> 正在切换到【使用情况和计费】页面...")
    switched = await click_tab_by_name(ws_url, "使用情况和计费")
    if not switched:
        print("未直接找到【使用情况和计费】，尝试查找相关菜单...")
    await asyncio.sleep(1.0)

    billing_info = await inspect_billing_page(ws_url)
    print(f"[计费页面诊断] 顶部背景: {billing_info.get('stickyBg')}, 遮罩伪元素: {billing_info.get('stickyAfterBg')}")
    print(f"[计费胶囊诊断] 发现切换胶囊数量: {len(billing_info.get('capsules', []))}")
    for cap in billing_info.get('capsules', []):
        print(f"  胶囊文本: {cap['text']}, 背景: {cap['bg']}, 模糊: {cap['backdrop']}")

    billing_img_path = os.path.join(OUTPUT_DIR, "验收_使用情况和计费修复后效果.png")
    await capture_screen(ws_url, billing_img_path)
    print(f"[验收截图保存] {billing_img_path}")

    # 2. 尝试切换“分析”或“图表”子标签
    print(">>> 正在检查并切换【分析】子标签...")
    click_analytics_script = """
    (() => {
        const tabs = Array.from(document.querySelectorAll('button[role="tab"], div[role="tab"], button'));
        const aTab = tabs.find(t => t.innerText && t.innerText.trim() === '分析');
        if (aTab) {
            aTab.click();
            return true;
        }
        return false;
    })()
    """
    has_analytics = await evaluate_script(ws_url, click_analytics_script)
    if has_analytics:
        await asyncio.sleep(0.8)
        analytics_img_path = os.path.join(OUTPUT_DIR, "验收_用量分析表格与周期胶囊效果.png")
        await capture_screen(ws_url, analytics_img_path)
        print(f"[验收截图保存] {analytics_img_path}")
    else:
        print("未找到独立的【分析】子标签，跳过该子页面截图")

    # 3. 验证“键盘快捷键”页面
    print(">>> 正在切换到【键盘快捷键】页面...")
    await click_tab_by_name(ws_url, "键盘快捷键")
    await asyncio.sleep(1.0)

    shortcuts_info = await inspect_shortcuts_page(ws_url)
    print(f"[快捷键卡片诊断] 高度: {shortcuts_info.get('cardHeight')}px, backdrop-filter: {shortcuts_info.get('cardBackdrop')}")
    print(f"[快捷键卡片诊断] 背景底色: {shortcuts_info.get('cardBg')}, 总行数: {shortcuts_info.get('totalRows')}")
    print(f"[幽灵方块检查] 未悬停仍有背景的按钮数: {shortcuts_info.get('ghostButtons')}")
    print("[快捷键示例渲染文本]:")
    for r in shortcuts_info.get('sampleRows', []):
        print(f"  - {r['title']} : {' + '.join(r['keys'])}")

    shortcuts_img_path = os.path.join(OUTPUT_DIR, "验收_键盘快捷键文字恢复与微光效果.png")
    await capture_screen(ws_url, shortcuts_img_path)
    print(f"[验收截图保存] {shortcuts_img_path}")

    print(">>> 自动化验收与截图生成全部完成！")

if __name__ == "__main__":
    asyncio.run(run_verification())
