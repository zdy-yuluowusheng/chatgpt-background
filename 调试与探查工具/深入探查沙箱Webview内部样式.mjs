/**
 * @file 深入探查沙箱Webview内部样式.mjs
 * @description 连接当前运行的所有 webview 沙箱目标，探查其内部挂载的样式表、body 样式以及所有具有模糊或滤镜的节点。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查单个 target 内部的样式与模糊情况
 * 
 * @param {object} target - CDP target 描述
 * @returns {Promise<object>} 该 target 的探测数据
 * @throws {Error} 通信失败时抛出异常
 */
function inspectTargetInternal(target) {
  return new Promise((resolve, reject) => {
    if (!target.webSocketDebuggerUrl) return resolve({ target, error: 'no ws url' });

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ target, error: 'timeout' });
    }, 6000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const customStyle = document.getElementById('__chatgpt_codex_custom_theme_style__');
          const csBody = window.getComputedStyle(document.body);
          
          const blurNodes = [];
          for (const el of document.querySelectorAll('*')) {
            const cs = window.getComputedStyle(el);
            const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
            const f = cs.filter || cs.webkitFilter || 'none';
            if (bdf !== 'none' || f !== 'none') {
              blurNodes.push({
                tag: el.tagName.toLowerCase(),
                className: el.className,
                id: el.id,
                backdropFilter: bdf,
                filter: f,
                bg: cs.backgroundColor
              });
            }
          }

          return {
            title: document.title,
            url: location.href,
            hasCustomStyle: !!customStyle,
            customStyleLength: customStyle ? customStyle.textContent.length : 0,
            bodyBg: csBody.backgroundColor,
            bodyBgImage: csBody.backgroundImage ? csBody.backgroundImage.substring(0, 60) : 'none',
            bodyBackdrop: csBody.backdropFilter,
            bodyFilter: csBody.filter,
            blurNodes
          };
        })()
      `;

      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve({ target: { id: target.id, title: target.title, type: target.type, url: target.url }, result: data.result?.result?.value });
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        resolve({ target, error: err.message });
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      ws.close();
      resolve({ target, error: err.message });
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
  console.log(`共检索到 ${list.length} 个 targets，开始探查...`);

  for (const t of list) {
    if (t.type === 'webview' || t.url.includes('sandbox') || t.title.includes('docx') || t.title.includes('测试报告')) {
      const info = await inspectTargetInternal(t);
      console.log(JSON.stringify(info, null, 2));
    }
  }
}

main();
