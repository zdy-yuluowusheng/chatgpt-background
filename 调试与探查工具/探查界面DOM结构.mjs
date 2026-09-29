/**
 * @file 探查界面DOM结构.mjs
 * @description 运行时通过 Chrome DevTools Protocol 连接正在运行的 ChatGPT/Codex 客户端，
 *              扫描并测量核心选择器的命中率、计算样式以及毛玻璃容器的挂载状态。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 待探测的核心 DOM 选择器清单（基于 Codex 与 ChatGPT 最新前端架构）
 */
const SELECTOR_AUDIT_LIST = [
  { key: '全局主表面', selector: 'main:is(.main-surface, [data-app-shell-main-surface], [class*="_MainContentSurface_"])' },
  { key: '左侧导航栏', selector: 'aside.app-shell-left-panel' },
  { key: '顶部状态栏', selector: 'header:is(.app-header-tint, [data-app-shell-header-edge-scroll], [class*="_Header_"])' },
  { key: '主输入框壳', selector: ':is(.composer-surface-chrome, [class*="_ComposerLayoutRoot_"], [data-composer-surface-variant][data-composer-radius-variant])' },
  { key: '输入框工具栏', selector: ':is(.composer-surface-chrome [class*="_footer_"], [class*="_ComposerLayoutRoot_"] [class*="_ComposerLayoutFooter_"])' },
  { key: '对话滚动区', selector: '.thread-scroll-container' },
  { key: '消息边界项', selector: ':is([data-message-author-role], [data-local-conversation-user-anchor], [data-local-conversation-final-assistant])' },
  { key: 'Markdown代码块', selector: '[class*="_markdown"] pre, .markdown pre, pre' },
  { key: '毛玻璃主题Style节点', selector: '#__chatgpt_codex_custom_theme_style__' },
];

/**
 * 查询指定 CDP 端点获取 targets 列表
 * 
 * @param {number} port - CDP 调试端口号
 * @returns {Promise<Array<object>|null>} 活跃目标数组或 null
 * @throws {void} 内部捕获异常并返回 null
 */
async function getCdpTargets(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 在目标页面内部执行 DOM 探查脚本并收集各选择器的计算样式与命中情况
 * 
 * @param {string} wsUrl - 目标页面的调试 WebSocket URL
 * @returns {Promise<Array<object>>} 各选择器的探测报告
 * @throws {Error} WebSocket 连接失败或命令超时时抛出错误
 */
function auditPageDom(wsUrl) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('CDP 探查请求超时'));
      }, 5000);

      ws.onopen = () => {
        const expression = `
          (() => {
            const list = ${JSON.stringify(SELECTOR_AUDIT_LIST)};
            return list.map(item => {
              const el = document.querySelector(item.selector);
              if (!el) {
                return { key: item.key, selector: item.selector, matched: false, count: 0, sampleBg: null };
              }
              const all = document.querySelectorAll(item.selector);
              const computed = window.getComputedStyle(el);
              return {
                key: item.key,
                selector: item.selector,
                matched: true,
                count: all.length,
                sampleBg: computed.backgroundColor,
                sampleBackdrop: computed.backdropFilter || computed.webkitBackdropFilter || 'none',
                tag: el.tagName.toLowerCase()
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
          if (data.id === 1) {
            clearTimeout(timeout);
            ws.close();
            resolve(data.result?.result?.value || []);
          }
        } catch (err) {
          clearTimeout(timeout);
          ws.close();
          reject(err);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 运行探查主流程
 * 
 * @returns {Promise<void>}
 * @throws {void}
 */
async function main() {
  console.log('==========================================================');
  console.log('    ChatGPT / Codex 界面 DOM 与主题挂载状态探查工具');
  console.log('==========================================================');

  const targets = await getCdpTargets(PORT);
  if (!targets || targets.length === 0) {
    console.error(`[错误] 未能在 http://${HOST}:${PORT} 探测到活跃的客户端！`);
    console.error('提示: 请确认已通过“启动并注入主题.ps1”拉起带有调试端口的 ChatGPT/Codex。');
    process.exit(1);
  }

  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) {
    console.error('[错误] 找到 CDP 端口，但未检索到可交互的主界面渲染页面 (type=page)。');
    process.exit(1);
  }

  console.log(`已锁定目标渲染窗口: "${page.title}" (${page.url})`);
  console.log('正在执行 DOM 选择器命中率与样式审计...\n');

  try {
    const report = await auditPageDom(page.webSocketDebuggerUrl);
    console.table(report);

    const styleNode = report.find((r) => r.key === '毛玻璃主题Style节点');
    if (styleNode && styleNode.matched) {
      console.log('\n✅ 【主题注入状态良好】自定义毛玻璃样式节点已成功挂载到 DOM 树中！');
    } else {
      console.log('\n⚠️ 【未检测到样式挂载】样式节点暂未注入，请确认注入守护进程是否正常开启。');
    }
  } catch (err) {
    console.error(`[探查异常] ${err.message}`);
  }
}

main();
