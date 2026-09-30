"""
切换回变更Tab并截取验收截图。
"""
import asyncio
from cdp_helper import get_page_ws_url, evaluate_script, capture_screen

async def switch_to_diff_and_capture() -> None:
    """
    点击切换到变更 (diff) Tab，验证差异对比界面的全景透明效果。

    :return: None
    :raises Exception: 当 CDP 连接失败时抛出
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("未获取到 ws_url")
        return

    click_script = """
    (() => {
        const diffTab = document.getElementById('app-shell-tab-app-shell-tab:3');
        if (diffTab) {
            diffTab.click();
            return true;
        }
        return false;
    })()
    """
    await evaluate_script(ws_url, click_script)
    await asyncio.sleep(1.0)

    out_img = r"d:\work\chatgpt-background\验收_变更面板全景透明效果.png"
    await capture_screen(ws_url, out_img)
    print(f"变更面板截图已保存: {out_img}")

if __name__ == "__main__":
    asyncio.run(switch_to_diff_and_capture())
