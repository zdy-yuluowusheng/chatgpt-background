/**
 * @file 探查会话代码块与黑底元素.mjs
 * @description 连接当前运行的 ChatGPT/Codex 客户端，深入检测对话中代码块及出现黑底的元素层级、类名与计算样式。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取活跃的目标页面
 * 
 * @param {number} port - 调试端口
 * @returns {Promise<object|null>} 目标页面信息
 * @throws {Error} 获取列表失败时抛出错误
 */
async function getTargetPage(port) {
  const res = await fetch(`http://${HOST}:${port}/json/list`);
  const list = await res.json();
  return list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
}

/**
 * 探查页面中所有的代码块及其父级容器的样式与类名
 * 
 * @param {string} wsUrl - CDP WebSocket URL
 * @returns {Promise<object>} 探查结果对象
 * @throws {Error} CDP 通信失败时抛出异常
 */
function inspectDom(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expression = `
        (() => {
          // 查找包含 pre 或 code 或相关特征的元素
          const pres = Array.from(document.querySelectorAll('pre, [class*="code"], [class*="Code"], [class*="_markdown"]'));
          
          // 搜寻带有 Illegal mix of collations 的元素链
          let targetEl = null;
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.children.length === 0 && el.textContent.includes('Illegal mix of collations')) {
              targetEl = el;
              break;
            }
          }

          let chain = [];
          if (targetEl) {
            let cur = targetEl;
            while (cur && cur !== document.body) {
              const cs = window.getComputedStyle(cur);
              chain.push({
                tag: cur.tagName.toLowerCase(),
                className: cur.className,
                bg: cs.backgroundColor,
                bgImage: cs.backgroundImage !== 'none' ? 'has-bg-img' : 'none',
                backdropFilter: cs.backdropFilter || 'none',
                boxShadow: cs.boxShadow,
                border: cs.border,
                dataset: { ...cur.dataset }
              });
              cur = cur.parentElement;
            }
          }

          // 另外检索当前页面上所有的 pre 元素
          const realPres = Array.from(document.querySelectorAll('pre')).map(p => {
            const cs = window.getComputedStyle(p);
            return {
              tag: 'pre',
              className: p.className,
              bg: cs.backgroundColor,
              parentTag: p.parentElement ? p.parentElement.tagName.toLowerCase() : '',
              parentClass: p.parentElement ? p.parentElement.className : '',
              parentBg: p.parentElement ? window.getComputedStyle(p.parentElement).backgroundColor : '',
              grandParentClass: p.parentElement && p.parentElement.parentElement ? p.parentElement.parentElement.className : '',
              grandParentBg: p.parentElement && p.parentElement.parentElement ? window.getComputedStyle(p.parentElement.parentElement).backgroundColor : ''
            };
          });

          // 检索所有可能是代码块容器的元素
          const codeContainers = Array.from(document.querySelectorAll('div:has(> pre), div:has(> div > pre), [class*="codeblock"], [class*="CodeBlock"], [data-testid*="code"]')).map(c => {
            const cs = window.getComputedStyle(c);
            return {
              tag: c.tagName.toLowerCase(),
              className: c.className,
              bg: cs.backgroundColor,
              childrenCount: c.children.length
            };
          });

          return {
            hasTargetText: !!targetEl,
            elementChain: chain,
            realPres,
            codeContainers
          };
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
 * @throws {void} 异常捕获并输出
 */
async function main() {
  try {
    const page = await getTargetPage(PORT);
    if (!page) {
      console.error('未找到目标页面');
      return;
    }
    console.log(`正在探查页面: ${page.title} (${page.url})`);
    const result = await inspectDom(page.webSocketDebuggerUrl);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('探查出错:', err);
  }
}

main();
