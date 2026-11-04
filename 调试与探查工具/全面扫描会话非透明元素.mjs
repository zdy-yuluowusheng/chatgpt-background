/**
 * @file 全面扫描会话非透明元素.mjs
 * @description 遍历当前活跃 ChatGPT 会话中的所有 DOM 元素，找出所有带有非透明背景、暗色背景或渐变的元素，并输出其结构与选择器特征。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 遍历并扫描当前页面内所有非透明的 DOM 元素
 * 
 * @param {string} wsUrl - CDP WebSocket URL
 * @returns {Promise<Array<object>>} 非透明元素列表
 * @throws {Error} 通信失败时抛出异常
 */
function scanNonTransparentElements(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 扫描超时'));
    }, 10000);

    ws.onopen = () => {
      const expression = `
        (() => {
          const results = [];
          const root = document.body;
          const allEls = root.querySelectorAll('*');

          for (const el of allEls) {
            // 跳过 svg 内部元素和隐藏元素
            if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
            if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;

            const cs = window.getComputedStyle(el);
            const bg = cs.backgroundColor;
            const bgImg = cs.backgroundImage;

            // 判断是否有实际背景色（非 transparent 且非 rgba(..., 0)）
            let hasBg = false;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              hasBg = true;
            }
            if (bgImg && bgImg !== 'none') {
              hasBg = true;
            }

            if (hasBg) {
              // 收集该元素的选择器信息
              results.push({
                tag: el.tagName.toLowerCase(),
                className: el.className ? String(el.className).substring(0, 120) : '',
                id: el.id || '',
                dataset: { ...el.dataset },
                bg: bg,
                bgImg: bgImg !== 'none' ? bgImg.substring(0, 80) : 'none',
                textSnippet: (el.innerText || '').substring(0, 40).replace(/\\n/g, ' '),
                rect: { w: el.offsetWidth, h: el.offsetHeight }
              });
            }
          }
          return results;
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
        resolve(data.result?.result?.value || []);
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
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  console.log(`正在扫描页面: ${page.title}`);
  const items = await scanNonTransparentElements(page.webSocketDebuggerUrl);
  console.log(`共发现 ${items.length} 个具有背景的元素：`);
  
  // 按照背景颜色和类名分类去重汇总
  const summary = {};
  for (const item of items) {
    const key = `${item.tag} | ${item.className} | bg:${item.bg} | img:${item.bgImg}`;
    if (!summary[key]) {
      summary[key] = { ...item, count: 0, examples: [] };
    }
    summary[key].count++;
    if (summary[key].examples.length < 2 && item.textSnippet) {
      summary[key].examples.push(item.textSnippet);
    }
  }

  console.log(JSON.stringify(Object.values(summary), null, 2));
}

main();
