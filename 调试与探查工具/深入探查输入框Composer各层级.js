/**
 * @file 深入探查输入框Composer各层级.js
 * @description 详细探查 Composer (输入框) 容器及内部所有子层级的实际背景、滤镜与边框
 */

/**
 * 诊断输入框各层级节点
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectComposerLayers(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const root = document.querySelector('[class*="_ComposerLayoutRoot_"], [data-composer-surface-variant], form:has(textarea), div:has(> [contenteditable="true"])');
          if (!root) return { error: '未找到 composer 根节点' };

          function dump(el, d = 0) {
            if (!el || d > 5) return null;
            const s = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              cls: (typeof el.className === 'string' ? el.className : '').substring(0, 60),
              rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
              bg: s.backgroundColor,
              bgImg: s.backgroundImage,
              filter: s.backdropFilter || s.webkitBackdropFilter,
              border: s.border,
              borderRadius: s.borderRadius,
              shadow: s.boxShadow,
              children: Array.from(el.children).map(c => dump(c, d + 1)).filter(Boolean)
            };
          }

          return dump(root);
        })()
      `;
      ws.send(JSON.stringify({ id: 1001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1001) {
        function printTree(node, indent = '') {
          if (!node) return;
          console.log(`${indent}<${node.tag} .${node.cls}> [${node.rect.w}x${node.rect.h}@(${node.rect.x},${node.rect.y})] bg=${node.bg} filter=${node.filter} border=${node.border} radius=${node.borderRadius} shadow=${node.shadow}`);
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

inspectComposerLayers();
