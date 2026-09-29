/**
 * @file 资料库与插件透明化全面验收.mjs
 * @description 清理临时调试补丁，热注入正式主题样式，分别导航至资料库与插件页面截取高保真透明化验收图片
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
        id: 2801,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2801) {
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
        id: 2802,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 2802) {
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
  const cssPath = path.resolve(__dirname, '../主题样式/晨雾森林毛玻璃主题.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // 1. 清理临时标签并注入正式主题
  console.log('1. 清理测试补丁并热加载正式主题样式...');
  await evalInCodex(`
    (() => {
      const testTag = document.getElementById('__test_library_patch__');
      if (testTag) testTag.remove();

      let styleTag = document.getElementById('__chatgpt_codex_custom_theme_style__') || document.getElementById('antigravity-custom-theme');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = '__chatgpt_codex_custom_theme_style__';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = ${JSON.stringify(cssContent)};
      return { success: true, length: styleTag.textContent.length };
    })()
  `);

  // 2. 导航至资料库 (builtin:library) 并截屏
  console.log('2. 导航至资料库 (Library)...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const pic1 = await captureScreenshot('验收_资料库页面顶部全景透明化.png');
  console.log('[✔ 成功] 已保存资料库验收图:', pic1);

  const artifact1 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_资料库页面顶部全景透明化.png';
  fs.copyFileSync(pic1, artifact1);

  // 3. 导航至插件 (builtin:customize) 并截屏
  console.log('3. 导航至插件 (Customize)...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const pic2 = await captureScreenshot('验收_插件页面顶部全景透明化.png');
  console.log('[✔ 成功] 已保存插件验收图:', pic2);

  const artifact2 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_插件页面顶部全景透明化.png';
  fs.copyFileSync(pic2, artifact2);
}

main().catch(console.error);
