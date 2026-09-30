/**
 * @file 探查限制提示与分支选择条.mjs
 * @description 通过 CDP 探测当前页面上额度限制卡片、工作区分支条以及输入框各层级容器的真实 DOM 结构与计算样式。
 */

import fs from 'node:fs';

/**
 * 获取主页面调试 WebSocket 地址
 * @param {number} port - CDP 调试端口
 * @returns {Promise<string>} 返回 WebSocket 调试 URL
 * @throws {Error} 未找到页面时抛出异常
 */
async function getMainTargetWs(port = 9335) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && !t.url.includes('initialRoute'));
  if (!page) throw new Error('未找到主渲染窗口');
  return page.webSocketDebuggerUrl;
}

/**
 * 执行 DOM 探查主函数
 * @returns {Promise<void>}
 * @throws {Error} CDP 通信失败或执行错误
 */
async function main() {
  const wsUrl = await getMainTargetWs();
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    const probeExpr = `
      (() => {
        const allEls = Array.from(document.querySelectorAll('*'));

        // 1. 查找包含 '额度已用完' 或 '速率限制' 的卡片容器
        const limitEl = allEls.find(el => el.textContent && el.textContent.includes('额度已用完') && el.children.length === 0)
                     || allEls.find(el => el.textContent && el.textContent.includes('速率限制') && el.children.length === 0);
        
        const limitHierarchy = [];
        if (limitEl) {
          let cur = limitEl;
          while (cur && cur !== document.body && limitHierarchy.length < 10) {
            const cs = window.getComputedStyle(cur);
            limitHierarchy.push({
              tag: cur.tagName.toLowerCase(),
              className: String(cur.className),
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              filter: cs.backdropFilter || cs.webkitBackdropFilter,
              boxShadow: cs.boxShadow,
              attrs: Array.from(cur.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class='))
            });
            cur = cur.parentElement;
          }
        }

        // 2. 查找分支条或工作区选择条 (比如 main, 本地, Counter-Strike-Animation)
        const branchEl = allEls.find(el => el.textContent && el.textContent.trim() === 'main' && el.children.length === 0)
                      || allEls.find(el => el.textContent && el.textContent.trim() === '本地' && el.children.length === 0);
        const branchHierarchy = [];
        if (branchEl) {
          let cur = branchEl;
          while (cur && cur !== document.body && branchHierarchy.length < 10) {
            const cs = window.getComputedStyle(cur);
            branchHierarchy.push({
              tag: cur.tagName.toLowerCase(),
              className: String(cur.className),
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              filter: cs.backdropFilter || cs.webkitBackdropFilter,
              boxShadow: cs.boxShadow,
              attrs: Array.from(cur.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class='))
            });
            cur = cur.parentElement;
          }
        }

        // 3. 查找输入框 (Composer) 容器层级结构及背景
        const composerRoot = document.querySelector('.composer-surface-chrome, [class*="_ComposerLayoutRoot_"], [data-composer-surface-variant]') 
                          || document.querySelector('textarea, [contenteditable="true"]')?.closest('[class*="composer"], [class*="Composer"]');
        const composerHierarchy = [];
        if (composerRoot) {
          let cur = composerRoot;
          while (cur && cur !== document.body && composerHierarchy.length < 10) {
            const cs = window.getComputedStyle(cur);
            composerHierarchy.push({
              tag: cur.tagName.toLowerCase(),
              className: String(cur.className),
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              filter: cs.backdropFilter || cs.webkitBackdropFilter,
              boxShadow: cs.boxShadow,
              attrs: Array.from(cur.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class='))
            });
            cur = cur.parentElement;
          }
        }

        return {
          limitFound: !!limitEl,
          limitHierarchy,
          branchFound: !!branchEl,
          branchHierarchy,
          composerFound: !!composerRoot,
          composerHierarchy
        };
      })()
    `;

    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 1) {
      console.log(JSON.stringify(data.result?.result?.value, null, 2));
      ws.close();
    }
  };
}

main().catch(console.error);
