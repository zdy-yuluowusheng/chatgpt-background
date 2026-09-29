/**
 * @file 测试雾化样式效果.mjs
 * @description 动态注入精调后的高雅雾化透明 CSS 规则，分别验证主页侧边栏图标、个人菜单与设置界面的实际渲染效果并截屏
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 在目标页面执行 JavaScript 脚本并获取结果
 * 
 * @param {string} expr - JavaScript 表达式
 * @param {number} port - 端口号
 * @returns {Promise<any>}
 * @throws {Error}
 */
async function evalInCodex(expr, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  if (!target) throw new Error('未找到主窗口');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 9501,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9501) {
        ws.close();
        if (msg.result?.exceptionDetails) {
          reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        } else {
          resolve(msg.result?.result?.value);
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 截取页面截图并保存
 * 
 * @param {string} fileName - 截图保存路径
 * @param {number} port - 端口
 * @returns {Promise<string>}
 */
async function captureScreenshot(fileName, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  const outputPath = path.resolve(__dirname, fileName);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 9502,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9502) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
          ws.close();
          resolve(outputPath);
        } else {
          ws.close();
          reject(new Error('未收到截图数据'));
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 主验证流程
 */
async function main() {
  const refinedCss = `
    /* ===== 1. 侧边栏任务栏图标：消除黑底，定制高雅雾化透明与微光反馈 ===== */
    /* 彻底清除侧边栏图标默认的实体深黑底色与 ::before / ::after 伪元素遮罩 */
    aside.app-shell-left-panel button,
    [data-app-shell-sidebar-root] button,
    nav[class*="sidebar-rail"] button,
    button[data-sidebar-destination],
    button[data-slot="popover-trigger"],
    button[class*="_Button_f5tnh_2"] {
      background-color: transparent !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    aside.app-shell-left-panel button::before,
    aside.app-shell-left-panel button::after,
    [data-app-shell-sidebar-root] button::before,
    [data-app-shell-sidebar-root] button::after,
    nav[class*="sidebar-rail"] button::before,
    nav[class*="sidebar-rail"] button::after,
    button[data-sidebar-destination]::before,
    button[data-sidebar-destination]::after,
    button[class*="_Button_f5tnh_2"]::before,
    button[class*="_Button_f5tnh_2"]::after {
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: none !important;
    }

    /* 侧边栏图标悬停 (Hover) 时的通透微光雾化效果 */
    aside.app-shell-left-panel button:hover,
    [data-app-shell-sidebar-root] button:hover,
    nav[class*="sidebar-rail"] button:hover,
    button[data-sidebar-destination]:hover,
    button[class*="_Button_f5tnh_2"]:hover {
      background: rgba(255, 255, 255, 0.12) !important;
      background-color: rgba(255, 255, 255, 0.12) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 12px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
      transition: all 0.18s ease-out !important;
    }

    /* 侧边栏图标选中 / 激活 / 点击 (Active / Selected) 时的通透雾化高亮效果 */
    aside.app-shell-left-panel button:active,
    [data-app-shell-sidebar-root] button:active,
    nav[class*="sidebar-rail"] button:active,
    button[data-sidebar-destination]:active,
    button[class*="_Button_f5tnh_2"]:active,
    aside.app-shell-left-panel button[data-selected],
    [data-app-shell-sidebar-root] button[data-selected],
    nav[class*="sidebar-rail"] button[data-selected],
    button[data-sidebar-destination][data-selected],
    button[class*="_Button_f5tnh_2"][data-selected],
    aside.app-shell-left-panel button[data-state="open"],
    [data-app-shell-sidebar-root] button[data-state="open"],
    nav[class*="sidebar-rail"] button[data-state="open"],
    button[data-sidebar-destination][data-state="open"],
    button[class*="_Button_f5tnh_2"][data-state="open"],
    aside.app-shell-left-panel button[aria-current="page"],
    button[data-sidebar-destination][aria-current="page"] {
      background: rgba(255, 255, 255, 0.18) !important;
      background-color: rgba(255, 255, 255, 0.18) !important;
      backdrop-filter: blur(16px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
      border: 1px solid rgba(255, 255, 255, 0.24) !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.25) !important;
      color: #ffffff !important;
    }

    /* ===== 2. 弹窗、个人资料用量浮层与上下文菜单：透明雾化毛玻璃 ===== */
    [role="menu"],
    [role="dialog"],
    [data-radix-popper-content-wrapper] > div,
    div[class*="_Popover_"],
    div[data-radix-menu-content] {
      background-color: rgba(18, 24, 30, 0.52) !important;
      backdrop-filter: blur(28px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
      border-radius: 16px !important;
    }

    /* 菜单内部列表项悬停高亮 */
    [role="menuitem"]:hover,
    [role="option"]:hover,
    [role="menuitem"][data-highlighted],
    [data-radix-popper-content-wrapper] [role="menuitem"]:hover,
    [data-radix-popper-content-wrapper] [role="menuitem"][data-highlighted] {
      background-color: rgba(255, 255, 255, 0.12) !important;
      border-radius: 10px !important;
      transition: background-color 0.15s ease !important;
    }

    /* ===== 3. 设置界面：消除右侧主体实体黑底，所有菜单详情卡片全部透明雾化 ===== */
    /* 设置右侧整体容器穿透透明 */
    div.electron\\:bg-surface,
    div[class*="electron:bg-surface"],
    div[class*="_shell_6317u_2"],
    div[class*="_content_6317u_2"],
    [data-app-shell-focus-area="main"] > div {
      background-color: transparent !important;
      background: transparent !important;
    }

    /* 设置界面内所有详情分组卡片（权限、常规、通知、快捷键等所有子页面卡片） */
    .group\\/settings div.rounded-2xl:has([class*="settings-row"]),
    div[class*="group/settings"] div.rounded-2xl:has([class*="settings-row"]),
    section div.rounded-2xl:has([class*="settings-row"]),
    div.rounded-2xl.overflow-hidden.border.border-default,
    div.rounded-2xl:has(> [class*="@container/settings-row"]),
    div[class*="group-data-[density=compact]/settings"].rounded-2xl {
      background-color: rgba(255, 255, 255, 0.05) !important;
      backdrop-filter: blur(20px) saturate(160%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 16px !important;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
    }

    /* 确保卡片内部各行保持纯透明，消除行内多余的子级背景 */
    [class*="@container/settings-row"],
    [class*="settings-row"],
    [class*="settings-row"] > div {
      background-color: transparent !important;
      background: transparent !important;
    }

    /* 设置卡片内部行之间的分割微光线 */
    div:has(> [class*="@container/settings-row"]) > *:not(:last-child)::after {
      background-color: rgba(255, 255, 255, 0.08) !important;
    }

    /* 设置卡片内的次级下拉框与按钮透明化微光 */
    div[class*="settings-row"] button[class*="button-toolbar"],
    div[class*="settings-row"] [class*="_ComposerFooterDropdown_"],
    div[class*="settings-row"] button[class*="rounded-button-toolbar"] {
      background-color: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      border-radius: 8px !important;
    }

    div[class*="settings-row"] button[class*="button-toolbar"]:hover {
      background-color: rgba(255, 255, 255, 0.16) !important;
      border-color: rgba(255, 255, 255, 0.20) !important;
    }

    /* 设置界面左侧菜单项选中与悬停微光 */
    button.sidebar-item.bg-primary-ghost-hover,
    button.sidebar-item[aria-current="page"] {
      background-color: rgba(255, 255, 255, 0.14) !important;
      border-radius: 8px !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
    }

    button.sidebar-item:hover {
      background-color: rgba(255, 255, 255, 0.08) !important;
      border-radius: 8px !important;
    }
  `;

  // 1. 注入精细调整样式
  const injectCode = `
    (() => {
      let tag = document.getElementById('__test_patch_style__');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = '__test_patch_style__';
        document.head.appendChild(tag);
      }
      tag.textContent = ${JSON.stringify(refinedCss)};
      return { success: true };
    })()
  `;
  await evalInCodex(injectCode);
  console.log('[1/2] 已注入最新精调样式');

  // 2. 截取当前设置界面
  await new Promise(r => setTimeout(r, 400));
  await captureScreenshot('雾化验证_图二设置界面_完美版.png');
  console.log('[2/2] 已截取设置界面效果图: 雾化验证_图二设置界面_完美版.png');
}

main().catch(console.error);
