/**
 * @file 点击会话并检查会话输入框.js
 * @description 精确点击会话项进入会话，并截屏与打印输入框结构
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取主窗口 WebSocket 地址
 * @param {number} port 端口
 * @returns {Promise<string>}
 */
async function getMainTargetWs(port = 9335) {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await res.json();
    const t = targets.find(item => item.type === 'page' && !item.url.includes('initialRoute'));
    if (!t) throw new Error('未找到主窗口');
    return t.webSocketDebuggerUrl;
}

/**
 * 主执行函数
 */
async function main() {
    const wsUrl = await getMainTargetWs();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        const clickThreadExpr = `
            (() => {
                const els = Array.from(document.querySelectorAll('*'));
                const el = els.find(x => x.children.length === 0 && x.textContent && x.textContent.includes('整理价格分析业务表文档'));
                if (el) {
                    const clickTarget = el.closest('button, a, div[role="button"]') || el;
                    clickTarget.click();
                    return { found: true, tag: clickTarget.tagName, text: el.textContent };
                }
                return { found: false };
            })()
        `;
        ws.send(JSON.stringify({ id: 201, method: 'Runtime.evaluate', params: { expression: clickThreadExpr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 201) {
            console.log('点击会话项结果:', msg.result?.result?.value);
            setTimeout(() => {
                const probeExpr = `
                    (() => {
                        const root = document.querySelector('[class*="_ComposerLayoutRoot_"]');
                        const body = document.querySelector('[class*="_ComposerLayoutBody_"]');
                        function getInfo(el, name) {
                            if (!el) return { name, exists: false };
                            const cs = window.getComputedStyle(el);
                            return {
                                name,
                                exists: true,
                                tag: el.tagName.toLowerCase(),
                                className: el.className,
                                bg: cs.backgroundColor,
                                filter: cs.backdropFilter || cs.webkitBackdropFilter,
                                shadow: cs.boxShadow,
                                attrs: Array.from(el.attributes).map(a => a.name + '=' + a.value)
                            };
                        }
                        return {
                            root: getInfo(root, 'root'),
                            body: getInfo(body, 'body')
                        };
                    })()
                `;
                ws.send(JSON.stringify({ id: 202, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
            }, 1000);
        } else if (msg.id === 202) {
            console.log('会话中 Composer 结构:\n', JSON.stringify(msg.result?.result?.value, null, 2));
            setTimeout(() => {
                ws.send(JSON.stringify({ id: 203, method: 'Page.captureScreenshot', params: { format: 'png' } }));
            }, 500);
        } else if (msg.id === 203) {
            const base64Data = msg.result?.data;
            if (base64Data) {
                const outPath = path.resolve(__dirname, '会话中实际效果.png');
                fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
                console.log(`[截图保存完成] ${outPath}`);
            }
            ws.close();
        }
    };
}

main().catch(console.error);
