/**
 * @file 探查初始页面输入框.js
 * @description 通过 CDP 点击“新聊天”进入初始页面，深入探查初始页面的输入框及其父级容器结构与计算样式，并截图。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取主窗口的 WebSocket 调试地址
 * @param {number} port 调试端口
 * @returns {Promise<string>} 返回主窗口的 WebSocket 调试 URL
 * @throws {Error} 当无法获取目标列表或找不到主窗口时抛出异常
 */
async function getTargetWsUrl(port = 9335) {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await res.json();
    const mainTarget = targets.find(t => t.type === 'page' && !t.url.includes('initialRoute'));
    if (!mainTarget) {
        throw new Error('未找到主窗口页面');
    }
    return mainTarget.webSocketDebuggerUrl;
}

/**
 * 主执行函数
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 当执行探查流程失败时抛出异常
 */
async function main() {
    const wsUrl = await getTargetWsUrl();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('已连接主窗口 CDP');
        // 步骤 1：寻找“新聊天”按钮并点击
        const clickNewChatExpr = `
            (() => {
                const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
                if (newChatBtn) {
                    newChatBtn.click();
                    return { clicked: true, text: newChatBtn.textContent.trim() };
                }
                return { clicked: false, reason: '未找到包含新聊天字样的按钮' };
            })()
        `;
        ws.send(JSON.stringify({ id: 1001, method: 'Runtime.evaluate', params: { expression: clickNewChatExpr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.id === 1001) {
            console.log('点击新聊天返回:', msg.result?.result?.value);
            // 稍等 800ms 让初始页面渲染
            setTimeout(() => {
                // 步骤 2：探查初始页面输入框的完整 DOM 与计算样式
                const probeExpr = `
                    (() => {
                        const allElements = Array.from(document.querySelectorAll('*'));
                        
                        // 寻找“随心输入”占位符或 textarea / contenteditable
                        const placeholderEl = allElements.find(el => el.textContent && el.textContent.includes('随心输入') && el.children.length === 0);
                        const inputEl = document.querySelector('textarea, [contenteditable="true"]');
                        
                        const target = placeholderEl || inputEl;
                        if (!target) {
                            return { error: '未找到输入框或随心输入元素' };
                        }

                        // 收集从目标元素一直到 body 的整条链路
                        const chain = [];
                        let curr = target;
                        while (curr && curr !== document.body && curr !== document.documentElement) {
                            const cs = window.getComputedStyle(curr);
                            chain.push({
                                tag: curr.tagName.toLowerCase(),
                                className: curr.className || '',
                                id: curr.id || '',
                                attrs: Array.from(curr.attributes).map(a => a.name + '=' + a.value),
                                bg: cs.backgroundColor,
                                bgImg: cs.backgroundImage,
                                filter: cs.backdropFilter || cs.webkitBackdropFilter,
                                border: cs.border,
                                borderRadius: cs.borderRadius,
                                boxShadow: cs.boxShadow,
                                opacity: cs.opacity,
                                w: curr.offsetWidth,
                                h: curr.offsetHeight
                            });
                            curr = curr.parentElement;
                        }

                        // 检查当前页面是否还有其它带有背景色的遮罩层
                        const initialPageSurfaces = allElements.filter(el => {
                            const cs = window.getComputedStyle(el);
                            return (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')
                                && el.offsetWidth > 300 && el.offsetHeight > 50;
                        }).map(el => ({
                            tag: el.tagName.toLowerCase(),
                            className: el.className || '',
                            bg: window.getComputedStyle(el).backgroundColor,
                            w: el.offsetWidth,
                            h: el.offsetHeight,
                            textSnippet: el.textContent?.slice(0, 30) || ''
                        }));

                        return {
                            foundTarget: true,
                            chain: chain.slice(0, 10),
                            initialPageSurfaces: initialPageSurfaces.slice(0, 10)
                        };
                    })()
                `;
                ws.send(JSON.stringify({ id: 1002, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
            }, 800);
        } else if (msg.id === 1002) {
            console.log('探查结果:\n', JSON.stringify(msg.result?.result?.value, null, 2));

            // 步骤 3：截全屏，直观确认当前初始页面的渲染表现
            setTimeout(() => {
                ws.send(JSON.stringify({
                    id: 1003,
                    method: 'Page.captureScreenshot',
                    params: { format: 'png', quality: 90 }
                }));
            }, 300);
        } else if (msg.id === 1003) {
            const base64Data = msg.result?.data;
            if (base64Data) {
                const outPath = path.resolve(__dirname, '初始页面当前效果.png');
                fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
                console.log(`[截图保存完成] ${outPath}`);
            }
            ws.close();
        }
    };

    ws.onerror = (err) => {
        console.error('CDP 连接异常:', err);
    };
}

main().catch(console.error);
