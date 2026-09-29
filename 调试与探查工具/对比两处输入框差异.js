/**
 * @file 对比两处输入框差异.js
 * @description 对比初始页面（新聊天）和会话页面（已有项目会话）中输入框 Composer 各容器的样式差异。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取主页面调试 WebSocket 地址
 * @param {number} port - 调试端口
 * @returns {Promise<string>} 返回 WebSocket 调试地址
 * @throws {Error} 未找到页面时抛出异常
 */
async function getMainTargetWs(port = 9335) {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await res.json();
    const t = targets.find(item => item.type === 'page' && !item.url.includes('initialRoute'));
    if (!t) throw new Error('未找到主窗口');
    return t.webSocketDebuggerUrl;
}

/**
 * 执行对比检测
 * @returns {Promise<void>}
 * @throws {Error} 执行异常
 */
async function compareComposerStyles() {
    const wsUrl = await getMainTargetWs();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        // 先检查当前页面的 Composer 所有节点与父子背景
        const probeExpr = `
            (() => {
                const root = document.querySelector('[class*="_ComposerLayoutRoot_"]');
                const body = document.querySelector('[class*="_ComposerLayoutBody_"]');
                const footer = document.querySelector('[class*="_ComposerLayoutFooter_"]');
                const input = document.querySelector('[class*="_ComposerLayoutInput_"]');
                
                function getInfo(el, name) {
                    if (!el) return { name, exists: false };
                    const cs = window.getComputedStyle(el);
                    return {
                        name,
                        exists: true,
                        tag: el.tagName.toLowerCase(),
                        className: el.className,
                        bg: cs.backgroundColor,
                        bgImg: cs.backgroundImage,
                        filter: cs.backdropFilter || cs.webkitBackdropFilter,
                        shadow: cs.boxShadow,
                        radius: cs.borderRadius,
                        attrs: Array.from(el.attributes).map(a => a.name + '=' + a.value)
                    };
                }

                return {
                    root: getInfo(root, 'root'),
                    body: getInfo(body, 'body'),
                    footer: getInfo(footer, 'footer'),
                    input: getInfo(input, 'input')
                };
            })()
        `;
        ws.send(JSON.stringify({ id: 101, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 101) {
            console.log('Composer 元素样式详情:\n', JSON.stringify(msg.result?.result?.value, null, 2));
            ws.close();
        }
    };
}

compareComposerStyles().catch(console.error);
