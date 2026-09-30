"""
切换回图组总览.html并截取最终交付验收截图。
"""
import asyncio
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def switch_back_to_html_preview() -> None:
    """
    切换回图组总览.html预览，并保存最终验收效果图。

    :return: None
    :raises Exception: 当操作失败时抛出
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        return

    click_script = """
    (() => {
        const tab = document.getElementById('app-shell-tab-app-shell-tab:1');
        if (tab) {
            tab.click();
            return true;
        }
        return false;
    })()
    """
    await evaluate_script(ws_url, click_script)
    await asyncio.sleep(1.0)

    out_img = r"d:\work\chatgpt-background\验收_图组总览全景透明最终交付图.png"
    await capture_screen(ws_url, out_img)
    print(f"最终交付图已保存: {out_img}")

if __name__ == "__main__":
    asyncio.run(switch_back_to_html_preview())
