/**
 * @file 全面验收图一与图二效果.mjs
 * @description 清理临时调试标签，使用正式注入的晨雾森林毛玻璃主题样式，依次截取图一（侧边栏与个人菜单）和图二（设置详情卡片）的高清渲染图以供用户验收
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
        id: 9331,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9331) {
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
 * 截取高保真 PNG 渲染画面
 * 
 * @param {string} fileName - 保存的目标文件名
 * @param {number} port - 端口
 * @returns {Promise<string>} 返回保存的文件完整路径
 * @throws {Error}
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
        id: 9332,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9332) {
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
 * 执行两阶段全面验收截屏
 * 
 * @returns {Promise<void>}
 */
async function main() {
  console.log('[1/4] 清理所有临时调试标签，验证正式主题样式注入...');
  const cleanCode = `
    (() => {
      const testTag = document.getElementById('__test_patch_style__');
      if (testTag) testTag.remove();

      // 确认正式主题样式标签存在
      const officialStyle = document.getElementById('__chatgpt_codex_custom_theme_style__');
      return { officialStyleExists: !!officialStyle, length: officialStyle ? officialStyle.textContent.length : 0 };
    })()
  `;
  const cleanRes = await evalInCodex(cleanCode);
  console.log('主题状态:', cleanRes);

  // 2. 如果在设置或子页面，先返回主页
  console.log('[2/4] 返回主页面并展开个人资料菜单（图一）...');
  const navHomeAndOpenMenu = `
    (() => {
      // 若有返回箭头按钮先返回主页
      const backBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const r = b.getBoundingClientRect();
        return r.left < 50 && r.top < 30 && b.querySelector('svg');
      });
      if (backBtn) backBtn.click();
      return true;
    })()
  `;
  await evalInCodex(navHomeAndOpenMenu);
  await new Promise(r => setTimeout(r, 600));

  // 展开个人资料菜单
  const triggerAvatarCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (avatarBtn) {
        const rect = avatarBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 };
        avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        avatarBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        avatarBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        avatarBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        avatarBtn.dispatchEvent(new MouseEvent('click', opts));
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(triggerAvatarCode);
  await new Promise(r => setTimeout(r, 600));

  const pic1Path = await captureScreenshot('验收_图一侧边栏图标与个人菜单透明雾化.png');
  console.log(`[✔ 完成] 已成功截取图一: ${pic1Path}`);

  // 3. 点击菜单中的“设置”，进入设置界面并滚动到顶部（图二）
  console.log('[3/4] 点击打开设置界面并置顶详情面板（图二）...');
  const openSettingsAndScroll = `
    (() => {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"], div[class*="menu"] *'));
      const setItem = allItems.find(it => (it.textContent || '').trim().startsWith('设置'));
      if (setItem) {
        const rect = setItem.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: rect.top + 10, pointerId: 1, button: 0 };
        setItem.dispatchEvent(new PointerEvent('pointerdown', opts));
        setItem.dispatchEvent(new MouseEvent('mousedown', opts));
        setItem.dispatchEvent(new PointerEvent('pointerup', opts));
        setItem.dispatchEvent(new MouseEvent('mouseup', opts));
        setItem.dispatchEvent(new MouseEvent('click', opts));
        return true;
      }
      return false;
    })()
  `;
  const setOpened = await evalInCodex(openSettingsAndScroll);
  console.log('点击设置项:', setOpened);
  await new Promise(r => setTimeout(r, 800));

  // 滚动到顶部
  const scrollToTop = `
    (() => {
      const scrollContainer = document.querySelector('div.flex-1.scrollbar-stable.overflow-y-auto') ||
                              document.querySelector('[data-app-shell-focus-area="main"] .overflow-y-auto');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(scrollToTop);
  await new Promise(r => setTimeout(r, 400));

  const pic2Path = await captureScreenshot('验收_图二设置界面各菜单详情透明雾化.png');
  console.log(`[✔ 完成] 已成功截取图二: ${pic2Path}`);
}

main().catch(console.error);
