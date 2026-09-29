/**
 * @file 常规设置界面下悬停验收.mjs
 * @description 通过快捷键 Ctrl+, 唤起常规设置详情界面，模拟鼠标悬停在左侧小图标上触发 Tooltip 浮层，截取全景验收图
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
        id: 1901,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1901) {
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
 * 通过单个 WebSocket 连接派发移动鼠标并维持悬停，然后截屏
 * 
 * @param {number} x - 视口 X 坐标
 * @param {number} y - 视口 Y 坐标
 * @param {string} outputPath - 输出文件绝对路径
 * @param {number} waitMs - 悬停维持等待时间（毫秒）
 * @param {number} port - 端口号
 * @returns {Promise<string>}
 * @throws {Error}
 */
async function hoverAndCapture(x, y, outputPath, waitMs = 1000, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1902,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x: x - 10, y: y - 10 }
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1903,
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mouseMoved', x, y }
        }));
      }, 100);

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1904,
          method: 'Page.captureScreenshot',
          params: { format: 'png', quality: 95 }
        }));
      }, waitMs);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1904) {
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
  // 1. 通过派发快捷键或调用路由打开设置
  console.log('1. 打开设置对话框/页面...');
  await evalInCodex(`
    (() => {
      // 触发快捷键 Ctrl+,
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: ',',
        code: 'Comma',
        keyCode: 188,
        which: 188,
        ctrlKey: true,
        metaKey: true,
        bubbles: true
      }));
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // 检查是否已经在设置界面，如果没开，再点击文件菜单->设置
  const checkSettings = await evalInCodex(`
    (() => {
      const isSettings = !!document.querySelector('.group\\/settings, [class*="settings-row"], #application-menu-trigger-file-menu');
      return { isSettings, title: document.title };
    })()
  `);
  console.log('设置状态:', checkSettings);

  // 2. 获取侧边栏资料库图标并悬停
  const libCoords = await evalInCodex(`
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (!libBtn) return null;
      const r = libBtn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `);
  console.log('资料库图标坐标:', libCoords);

  if (libCoords) {
    const outImg = path.resolve(__dirname, '../验收_常规设置详情下小图标悬停Tooltip透明雾化.png');
    await hoverAndCapture(libCoords.x, libCoords.y, outImg, 1000);
    console.log('已生成验收截图:', outImg);

    const artifactPath = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_常规设置详情下小图标悬停Tooltip透明雾化.png';
    fs.copyFileSync(outImg, artifactPath);
  }
}

main().catch(console.error);
