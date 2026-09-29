/**
 * @file 测试初始页面输入框透明化.js
 * @description 动态注入针对 _ComposerLayoutBody_ 的透明化样式，切换到初始页面并截屏验证
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
        console.log('已连接 CDP，正在测试动态透明化样式...');
        const expr = `
            (() => {
                // 1. 动态插入补丁样式
                let testStyle = document.getElementById('__test_composer_body_style__');
                if (!testStyle) {
                    testStyle = document.createElement('style');
                    testStyle.id = '__test_composer_body_style__';
                    document.head.appendChild(testStyle);
                }
                testStyle.textContent = \`
                    :is([class*="_ComposerLayoutBody_"], [data-composer-body]) {
                        background-color: transparent !important;
                        background: transparent !important;
                        box-shadow: none !important;
                    }
                \`;

                // 2. 点击新聊天按钮切换回初始主页
                const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
                if (newChatBtn) {
                    newChatBtn.click();
                    return { injected: true, switchedToHome: true };
                }
                return { injected: true, switchedToHome: false };
            })()
        `;
        ws.send(JSON.stringify({ id: 301, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 301) {
            console.log('注入与切换结果:', msg.result?.result?.value);
            setTimeout(() => {
                // 检查此时的计算样式
                const probeExpr = `
                    (() => {
                        const root = document.querySelector('[class*="_ComposerLayoutRoot_"]');
                        const body = document.querySelector('[class*="_ComposerLayoutBody_"]');
                        return {
                            rootBg: window.getComputedStyle(root).backgroundColor,
                            rootFilter: window.getComputedStyle(root).backdropFilter,
                            bodyBg: window.getComputedStyle(body).backgroundColor,
                            bodyShadow: window.getComputedStyle(body).boxShadow
                        };
                    })()
                `;
                ws.send(JSON.stringify({ id: 302, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
            }, 800);
        } else if (msg.id === 302) {
            console.log('初始页面输入框实时计算样式:', msg.result?.result?.value);
            // 截图
            setTimeout(() => {
                ws.send(JSON.stringify({ id: 303, method: 'Page.captureScreenshot', params: { format: 'png' } }));
            }, 300);
        } else if (msg.id === 303) {
            const base64Data = msg.result?.data;
            if (base64Data) {
                const outPath = path.resolve(__dirname, '初始页面透明化修复验证.png');
                fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
                console.log(`[截图保存完成] ${outPath}`);
            }
            ws.close();
        }
    };
}

main().catch(console.error);
