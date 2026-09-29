/**
 * @file 生成小图标Tooltip与设置界面终极验收.mjs
 * @description 进入常规设置界面，模拟悬停在侧边栏“资料库”小图标上精确唤出透明雾化 Tooltip，并悬停顶部菜单捕获全套验收高清截图
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
 * @returns {Promise<any>} 返回表达式计算结果
 * @throws {Error} 连接失败或执行抛出异常时抛出错误
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
        id: 2001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2001) {
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
 * 通过单个 WebSocket 连接维持鼠标悬停并截屏
 * 
 * @param {number} x - 视口 X 坐标
 * @param {number} y - 视口 Y 坐标
 * @param {string} outputPath - 输出文件绝对路径
 * @param {number} waitMs - 悬停维持等待时间（毫秒）
 * @param {number} port - 端口号
 * @returns {Promise<string>} 返回保存文件路径
 * @throws {Error} 截屏失败时抛出错误
 */
async function hoverAndCapture(x, y, outputPath, waitMs = 1000, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 1. 滑入边缘
      ws.send(JSON.stringify({
        id: 2002,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x: x - 15, y: y - 15 }
      }));

      // 2. 悬停在正中心
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2003,
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mouseMoved', x, y }
        }));
      }, 100);

      // 3. 等待 Tooltip 弹出后截屏
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2004,
          method: 'Page.captureScreenshot',
          params: { format: 'png', quality: 95 }
        }));
      }, waitMs);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 2004) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
          ws.close();
          resolve(outputPath);
        } else {
          ws.close();
          reject(new Error('未收到截屏数据'));
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 主执行流程
 * 
 * @returns {Promise<void>}
 */
async function main() {
  const cssPath = path.resolve(__dirname, '../主题样式/晨雾森林毛玻璃主题.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // 1. 注入最新主题样式
  console.log('[1/4] 热注入最新晨雾森林主题样式...');
  await evalInCodex(`
    (() => {
      let tag = document.getElementById('__chatgpt_codex_custom_theme_style__') || document.getElementById('antigravity-custom-theme');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = '__chatgpt_codex_custom_theme_style__';
        document.head.appendChild(tag);
      }
      tag.textContent = ${JSON.stringify(cssContent)};
      return true;
    })()
  `);

  // 2. 打开个人资料菜单并点击设置
  console.log('[2/4] 打开个人菜单并进入常规设置...');
  const openSettingsCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (avatarBtn) {
        const rect = avatarBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: rect.top + 10, pointerId: 1, button: 0 };
        avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        avatarBtn.dispatchEvent(new MouseEvent('click', opts));
      }
      return true;
    })()
  `;
  await evalInCodex(openSettingsCode);
  await new Promise(r => setTimeout(r, 500));

  const clickSetItemCode = `
    (() => {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"], div[class*="menu"] *'));
      const setItem = allItems.find(it => (it.textContent || '').trim().startsWith('设置'));
      if (setItem) {
        const rect = setItem.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: rect.top + 10, pointerId: 1, button: 0 };
        setItem.dispatchEvent(new PointerEvent('pointerdown', opts));
        setItem.dispatchEvent(new MouseEvent('click', opts));
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(clickSetItemCode);
  await new Promise(r => setTimeout(r, 800));

  // 3. 在设置界面下悬停在左侧“资料库”图标，捕获 Tooltip 弹出的全景截图
  console.log('[3/4] 悬停资料库小图标并截取无黑底透明雾化 Tooltip...');
  const getCoordsCode = `
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (!libBtn) return null;
      const rect = libBtn.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `;
  const coords = await evalInCodex(getCoordsCode);
  console.log('资料库图标坐标:', coords);

  const pic1 = path.resolve(__dirname, '../验收_小图标悬停Tooltip内容与高光透明雾化.png');
  if (coords) {
    await hoverAndCapture(coords.x, coords.y, pic1, 1000);
    console.log('[✔ 成功] 已捕获截图1:', pic1);

    const artifactPath1 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_小图标悬停Tooltip内容与高光透明雾化.png';
    fs.copyFileSync(pic1, artifactPath1);
  }

  // 4. 探查当前页面的 Tooltip 计算样式，确保无黑底与具备毛玻璃
  const ttInfo = await evalInCodex(`
    (() => {
      const tt = document.querySelector('[role="tooltip"]');
      if (!tt) return null;
      const s = window.getComputedStyle(tt);
      return {
        text: (tt.textContent || '').trim(),
        bg: s.backgroundColor,
        backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
        border: s.border,
        boxShadow: s.boxShadow,
        borderRadius: s.borderRadius,
        color: s.color
      };
    })()
  `);
  console.log('Tooltip 实际计算样式:', JSON.stringify(ttInfo, null, 2));

  // 5. 悬停在顶部“文件”菜单上，捕获顶部应用菜单与返回区域的透明微光效果
  console.log('[4/4] 悬停顶部“文件”菜单并截取透明微光效果...');
  const fileCoords = await evalInCodex(`
    (() => {
      const f = document.querySelector('#application-menu-trigger-file-menu');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `);
  const pic2 = path.resolve(__dirname, '../验收_顶部菜单与返回按钮区域悬停透明微光.png');
  if (fileCoords) {
    await hoverAndCapture(fileCoords.x, fileCoords.y, pic2, 600);
    console.log('[✔ 成功] 已捕获截图2:', pic2);

    const artifactPath2 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_顶部菜单与返回按钮区域悬停透明微光.png';
    fs.copyFileSync(pic2, artifactPath2);
  }
}

main().catch(console.error);
