/**
 * @file 提取组件原始样式文本.mjs
 * @description 从页面的所有 style 标签中搜索包含 _Button_f5tnh_2 的 CSS 文本
 */

/**
 * 在目标页面执行 JavaScript 脚本并获取结果
 * 
 * @param {string} expr - JavaScript 表达式
 * @param {number} port - 端口号
 * @returns {Promise<any>}
 * @throws {Error}
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
        id: 9201,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9201) {
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
 * 主逻辑
 */
async function main() {
  const code = `
    (() => {
      const snippets = [];
      document.querySelectorAll('style').forEach(st => {
        const text = st.textContent || '';
        if (text.includes('_Button_f5tnh_2') || text.includes('sidebarDestination') || text.includes('group/sidebar-rail')) {
          // 截取相关的片段
          let idx = 0;
          while ((idx = text.indexOf('_Button_f5tnh_2', idx)) !== -1) {
            const start = Math.max(0, idx - 100);
            const end = Math.min(text.length, idx + 400);
            snippets.push(text.slice(start, end));
            idx += 15;
            if (snippets.length > 20) break;
          }
        }
      });
      return snippets;
    })()
  `;

  const data = await evalInCodex(code);
  console.log(`=== 找到 ${data.length} 个样式片段 ===`);
  data.forEach((s, i) => {
    console.log(`\n--- 片段 ${i} ---`);
    console.log(s);
  });
}

main().catch(console.error);
