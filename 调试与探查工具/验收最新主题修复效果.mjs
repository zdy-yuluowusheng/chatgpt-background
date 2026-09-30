/**
 * @file 验收最新主题修复效果.mjs
 * @description 移除所有临时补丁，全量同步最新《晨雾森林毛玻璃主题.css》，
 *              分别对初始主页与具体项目会话页截取全景高分辨率验收截图，
 *              验证三处黑底问题是否已彻底得到完美解决。
 * @author Antigravity Assistant
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeCssPath = path.resolve(__dirname, '../主题样式/晨雾森林毛玻璃主题.css');

/**
 * 获取主窗口的 CDP WebSocket 调试地址
 * 
 * @param {number} [port=9335] - 本地 CDP 调试端口号
 * @returns {Promise<string>} 成功连接时返回主页面的 WebSocket 地址
 * @throws {Error} 当网络连接失败或未找到符合条件的目标页面时抛出异常
 */
async function getMainTargetWs(port = 9335) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  if (!res.ok) throw new Error(`CDP 端点响应异常: HTTP ${res.status}`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && !t.url.includes('initialRoute'));
  if (!page) throw new Error('未找到主渲染窗口目标');
  return page.webSocketDebuggerUrl;
}

/**
 * 延迟等待指定的毫秒数
 * 
 * @param {number} ms - 需等待的毫秒数
 * @returns {Promise<void>} 延迟结束后的 Promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 执行全面的验收测试与截图流程
 * 
 * @returns {Promise<void>}
 * @throws {Error} 执行过程中遇到 WebSocket 或文件读写失败时抛出错误
 */
async function executeVerification() {
  const rawCss = fs.readFileSync(themeCssPath, 'utf8');
  const wsUrl = await getMainTargetWs();
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  console.log('[1/4] 已连接目标页面 CDP 接口，正在同步最新主题并清理临时测试补丁...');

  // 1. 同步最新 CSS 并清理任何临时测试标签
  const injectExpr = `
    (() => {
      // 清理临时测试补丁
      const tempPatch = document.getElementById('__test_fix_patch__');
      if (tempPatch) tempPatch.remove();

      // 挂载或更新全局主样式表
      const styleId = '__chatgpt_codex_custom_theme_style__';
      let tag = document.getElementById(styleId);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = styleId;
        tag.setAttribute('data-injected-by', 'chatgpt-background-cdp');
        (document.head || document.documentElement).appendChild(tag);
      }
      tag.textContent = ${JSON.stringify(rawCss)};
      return { success: true };
    })()
  `;

  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: injectExpr, returnByValue: true }
  }));

  await sleep(600);

  // 2. 切换到“新聊天”初始主界面
  console.log('[2/4] 切换至初始主界面...');
  const switchToHomeExpr = `
    (() => {
      const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
      if (newChatBtn) {
        newChatBtn.click();
        return true;
      }
      return false;
    })()
  `;
  ws.send(JSON.stringify({
    id: 2,
    method: 'Runtime.evaluate',
    params: { expression: switchToHomeExpr, returnByValue: true }
  }));

  await sleep(1000);

  // 截取初始主界面全景截图
  const homeScreenshotPromise = new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 10) {
        ws.removeEventListener('message', handler);
        resolve(msg.result?.data);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: 10, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  const homeScreenshotData = await homeScreenshotPromise;
  if (homeScreenshotData) {
    const homePath = path.resolve(__dirname, '终版验收_图一初始主界面.png');
    fs.writeFileSync(homePath, Buffer.from(homeScreenshotData, 'base64'));
    console.log(`[已保存初始主页验收图]: ${homePath}`);
  }

  // 3. 切换到具体项目会话页面
  console.log('[3/4] 切换至具体会话页面...');
  const switchToThreadExpr = `
    (() => {
      // 优先从“最近”会话列表中点击任意一个真实会话，例如“分析图片查重改造偏差与隐患”或“分析剧本角色缺口”
      const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"], div[data-app-action-sidebar-item]'));
      const threadBtn = allButtons.find(el => {
        const text = el.textContent || '';
        return text.includes('分析图片查重改造偏差与隐患') || 
               text.includes('分析专家复核差异统计') ||
               text.includes('盘点待补充的僵尸角色');
      });
      if (threadBtn) {
        threadBtn.click();
        return { clicked: true, text: threadBtn.textContent?.trim() };
      }

      // 如果未找到，尝试点击“experts_behavior_analysis”展开项目
      const projectBtn = allButtons.find(el => el.textContent && el.textContent.includes('experts_behavior_analysis'));
      if (projectBtn) {
        projectBtn.click();
        return { clickedProject: true };
      }
      return { clicked: false };
    })()
  `;
  const clickResult = await new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 3) {
        ws.removeEventListener('message', handler);
        resolve(msg.result?.result?.value);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: switchToThreadExpr, returnByValue: true }
    }));
  });

  console.log('会话点击结果:', clickResult);
  await sleep(1500);

  // 截取具体会话页面全景截图
  const threadScreenshotPromise = new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 20) {
        ws.removeEventListener('message', handler);
        resolve(msg.result?.data);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: 20, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  const threadScreenshotData = await threadScreenshotPromise;
  if (threadScreenshotData) {
    const threadPath = path.resolve(__dirname, '终版验收_图二具体会话页面.png');
    fs.writeFileSync(threadPath, Buffer.from(threadScreenshotData, 'base64'));
    console.log(`[已保存会话页面验收图]: ${threadPath}`);
  }

  console.log('[4/4] 验收完成！');
  ws.close();
}

executeVerification().catch(console.error);
