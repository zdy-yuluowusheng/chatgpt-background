/**
 * @file 探查会话全部组件与遮罩.mjs
 * @description 检测 ChatGPT/Codex 对话视图中所有代码块、思考框、遮罩、渐变层、操作卡片与消息容器的样式与类名规则变化。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取活跃页面并执行深层组件探查
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 通信失败时抛出异常
 */
function inspectAllComponents(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expression = `
        (() => {
          // 1. 代码块
          const codeBlocks = Array.from(document.querySelectorAll('[data-code-block], [class*="CodeBlock"], [class*="CodeSurface"], [data-markdown-copy="code-block"]')).map(b => {
            const cs = window.getComputedStyle(b);
            const header = b.querySelector('[class*="ActionBar"], [class*="StickyActionBar"], header');
            const code = b.querySelector('code');
            return {
              tag: b.tagName.toLowerCase(),
              className: b.className,
              dataset: { ...b.dataset },
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              border: cs.border,
              headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
              headerBgImg: header ? window.getComputedStyle(header).backgroundImage : null,
              codeBg: code ? window.getComputedStyle(code).backgroundColor : null,
              codeBorder: code ? window.getComputedStyle(code).border : null
            };
          });

          // 2. 顶部/底部渐变与遮罩
          const fades = Array.from(document.querySelectorAll('[class*="Fade"], [class*="fade"], [class*="gradient"], [class*="Gradient"]')).map(f => {
            const cs = window.getComputedStyle(f);
            return {
              className: f.className,
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              display: cs.display,
              opacity: cs.opacity
            };
          });

          // 3. 思考框 (Thought / Thinking / Reasoning)
          const thoughtBoxes = Array.from(document.querySelectorAll('[class*="thought"], [class*="Thought"], [class*="reasoning"], [class*="Reasoning"], [data-testid*="thought"]')).map(t => {
            const cs = window.getComputedStyle(t);
            return {
              className: t.className,
              bg: cs.backgroundColor,
              border: cs.border
            };
          });

          // 4. 对话消息主容器与用户消息气泡
          const messageTurns = Array.from(document.querySelectorAll('[data-message-author-role], [data-local-conversation-user-anchor], [data-local-conversation-final-assistant], [class*="user-message"], [class*="assistant-message"]')).map(m => {
            const cs = window.getComputedStyle(m);
            return {
              tag: m.tagName.toLowerCase(),
              role: m.getAttribute('data-message-author-role') || m.className.substring(0, 40),
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage
            };
          });

          // 5. 检查当前注入的 Style 标签内容是否生效
          const customStyle = document.getElementById('__chatgpt_codex_custom_theme_style__');
          
          return {
            totalCodeBlocks: codeBlocks.length,
            codeBlocksSample: codeBlocks.slice(0, 3),
            totalFades: fades.length,
            fadesSample: fades.slice(0, 5),
            totalThoughtBoxes: thoughtBoxes.length,
            thoughtBoxesSample: thoughtBoxes.slice(0, 3),
            totalMessageTurns: messageTurns.length,
            hasCustomStyleNode: !!customStyle,
            styleSheetRulesCount: customStyle && customStyle.sheet ? customStyle.sheet.cssRules.length : 0
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
 */
async function main() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  const report = await inspectAllComponents(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(report, null, 2));
}

main();
