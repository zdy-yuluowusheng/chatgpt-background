/**
 * @file 全面生成终版验收图.mjs
 * @description 模拟用户使用场景，在设置界面与主界面下触发小图标悬停 Tooltip、顶部菜单 Hover 及返回按钮悬停，捕获全套无黑底、透明雾化的高清验收截图
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
        id: 1801,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1801) {
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
 * 通过 CDP 派发连续鼠标移动以稳定触发 Hover 与 Tooltip，并捕获截图
 * 
 * @param {number} x - 视口 X 坐标
 * @param {number} y - 视口 Y 坐标
 * @param {string} outputPath - 输出文件绝对路径
 * @param {number} waitMs - 悬停维持等待时间（毫秒）
 * @param {number} port - 端口号
 * @returns {Promise<string>}
 * @throws {Error}
 */
async function hoverAndCapture(x, y, outputPath, waitMs = 900, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 1. 先滑入目标附近
      ws.send(JSON.stringify({
        id: 1802,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x: x - 10, y: y - 10 }
      }));

      // 2. 悬停在正中心
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1803,
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mouseMoved', x, y }
        }));
      }, 100);

      // 3. 延时截屏
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1804,
          method: 'Page.captureScreenshot',
          params: { format: 'png', quality: 95 }
        }));
      }, waitMs);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1804) {
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

  // 1. 注入最新样式
  console.log('1. 热注入最新样式...');
  await evalInCodex(`
    (() => {
      let tag = document.getElementById('antigravity-custom-theme');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'antigravity-custom-theme';
        document.head.appendChild(tag);
      }
      tag.textContent = ${JSON.stringify(cssContent)};
      return true;
    })()
  `);

  // 2. 点击文件菜单打开真实常规“设置”界面
  console.log('2. 打开常规设置界面...');
  await evalInCodex(`
    (() => {
      const fileBtn = document.getElementById('application-menu-trigger-file-menu');
      if (fileBtn) fileBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  await evalInCodex(`
    (() => {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const set = allItems.find(i => (i.textContent || '').includes('设置'));
      if (set) set.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  // 3. 在设置界面下，获取侧边栏“资料库”图标坐标并维持悬停
  console.log('3. 在常规设置界面下悬停“资料库”小图标...');
  const libCoords = await evalInCodex(`
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (!libBtn) return null;
      const r = libBtn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `);
  console.log('资料库图标坐标:', libCoords);

  const img1 = path.resolve(__dirname, '../验收_设置界面下小图标悬停Tooltip透明雾化.png');
  if (libCoords) {
    await hoverAndCapture(libCoords.x, libCoords.y, img1, 1000);
    console.log('已捕获截图1:', img1);

    const artifactPath1 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_设置界面下小图标悬停Tooltip透明雾化.png';
    fs.copyFileSync(img1, artifactPath1);
  }

  // 4. 探查当前页面的 Tooltip 节点计算样式
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
        color: s.color,
        boxShadow: s.boxShadow
      };
    })()
  `);
  console.log('当前页面 Tooltip 计算样式:', JSON.stringify(ttInfo, null, 2));

  // 5. 悬停在左上角返回按钮
  console.log('5. 悬停在左上角返回按钮...');
  const backCoords = await evalInCodex(`
    (() => {
      const btn = document.querySelector('button.button-toolbar.ms-3') || Array.from(document.querySelectorAll('button')).find(b => {
        const r = b.getBoundingClientRect();
        return r.left < 50 && r.top < 30 && b.querySelector('svg');
      });
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `);
  const img2 = path.resolve(__dirname, '../验收_设置界面下返回按钮悬停微光.png');
  if (backCoords) {
    await hoverAndCapture(backCoords.x, backCoords.y, img2, 900);
    console.log('已捕获截图2:', img2);

    const artifactPath2 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_设置界面下返回按钮悬停微光.png';
    fs.copyFileSync(img2, artifactPath2);
  }

  // 6. 悬停在顶部“文件”菜单上
  console.log('6. 悬停在顶部文件菜单上...');
  const fileCoords = await evalInCodex(`
    (() => {
      const f = document.querySelector('#application-menu-trigger-file-menu');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `);
  const img3 = path.resolve(__dirname, '../验收_顶部文件菜单悬停微光.png');
  if (fileCoords) {
    await hoverAndCapture(fileCoords.x, fileCoords.y, img3, 600);
    console.log('已捕获截图3:', img3);

    const artifactPath3 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_顶部文件菜单悬停微光.png';
    fs.copyFileSync(img3, artifactPath3);
  }
}

main().catch(console.error);
