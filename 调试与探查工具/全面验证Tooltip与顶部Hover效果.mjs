/**
 * @file 全面验证Tooltip与顶部Hover效果.mjs
 * @description 实时向 Codex 注入最新的晨雾森林主题 CSS，模拟鼠标悬停小图标与顶部菜单触发 Tooltip 和 Hover 效果，探查计算样式并生成验收截图
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
        id: 1501,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1501) {
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
 * 通过 CDP Input.dispatchMouseEvent 模拟鼠标移动到指定坐标
 * 
 * @param {number} x - 视口 X 坐标
 * @param {number} y - 视口 Y 坐标
 * @param {number} port - CDP 端口
 * @returns {Promise<void>} 移动事件派发完成后 resolve
 * @throws {Error} 连接失败或派发事件异常时抛出
 */
async function moveMouseTo(x, y, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1502,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x, y }
      }));
      setTimeout(() => {
        ws.close();
        resolve();
      }, 250);
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 截取当前页面并保存为指定文件
 * 
 * @param {string} outputPath - 输出文件绝对路径
 * @param {number} port - 调试端口号
 * @returns {Promise<string>} 返回保存路径
 * @throws {Error} 截屏失败时抛出错误
 */
async function captureScreenshot(outputPath, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1503,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1503) {
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
 * 主执行函数
 * 
 * @returns {Promise<void>}
 */
async function main() {
  const cssPath = path.resolve(__dirname, '../主题样式/晨雾森林毛玻璃主题.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // 1. 将最新样式强行热注入到页面中的 #antigravity-custom-theme 节点
  console.log('1. 热注入最新主题 CSS 到 Codex 窗口...');
  const injectCode = `
    (() => {
      let styleTag = document.getElementById('antigravity-custom-theme');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'antigravity-custom-theme';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = ${JSON.stringify(cssContent)};
      return { success: true, length: styleTag.textContent.length };
    })()
  `;
  const injectResult = await evalInCodex(injectCode);
  console.log('注入结果:', injectResult);

  // 2. 获取侧边栏“资料库”图标与“主页”图标的真实位置
  console.log('2. 获取侧边栏图标坐标...');
  const getBtnCoordsCode = `
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      const homeBtn = document.querySelector('button[data-sidebar-destination="builtin:home"]');
      const settingsBtn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      
      const getCenter = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
      };
      
      return {
        library: getCenter(libBtn),
        home: getCenter(homeBtn),
        settings: getCenter(settingsBtn)
      };
    })()
  `;
  const coords = await evalInCodex(getBtnCoordsCode);
  console.log('图标坐标:', coords);

  // 3. 悬停在“资料库”小图标上并截取 Tooltip
  if (coords.library) {
    console.log('3. 模拟鼠标悬停在资料库图标上...');
    await moveMouseTo(coords.library.x, coords.library.y);
    await new Promise(r => setTimeout(r, 600));

    // 探查此时 Tooltip 计算样式
    const probeTooltipStyleCode = `
      (() => {
        const tt = document.querySelector('[role="tooltip"]');
        if (!tt) return null;
        const s = window.getComputedStyle(tt);
        return {
          id: tt.id,
          text: (tt.textContent || '').trim(),
          bg: s.backgroundColor,
          color: s.color,
          border: s.border,
          boxShadow: s.boxShadow,
          borderRadius: s.borderRadius,
          backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
          outerHTML: tt.outerHTML
        };
      })()
    `;
    const ttStyle = await evalInCodex(probeTooltipStyleCode);
    console.log('Tooltip 计算样式:', JSON.stringify(ttStyle, null, 2));

    const outPath1 = path.resolve(__dirname, '../验收_小图标悬停Tooltip与菜单透明雾化效果.png');
    await captureScreenshot(outPath1);
    console.log('已生成验收截图1: 验收_小图标悬停Tooltip与菜单透明雾化效果.png');

    // 复制一份至 brain 根目录便于 Artifact 展现
    const artifactPath1 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_小图标悬停Tooltip与菜单透明雾化效果.png';
    fs.copyFileSync(outPath1, artifactPath1);
    console.log('已同步至 Artifact 目录:', artifactPath1);
  }

  // 4. 模拟悬停在顶部“文件”菜单上，验证顶部菜单 Hover 微光
  console.log('4. 模拟悬停在顶部文件菜单上...');
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
    await moveMouseTo(fileCoords.x, fileCoords.y);
    await new Promise(r => setTimeout(r, 500));

    const probeFileHover = `
      (() => {
        const f = document.querySelector('#application-menu-trigger-file-menu');
        const s = window.getComputedStyle(f);
        return {
          bg: s.backgroundColor,
          color: s.color,
          border: s.border,
          backdropFilter: s.backdropFilter || s.webkitBackdropFilter
        };
      })()
    `;
    const fStyle = await evalInCodex(probeFileHover);
    console.log('顶部文件菜单悬停样式:', JSON.stringify(fStyle, null, 2));

    const outPath2 = path.resolve(__dirname, '../验收_顶部菜单栏与返回区域悬停透明微光效果.png');
    await captureScreenshot(outPath2);
    console.log('已生成验收截图2: 验收_顶部菜单栏与返回区域悬停透明微光效果.png');

    const artifactPath2 = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_顶部菜单栏与返回区域悬停透明微光效果.png';
    fs.copyFileSync(outPath2, artifactPath2);
    console.log('已同步至 Artifact 目录:', artifactPath2);
  }
}

main().catch(console.error);
