/**
 * @file 深入探查顶部Header组件.js
 * @description 检查 y:44 处 HEADER 组件内部所有子节点的文本和样式
 */

/**
 * 诊断 Header 组件
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectTopHeaderComponent(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const header = document.querySelector('header[data-app-shell-titlebar], [class*="_Workspace_"] header');
          if (!header) return { error: '未找到 header' };

          function dump(el, d = 0) {
            if (!el || d > 6) return null;
            const s = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const cls = typeof el.className === 'string' ? el.className : '';
            return {
              tag: el.tagName,
              cls: cls.substring(0, 50),
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              bg: s.backgroundColor,
              bgImg: s.backgroundImage,
              filter: s.backdropFilter || s.webkitBackdropFilter,
              shadow: s.boxShadow,
              text: el.children.length === 0 ? (el.textContent || '').trim() : undefined,
              children: Array.from(el.children).map(c => dump(c, d + 1)).filter(Boolean)
            };
          }

          return dump(header);
        })()
      `;
      ws.send(JSON.stringify({ id: 701, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 701) {
        function printTree(node, indent = '') {
          if (!node) return;
          const text = node.text ? ` text="${node.text}"` : '';
          console.log(`${indent}<${node.tag} .${node.cls}> [${node.rect.w}x${node.rect.h}@(${node.rect.x},${node.rect.y})] bg=${node.bg} bgImg=${node.bgImg} filter=${node.filter} shadow=${node.shadow}${text}`);
          for (const c of node.children) printTree(c, indent + '  ');
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

inspectTopHeaderComponent();
