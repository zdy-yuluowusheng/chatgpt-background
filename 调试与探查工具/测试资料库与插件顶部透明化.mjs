/**
 * @file 测试资料库与插件顶部透明化.mjs
 * @description 实时向页面注入清除 _shell_6317u_ 及其 ::before 伪元素黑底的样式，分别截取资料库与插件界面的效果图验证
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
        id: 2601,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2601) {
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
 * 截取当前主窗口高保真 PNG 画面
 * 
 * @param {string} fileName - 截图保存文件名
 * @param {number} port - 端口号
 * @returns {Promise<string>} 返回保存路径
 * @throws {Error} 截屏失败时抛出错误
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
        id: 2602,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 2602) {
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
 * 主执行流程
 * 
 * @returns {Promise<void>}
 */
async function main() {
  // 注入消除 _shell_6317u_ 及顶部吸顶黑底的测试样式
  console.log('1. 注入顶部透明化测试补丁...');
  const patchCode = `
    (() => {
      let p = document.getElementById('__test_library_patch__');
      if (!p) {
        p = document.createElement('style');
        p.id = '__test_library_patch__';
        document.head.appendChild(p);
      }
      p.textContent = \`
        /* 彻底消除资料库与插件顶部横条纯黑背景与伪元素 */
        div[class*="_shell_6317u_"],
        div[class*="_shell_6317u_"]::before,
        div[class*="_shell_6317u_"]::after,
        header[class*="_shell_6317u_"],
        div[class*="_title_6317u_"],
        div[class*="_content_6317u_"] {
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }

        /* 顶部搜索框优雅半透明微光美化 */
        div[class*="_shell_6317u_"] input {
          background-color: rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 9999px !important;
          color: #ffffff !important;
          backdrop-filter: blur(10px) !important;
        }

        /* 顶部操作按钮（如刷新、设置、网格视图切换）微光效果 */
        div[class*="_shell_6317u_"] button.button-toolbar {
          background-color: rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          backdrop-filter: blur(10px) !important;
        }

        div[class*="_shell_6317u_"] button.button-toolbar:hover {
          background-color: rgba(255, 255, 255, 0.16) !important;
        }
      \`;
      return true;
    })()
  `;
  await evalInCodex(patchCode);

  // 2. 切换到“资料库”并截屏
  console.log('2. 切换到资料库并截屏...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));
  await captureScreenshot('测试资料库顶部透明化效果.png');
  console.log('已保存: 测试资料库顶部透明化效果.png');

  // 3. 切换到“插件”并截屏
  console.log('3. 切换到插件并截屏...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));
  await captureScreenshot('测试插件顶部透明化效果.png');
  console.log('已保存: 测试插件顶部透明化效果.png');
}

main().catch(console.error);
