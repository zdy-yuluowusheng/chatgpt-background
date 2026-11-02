"""
Open settings by triggering profile avatar menu and clicking Settings.
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def main() -> None:
    """
    Trigger avatar menu and click '设置', then navigate to '使用情况和计费'.

    :return: None
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("No ws_url")
        return

    script = """
    (() => {
        // 查找左侧头像按钮
        const avatar = document.querySelector('button[aria-label="打开个人资料菜单"]') ||
            Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('LY'));
        
        if (avatar) {
            const rect = avatar.getBoundingClientRect();
            const opts = { bubbles: true, cancelable: true, clientX: rect.x + 10, clientY: rect.y + 10, pointerId: 1, button: 0 };
            avatar.dispatchEvent(new PointerEvent('pointerdown', opts));
            avatar.dispatchEvent(new MouseEvent('mousedown', opts));
            avatar.dispatchEvent(new PointerEvent('pointerup', opts));
            avatar.dispatchEvent(new MouseEvent('mouseup', opts));
            avatar.dispatchEvent(new MouseEvent('click', opts));
            return { foundAvatar: true };
        }
        return { foundAvatar: false };
    })()
    """
    res1 = await evaluate_script(ws_url, script)
    print("Avatar click:", res1)
    await asyncio.sleep(0.5)

    click_set_script = """
    (() => {
        const allItems = Array.from(document.querySelectorAll('[role="menuitem"], div[role="menu"] *'));
        const setItem = allItems.find(it => (it.textContent || '').trim().startsWith('设置'));
        if (setItem) {
            setItem.click();
            return { foundSet: true, text: setItem.innerText };
        }
        return { foundSet: false, items: allItems.map(i => i.innerText).slice(0, 10) };
    })()
    """
    res2 = await evaluate_script(ws_url, click_set_script)
    print("Settings click:", res2)
    await asyncio.sleep(0.8)

    # 点击使用情况和计费
    billing_script = """
    (() => {
        const all = Array.from(document.querySelectorAll('*'));
        const tabEl = all.find(el => el.children.length === 0 && el.textContent.trim() === '使用情况和计费');
        if (tabEl) {
            const clickable = tabEl.closest('button, [role="tab"], div.sidebar-item') || tabEl;
            clickable.click();
            return { foundBilling: true };
        }
        return { foundBilling: false };
    })()
    """
    res3 = await evaluate_script(ws_url, billing_script)
    print("Billing click:", res3)
    await asyncio.sleep(0.8)

    await capture_screen(ws_url, r"d:\work\chatgpt-background\验收_使用情况和计费当前真实界面.png")
    print("Screenshot captured")

if __name__ == "__main__":
    asyncio.run(main())
