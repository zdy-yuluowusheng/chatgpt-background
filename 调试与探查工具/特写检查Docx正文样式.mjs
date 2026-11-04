/**
 * @file 特写检查Docx正文样式.mjs
 * @description 获取 section.codex-docx-preview 内部元素的具体样式并截取该区域的高清局部图
 * @author Antigravity
 */

import fs from 'fs';

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在目标 WebSocket 上执行指令
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} method - CDP 方法名
 * @param {object} params - 参数对象
 * @returns {Promise<any>} 执行结果
 * @throws {Error} 通信失败或超时
 */
function sendCdpCommand(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`CDP ${method} 超时`));
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve(data.result);
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      ws.close();
      reject(err);
    };
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>} 无返回值
 */
async function main() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const targets = await res.json();
  const mainPage = targets.find(t => t.type === 'page' && t.url.includes('index.html'));

  const inspectExpr = `
    (() => {
      const sec = document.querySelector('section.codex-docx-preview');
      if (!sec) return { error: '未找到 section.codex-docx-preview' };

      const csSec = window.getComputedStyle(sec);
      const article = sec.querySelector('article');
      const csArt = article ? window.getComputedStyle(article) : {};

      // 找到前几个子元素，比如 h1, h2, p, table, td, span
      const sampleEls = Array.from(sec.querySelectorAll('h1, h2, h3, p, td, tr, table, span')).slice(0, 15).map(el => {
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: el.className,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          color: cs.color,
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
          lineHeight: cs.lineHeight,
          filter: cs.filter,
          bdf: cs.backdropFilter,
          opacity: cs.opacity,
          transform: cs.transform,
          zoom: cs.zoom,
          textShadow: cs.textShadow,
          text: (el.innerText || '').substring(0, 25)
        };
      });

      return {
        secStyle: {
          zoom: csSec.zoom,
          transform: csSec.transform,
          filter: csSec.filter,
          bdf: csSec.backdropFilter,
          overflow: csSec.overflow,
          width: csSec.width,
          height: csSec.height,
          cssVars: {
            previewZoom: csSec.getPropertyValue('--codex-docx-preview-zoom')
          }
        },
        sampleEls,
        secOuterHTMLSnippet: sec.outerHTML.substring(0, 800)
      };
    })()
  `;

  const inspectResult = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: inspectExpr,
    returnByValue: true
  });
  console.log(JSON.stringify(inspectResult?.result?.value, null, 2));

  // 截取右侧局部特写
  const clipScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 630,
      y: 180,
      width: 620,
      height: 600,
      scale: 1
    }
  });

  if (clipScreenshot?.data) {
    const savePath = 'd:\\work\\chatgpt-background\\调试与探查工具\\验收_Docx预览正文特写.png';
    fs.writeFileSync(savePath, Buffer.from(clipScreenshot.data, 'base64'));
    console.log(`局部特写已保存至: ${savePath}`);
  }
}

main().catch(console.error);
