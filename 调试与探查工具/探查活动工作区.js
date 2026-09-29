/**
 * @file 探查活动工作区.js
 * @description 深入探查当前活动工作区 (_Workspace_) 内部结构与文本内容
 */

/**
 * 探查活动工作区结构并输出到控制台
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectActiveWorkspace(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const workspaces = Array.from(document.querySelectorAll('[class*="_Workspace_"]'));
          const activeWorkspace = workspaces.find(w => {
            const s = window.getComputedStyle(w);
            return s.display !== 'none';
          });
          if (!activeWorkspace) {
            return { error: '未找到活动工作区，共找到 ' + workspaces.length + ' 个工作区' };
          }
          
          function dumpNode(el, d = 0) {
            if (!el || d > 8) return null;
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
            const info = {
              tag: el.tagName,
              cls: cls.substring(0, 50),
              r: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
              disp: s.display,
              vis: s.visibility,
              opacity: s.opacity,
              bg: s.backgroundColor,
              color: s.color,
              text: el.children.length === 0 ? (el.textContent || '').trim().substring(0, 40) : undefined,
              children: []
            };
            for (const c of el.children) {
              const ch = dumpNode(c, d + 1);
              if (ch) info.children.push(ch);
            }
            return info;
          }

          return dumpNode(activeWorkspace);
        })()
      `;
      ws.send(JSON.stringify({ id: 10, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 10) {
        function printTree(node, indent = '') {
          if (!node) return;
          const text = node.text ? ` text="${node.text}"` : '';
          console.log(`${indent}<${node.tag} .${node.cls}> [${node.r.w}x${node.r.h}@(${node.r.x},${node.r.y})] disp=${node.disp} vis=${node.vis} op=${node.opacity} bg=${node.bg} col=${node.color}${text}`);
          for (const c of node.children) {
            printTree(c, indent + '  ');
          }
        }
        const val = d.result?.result?.value;
        if (val?.error) {
          console.log(val.error);
        } else {
          printTree(val);
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectActiveWorkspace();
