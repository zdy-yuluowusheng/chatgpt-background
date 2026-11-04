/**
 * @file 分析下划线选择器与DOM对比.mjs
 * @description 提取 CSS 中所有带有下划线的选择器，并在当前 ChatGPT 客户端的 DOM 中检测其命中情况，找出所有因版本迭代类名变更而失效的选择器。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 从 CSS 文件中提取所有形如 [class*="_..._"] 的模式
 * 
 * @param {string} cssPath - CSS文件路径
 * @returns {Array<string>} 提取到的模式列表
 */
function extractUnderscoreSelectors(cssPath) {
  const content = fs.readFileSync(cssPath, 'utf-8');
  const regex = /\[class\*="(_[^"]+_)"\]/g;
  const matches = new Set();
  let m;
  while ((m = regex.exec(content)) !== null) {
    matches.add(m[1]);
  }
  return Array.from(matches);
}

/**
 * 在目标页面中检测这些选择器及其去掉下划线后的版本的命中情况
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {Array<string>} patterns - 待检测模式列表
 * @returns {Promise<Array<object>>} 探测结果
 * @throws {Error} 通信失败时抛出异常
 */
function auditPatternsInDom(wsUrl, patterns) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expression = `
        (() => {
          const patterns = ${JSON.stringify(patterns)};
          return patterns.map(p => {
            const rawWithUnder = '[class*="' + p + '"]';
            const cleanName = p.replace(/^_+|_+$/g, '');
            const rawClean = '[class*="' + cleanName + '"]';
            
            const matchWithUnder = document.querySelectorAll(rawWithUnder);
            const matchClean = document.querySelectorAll(rawClean);
            
            return {
              pattern: p,
              cleanName,
              underCount: matchWithUnder.length,
              cleanCount: matchClean.length,
              sampleCleanClasses: Array.from(matchClean).slice(0, 2).map(el => el.className)
            };
          });
        })()
      `;

      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve(data.result?.result?.value);
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
  const patterns = extractUnderscoreSelectors('d:/work/chatgpt-background/调试与探查工具/css_structure_temp.css');
  console.log('在主题 CSS 中提取到以下下划线模式:', patterns);

  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  const audit = await auditPatternsInDom(page.webSocketDebuggerUrl, patterns);
  console.log('\nDOM 命中对比结果:');
  console.log(JSON.stringify(audit, null, 2));
}

main();
