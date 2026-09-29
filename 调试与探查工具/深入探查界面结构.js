/**
 * @file 深入探查界面结构.js
 * @description 递归探查 ChatGPT/Codex 主页面 DOM 树各层级结构与布局
 */

/**
 * 递归探查 DOM 节点并提取层级信息
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口号
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 探查失败时抛出错误
 */
async function inspectFullDOMTree(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          function dump(el, depth = 0) {
            if (!el || depth > 5) return null;
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
            const obj = {
              d: depth,
              tag: el.tagName,
              id: el.id,
              cls: cls.substring(0, 40),
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              disp: s.display,
              vis: s.visibility,
              bg: s.backgroundColor,
              text: el.children.length === 0 ? (el.textContent || '').trim().substring(0, 30) : undefined,
              children: []
            };
            for (const c of el.children) {
              const res = dump(c, depth + 1);
              if (res) obj.children.push(res);
            }
            return obj;
          }
          return dump(document.body);
        })()
      `;
      ws.send(JSON.stringify({ id: 2001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 2001) {
        function printTree(node, indent = '') {
          if (!node) return;
          const textPart = node.text ? ` text="${node.text}"` : '';
          const idPart = node.id ? `#${node.id}` : '';
          const clsPart = node.cls ? `.${node.cls.replace(/\\s+/g, '.')}` : '';
          console.log(`${indent}<${node.tag}${idPart}${clsPart}> [${node.rect.w}x${node.rect.h}@(${node.rect.x},${node.rect.y})] disp=${node.disp} vis=${node.vis} bg=${node.bg}${textPart}`);
          for (const c of node.children) {
            printTree(c, indent + '  ');
          }
        }
        printTree(d.result?.result?.value);
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectFullDOMTree();
