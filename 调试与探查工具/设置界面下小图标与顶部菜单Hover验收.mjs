/**
 * @file 设置界面下小图标与顶部菜单Hover验收.mjs
 * @description 导航至设置界面，分别模拟悬停在侧边栏小图标、顶部“文件”菜单与左上角返回按钮，验证透明雾化与无黑底效果并保存全套验收截图
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
        id: 1701,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1701) {
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
 * @param {string} outputPath - 截图文件绝对路径
 * @param {number} waitMs - 维持悬停等待时间（毫秒）
 * @param {number} port - 端口号
 * @returns {Promise<string>} 返回保存路径
 * @throws {Error} 截屏失败时抛出错误
 */
async function hoverAndCapture(x, y, outputPath, waitMs = 900, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 1. 移动到目标附近
      ws.send(JSON.stringify({
        id: 1702,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x: x - 5, y: y - 5 }
      }));

      // 2. 移动到中心点
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1703,
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mouseMoved', x, y }
        }));
      }, 100);

      // 3. 延迟等待浮层完全展开与毛玻璃渲染
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1704,
          method: 'Page.captureScreenshot',
          params: { format: 'png', quality: 95 }
        }));
      }, waitMs);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1704) {
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
  // 1. 导航进入设置界面
  console.log('1. 点击进入设置界面...');
  const navSettingsCode = `
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(navSettingsCode);
  await new Promise(r => setTimeout(r, 800));

  // 2. 获取资料库图标在设置界面下的坐标
  console.log('2. 获取资料库图标坐标并在设置界面下悬停...');
  const getCoordsCode = `
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (!libBtn) return null;
      const rect = libBtn.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `;
  const libCoords = await evalInCodex(getCoordsCode);
  console.log('设置界面下的资料库图标坐标:', libCoords);

  if (libCoords) {
    const outImg1 = path.resolve(__dirname, '../验收_设置界面下小图标悬停Tooltip透明雾化.png');
    await hoverAndCapture(libCoords.x, libCoords.y, outImg1, 1000);
    console.log('已生成验收截图: 验收_设置界面下小图标悬停Tooltip透明雾化.png');

    const brainPath1 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_设置界面下小图标悬停Tooltip透明雾化.png';
    fs.copyFileSync(outImg1, brainPath1);
  }

  // 3. 悬停在左上角返回按钮上并截屏
  console.log('3. 获取左上角返回按钮坐标并悬停...');
  const getBackBtnCode = `
    (() => {
      const backBtn = document.querySelector('button.button-toolbar.ms-3') || Array.from(document.querySelectorAll('button')).find(b => {
        const r = b.getBoundingClientRect();
        return r.left < 50 && r.top < 30 && b.querySelector('svg');
      });
      if (!backBtn) return null;
      const r = backBtn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `;
  const backCoords = await evalInCodex(getBackBtnCode);
  console.log('返回按钮坐标:', backCoords);

  if (backCoords) {
    const outImg2 = path.resolve(__dirname, '../验收_左上角返回按钮悬停透明雾化.png');
    await hoverAndCapture(backCoords.x, backCoords.y, outImg2, 1000);
    console.log('已生成验收截图: 验收_左上角返回按钮悬停透明雾化.png');

    const brainPath2 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_左上角返回按钮悬停透明雾化.png';
    fs.copyFileSync(outImg2, brainPath2);
  }

  // 4. 悬停在顶部“文件”菜单上并截屏
  console.log('4. 获取顶部“文件”菜单坐标并悬停...');
  const getFileMenuCode = `
    (() => {
      const f = document.querySelector('#application-menu-trigger-file-menu');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `;
  const fileCoords = await evalInCodex(getFileMenuCode);
  if (fileCoords) {
    const outImg3 = path.resolve(__dirname, '../验收_顶部菜单栏悬停透明微光.png');
    await hoverAndCapture(fileCoords.x, fileCoords.y, outImg3, 600);
    console.log('已生成验收截图: 验收_顶部菜单栏悬停透明微光.png');

    const brainPath3 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_顶部菜单栏悬停透明微光.png';
    fs.copyFileSync(outImg3, brainPath3);
  }
}

main().catch(console.error);
