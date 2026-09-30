/**
 * @file 测试样式修复效果并截屏.mjs
 * @description 针对用户反馈的三个问题注入修复样式，并分别截取初始主页和会话页面的截图验证效果。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取主窗口 WebSocket 地址
 * @param {number} port 
 * @returns {Promise<string>}
 */
async function getMainTargetWs(port = 9335) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && !t.url.includes('initialRoute'));
  if (!page) throw new Error('未找到主渲染窗口');
  return page.webSocketDebuggerUrl;
}

/**
 * 主执行函数
 */
async function main() {
  const wsUrl = await getMainTargetWs();
  const ws = new WebSocket(wsUrl);

  const fixCss = `
    /* ================= 针对 3 个问题的专门修复样式 ================= */
    
    /* 1. 额度限制卡片（主页与会话页中统一样式） */
    aside[role="status"],
    aside[class*="_banner_"] {
        background-color: rgba(18, 24, 28, 0.48) !important;
        background: rgba(18, 24, 28, 0.48) !important;
        backdrop-filter: blur(20px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(140%) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
        border-radius: 28px !important;
    }

    aside[role="status"] button,
    aside[class*="_banner_"] button {
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
    }

    /* 额度卡片内'重置使用量'按钮微光胶囊 */
    aside[role="status"] button:not([class*="blue"]),
    aside[class*="_banner_"] button:not([class*="blue"]) {
        background-color: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        color: #ffffff !important;
    }
    aside[role="status"] button:not([class*="blue"]):hover,
    aside[class*="_banner_"] button:not([class*="blue"]):hover {
        background-color: rgba(255, 255, 255, 0.16) !important;
        border-color: rgba(255, 255, 255, 0.28) !important;
    }

    /* 额度卡片内'升级'按钮高光半透明蓝色胶囊 */
    aside[role="status"] button[class*="blue"],
    aside[class*="_banner_"] button[class*="blue"] {
        background-color: rgba(30, 100, 220, 0.35) !important;
        border: 1px solid rgba(120, 180, 255, 0.35) !important;
        box-shadow: 0 2px 12px rgba(0, 100, 255, 0.25) !important;
        color: #e5f3ff !important;
    }
    aside[role="status"] button[class*="blue"]:hover,
    aside[class*="_banner_"] button[class*="blue"]:hover {
        background-color: rgba(30, 120, 255, 0.50) !important;
        border-color: rgba(150, 200, 255, 0.50) !important;
    }

    /* 2. 初始界面中输入框上方选择项目、分支条 */
    div[data-composer-rail] {
        background: transparent !important;
        background-color: transparent !important;
        border-color: transparent !important;
    }

    :is([data-composer-rail-item], div[class*="_item_1hrlq_"], div[class*="bg-background-composer-action-bar"]) {
        background-color: rgba(14, 22, 19, 0.28) !important;
        background: rgba(14, 22, 19, 0.28) !important;
        backdrop-filter: blur(14px) saturate(125%) brightness(108%) !important;
        -webkit-backdrop-filter: blur(14px) saturate(125%) brightness(108%) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        border-radius: 14px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
    }

    /* 分支栏内按钮悬停微光反馈 */
    :is([data-composer-rail-item], div[class*="_item_1hrlq_"]) button:hover {
        background-color: rgba(255, 255, 255, 0.12) !important;
    }

    /* 3. 彻底消除会话页面底部暗色实心背景遮罩 (恢复背景壁纸通透) */
    div[class*="pointer-events-none"][class*="inset-x-0"]:is([class*="bg-surface"], [class*="-top-8"], [class*="bottom-0"]) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
    }

    /* 以及其他可能垫在底部的实体背景 */
    [class*="thread-scroll-layout"] div:has(> [data-codex-composer-root]),
    [class*="thread-scroll-layout"] div[class*="pointer-events-none"][class*="bottom-0"] {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
    }
  `;

  ws.onopen = () => {
    // 注入测试补丁
    const injectExpr = `
      (() => {
        let styleTag = document.getElementById('__test_fix_patch__');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = '__test_fix_patch__';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = ${JSON.stringify(fixCss)};

        // 切换到“新聊天”主界面测试
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
        if (newChatBtn) newChatBtn.click();
        return true;
      })()
    `;
    ws.send(JSON.stringify({ id: 101, method: 'Runtime.evaluate', params: { expression: injectExpr, returnByValue: true } }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 101) {
      console.log('测试补丁已注入，等待页面渲染主页...');
      setTimeout(() => {
        // 截取主页面
        ws.send(JSON.stringify({ id: 102, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      }, 800);
    } else if (data.id === 102) {
      const imgPath = path.resolve(__dirname, '测试验证_图一初始主页.png');
      fs.writeFileSync(imgPath, Buffer.from(data.result.data, 'base64'));
      console.log('已保存初始主页截图:', imgPath);

      // 切换到会话页面
      const clickThreadExpr = `
        (() => {
          const items = Array.from(document.querySelectorAll('*'));
          const target = items.find(el => el.textContent && el.textContent.includes('分析专家复核差异统计') && el.children.length === 0)
                      || items.find(el => el.textContent && el.textContent.includes('整理价格分析') && el.children.length === 0);
          if (target) {
            const btn = target.closest('button, a, div[role="button"]') || target;
            btn.click();
            return true;
          }
          return false;
        })()
      `;
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 103, method: 'Runtime.evaluate', params: { expression: clickThreadExpr, returnByValue: true } }));
      }, 500);
    } else if (data.id === 103) {
      console.log('已点击会话项，等待渲染会话页...');
      setTimeout(() => {
        // 截取会话页面
        ws.send(JSON.stringify({ id: 104, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      }, 1000);
    } else if (data.id === 104) {
      const imgPath = path.resolve(__dirname, '测试验证_图二会话详情.png');
      fs.writeFileSync(imgPath, Buffer.from(data.result.data, 'base64'));
      console.log('已保存会话页面截图:', imgPath);
      ws.close();
    }
  };
}

main().catch(console.error);
