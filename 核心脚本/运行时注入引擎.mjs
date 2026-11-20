/**
 * @file 运行时注入引擎.mjs
 * @description 基于 Chrome DevTools Protocol (CDP) 的轻量级运行时主题注入守护引擎。
 *              通过 loopback WebSocket 在渲染进程内存中动态挂载毛玻璃 CSS 样式表，
 *              并采用内容指纹缓存与轻量 DOM 探针机制，消除路由切换时的重复大体积传输卡顿。
 * @author Antigravity Assistant
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 默认配置
const CONFIG = {
  port: 9335,
  host: '127.0.0.1',
  pollIntervalMs: 2000,
  styleId: '__chatgpt_codex_custom_theme_style__',
  cssPath: path.resolve(__dirname, '../主题样式/透明UI主题.css'),
};

// 内存缓存最新的 CSS 文本及其指纹哈希，避免每次导航重复读取磁盘与计算哈希
const cssCache = {
  mtimeMs: 0,
  css: '',
  hash: '',
};

/**
 * 异步请求 CDP HTTP 接口，获取当前可用的 targets 或 version 信息
 * 
 * @param {string} endpoint - 目标端点路径（如 '/json/list' 或 '/json/version'）
 * @returns {Promise<Array<object>|object|null>} 响应解析后的 JSON 对象，网络不可达时返回 null
 * @throws {Error} 当网络连接严重异常或 JSON 格式非法时处理错误并返回 null
 */
async function queryCdpEndpoint(endpoint) {
  try {
    const url = `http://${CONFIG.host}:${CONFIG.port}${endpoint}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 读取并缓存本地主题 CSS 文件内容及其 SHA-256 指纹哈希
 * 
 * @param {string} filePath - 本地 CSS 文件路径
 * @param {boolean} [forceRefresh=false] - 是否忽略 mtime 缓存强制从磁盘重新读取
 * @returns {{css: string, hash: string}} 包含完整 CSS 文本与 16 位哈希指纹的对象
 * @throws {Error} 内部捕获读取异常并在文件缺失时打印错误，返回空字符串状态
 */
function getThemeCssState(filePath, forceRefresh = false) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`主题样式表不存在: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (!forceRefresh && cssCache.css && cssCache.mtimeMs === stat.mtimeMs) {
      return { css: cssCache.css, hash: cssCache.hash };
    }

    const css = fs.readFileSync(filePath, 'utf8');
    if (!css) {
      return { css: '', hash: '' };
    }

    const hash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 16);
    cssCache.mtimeMs = stat.mtimeMs;
    cssCache.css = css;
    cssCache.hash = hash;
    return { css, hash };
  } catch (err) {
    console.error(`[读取CSS异常] ${err.message}`);
    return { css: cssCache.css || '', hash: cssCache.hash || '' };
  }
}

/**
 * 构造轻量 DOM 样式就绪探针脚本（仅数百字节，用于 SPA 路由跳转时免传输全量 CSS）
 * 
 * @param {string} styleId - DOM 树中 style 标签的唯一标识 ID
 * @param {string} themeHash - 当前主题样式的 16 位指纹哈希
 * @returns {string} 可执行的轻量级探测 JavaScript 代码片段
 * @throws {void} 无异常抛出
 */
function buildProbeScript(styleId, themeHash) {
  const serializedId = JSON.stringify(styleId);
  const serializedHash = JSON.stringify(themeHash);
  return `(() => {
    const el = document.getElementById(${serializedId});
    return !!(el && el.getAttribute('data-theme-hash') === ${serializedHash});
  })();`;
}

/**
 * 构造向页面全量写入样式的 JavaScript 执行代码
 * 
 * @param {string} cssContent - 待挂载的 CSS 样式代码
 * @param {string} styleId - DOM 树中 style 标签的唯一标识 ID
 * @param {string} themeHash - 当前主题样式的 16 位指纹哈希
 * @returns {string} 序列化后的可执行 JavaScript 代码片段
 * @throws {void} 无异常抛出
 */
function buildInjectionScript(cssContent, styleId, themeHash) {
  const serializedCss = JSON.stringify(cssContent);
  const serializedId = JSON.stringify(styleId);
  const serializedHash = JSON.stringify(themeHash);

  return `
    (() => {
      try {
        const id = ${serializedId};
        const css = ${serializedCss};
        const hash = ${serializedHash};
        let style = document.getElementById(id);
        if (!style) {
          style = document.createElement('style');
          style.id = id;
          style.setAttribute('data-injected-by', 'chatgpt-background-cdp');
          (document.head || document.documentElement).appendChild(style);
        }
        if (style.getAttribute('data-theme-hash') !== hash || style.textContent !== css) {
          style.textContent = css;
          style.setAttribute('data-theme-hash', hash);
        }
        return { success: true, updated: true, hash };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })();
  `;
}

/**
 * 单个 CDP 渲染窗口连接器类，维护单页面生命周期内的 WebSocket 与样式挂载
 */
class PageInjectorSession {
  /**
   * 初始化页面注入会话
   * 
   * @param {object} target - CDP target 描述对象（包含 id, title, webSocketDebuggerUrl 等）
   * @param {string} cssPath - CSS 文件路径
   * @throws {void} 无异常抛出
   */
  constructor(target, cssPath) {
    this.target = target;
    this.cssPath = cssPath;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.isConnected = false;
    this.isInjecting = false;
    this.pendingForce = null;
    this.navDebounceTimer = null;
  }

  /**
   * 启动 WebSocket 连接并初始化 Page/Runtime 域
   * 
   * @returns {Promise<boolean>} 连接并就绪返回 true，失败返回 false
   * @throws {Error} 捕获底层 WebSocket 连接异常并返回 false
   */
  connect() {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.target.webSocketDebuggerUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          console.log(`[连接成功] 已连上页面: "${this.target.title || 'ChatGPT/Codex'}"`);

          // 开启 Page 和 Runtime 事件监听
          this.sendCommand('Runtime.enable');
          this.sendCommand('Page.enable');

          // 首次连接执行注入校验
          this.injectStyle(false);
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // 处理命令响应
            if (data.id && this.callbacks.has(data.id)) {
              const cb = this.callbacks.get(data.id);
              this.callbacks.delete(data.id);
              cb(data.result);
            }
            // 路由导航或页面重载时合并防抖并以轻量探针按需补注
            if (
              data.method === 'Page.loadEventFired' ||
              data.method === 'Page.navigatedWithinDocument' ||
              data.method === 'Page.frameNavigated'
            ) {
              this.scheduleNavigationCheck();
            }
          } catch {
            // 忽略解析错误
          }
        };

        this.ws.onerror = () => {
          this.isConnected = false;
          resolve(false);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          if (this.navDebounceTimer) {
            clearTimeout(this.navDebounceTimer);
            this.navDebounceTimer = null;
          }
          for (const cb of this.callbacks.values()) {
            try { cb(null); } catch {}
          }
          this.callbacks.clear();
          console.log(`[连接断开] 页面会话已关闭: ${this.target.id}`);
        };
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * 合并短时间内的多次导航事件，避免连续触发冗余校验
   * 
   * @returns {void} 无返回值
   * @throws {void} 无异常抛出
   */
  scheduleNavigationCheck() {
    if (this.navDebounceTimer) {
      clearTimeout(this.navDebounceTimer);
    }
    this.navDebounceTimer = setTimeout(() => {
      this.navDebounceTimer = null;
      this.injectStyle(false);
    }, 60);
  }

  /**
   * 向当前渲染窗口发送 CDP 请求协议帧
   * 
   * @param {string} method - CDP 方法名（如 'Runtime.evaluate'）
   * @param {object} [params={}] - 方法调用参数
   * @returns {Promise<object|null>} 返回方法执行结果，未连接或超时时返回 null
   * @throws {void} 异常时通过返回 null 降级处理
   */
  sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return resolve(null);
      }
      const id = this.msgId++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          resolve(null);
        }
      }, 8000);
      this.callbacks.set(id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * 执行样式注入（非强制模式下优先发送轻量探针，哈希一致则跳过全量 CSS 推送）
   * 
   * @param {boolean} [forceRefresh=false] - 是否强制刷新磁盘 CSS 并跳过探针直接下发
   * @returns {Promise<void>} 异步执行完成
   * @throws {void} 内部安全处理空样式与通信失败
   */
  async injectStyle(forceRefresh = false) {
    if (!this.isConnected) return;

    if (this.isInjecting) {
      this.pendingForce = (this.pendingForce === true) || forceRefresh;
      return;
    }

    this.isInjecting = true;
    try {
      const { css, hash } = getThemeCssState(this.cssPath, forceRefresh);
      if (!css || !hash) return;

      // 先发送轻量探针核验页面上是否已经挂载同哈希样式，SPA 跳转时 0 延迟跳过全量发送
      if (!forceRefresh) {
        const probeRes = await this.sendCommand('Runtime.evaluate', {
          expression: buildProbeScript(CONFIG.styleId, hash),
          returnByValue: true,
        });
        if (probeRes?.result?.value === true) {
          return;
        }
      }

      const script = buildInjectionScript(css, CONFIG.styleId, hash);
      await this.sendCommand('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
        userGesture: true,
        awaitPromise: true,
      });
      console.log(`[样式已挂载] 成功更新页面样式: "${this.target.title || '主窗口'}" [${hash}] (${new Date().toLocaleTimeString()})`);
    } finally {
      this.isInjecting = false;
      if (this.pendingForce !== null) {
        const nextForce = this.pendingForce;
        this.pendingForce = null;
        this.injectStyle(nextForce);
      }
    }
  }

  /**
   * 关闭当前 WebSocket 会话并清理定时器
   * 
   * @returns {void} 无返回值
   * @throws {void} 内部安全关闭连接
   */
  dispose() {
    if (this.navDebounceTimer) {
      clearTimeout(this.navDebounceTimer);
      this.navDebounceTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}

/**
 * 守护引擎核心类，负责监听 CDP 端口变动、多窗口多标签页管理与 CSS 文件热重载
 */
class CdpThemeInjectorDaemon {
  /**
   * 初始化守护引擎
   * 
   * @throws {void} 无异常抛出
   */
  constructor() {
    this.activeSessions = new Map(); // targetId -> PageInjectorSession
    this.isPolling = false;
  }

  /**
   * 启动守护引擎主循环
   * 
   * @returns {Promise<void>} 异步启动结果
   * @throws {Error} 捕获轮询或监控启动中的异常
   */
  async start() {
    console.log('==========================================================');
    console.log('    ChatGPT / Codex 运行时毛玻璃主题注入守护引擎');
    console.log('==========================================================');
    console.log(`监听端点: http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`主题文件: ${CONFIG.cssPath}`);
    console.log('正在等待客户端启动并开启调试接口...\n');

    // 预加载缓存
    getThemeCssState(CONFIG.cssPath, true);

    // 1. 启动 CSS 文件变更监听（热重载）
    this.setupCssFileWatcher();

    // 2. 循环轮询 targets
    setInterval(() => {
      this.pollTargets();
    }, CONFIG.pollIntervalMs);

    // 首次立即轮询一次
    await this.pollTargets();
  }

  /**
   * 设置本地 CSS 样式表文件的文件监听器，变更时全量推送热更新
   * 
   * @returns {void} 无返回值
   * @throws {void} 内部捕获 watcher 异常
   */
  setupCssFileWatcher() {
    try {
      let debounceTimer = null;
      fs.watch(CONFIG.cssPath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            console.log('\n[热重载触发] 检测到主题 CSS 文件被修改，正在向所有窗口推送最新样式...');
            getThemeCssState(CONFIG.cssPath, true);
            for (const session of this.activeSessions.values()) {
              if (session.isConnected) {
                session.injectStyle(true);
              }
            }
          }, 300);
        }
      });
      console.log('[热重载就绪] 已启用 CSS 实时动态热重载');
    } catch (err) {
      console.warn(`[热重载警告] 无法监听 CSS 文件: ${err.message}`);
    }
  }

  /**
   * 轮询目标端口，检索当前活跃的界面 target 并接入
   * 
   * @returns {Promise<void>} 异步轮询完成
   * @throws {void} 内部捕获请求与连接异常
   */
  async pollTargets() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const targets = await queryCdpEndpoint('/json/list');
      if (!targets || !Array.isArray(targets)) {
        // 端口未开启或应用未启动
        if (this.activeSessions.size > 0) {
          console.log('[状态变更] 客户端连接已中断，正在等待重连...');
          for (const session of this.activeSessions.values()) {
            session.dispose();
          }
          this.activeSessions.clear();
        }
        return;
      }

      /**
       * 判断 CDP 调试目标是否为需要注入透明主题的主应用窗口，排除悬浮宠物窗与内置/认证 WebView。
       * @param {object} target - CDP `/json/list` 返回的调试目标对象。
       * @returns {boolean} 仅当目标为主窗口 `app://-/index.html` 页面且非悬浮窗路由时返回 true。
       * @throws {TypeError} 当目标对象缺失或格式无效时抛出异常。
       */
      const isEligibleThemeTarget = (target) => {
        if (!target || typeof target !== 'object') {
          throw new TypeError('调试目标 target 必须为非空对象');
        }
        if (!target.webSocketDebuggerUrl || target.type !== 'page') {
          return false;
        }
        const url = typeof target.url === 'string' ? target.url : '';
        if (!url.startsWith('app://-/index.html')) {
          return false;
        }
        // 新版 26.1117 引入独立透明桌面伙伴悬浮窗 (?initialRoute=%2Favatar-overlay)，严禁注入全屏壁纸
        if (url.includes('avatar-overlay')) {
          return false;
        }
        return true;
      };

      // 筛选有效的主窗口渲染目标（仅作用于主窗口 page，排除 /avatar-overlay 与 webview）
      const validPages = targets.filter((t) => isEligibleThemeTarget(t));

      const currentTargetIds = new Set(validPages.map((t) => t.id));

      // 清理已关闭的 targets
      for (const [id, session] of this.activeSessions.entries()) {
        if (!currentTargetIds.has(id)) {
          session.dispose();
          this.activeSessions.delete(id);
        }
      }

      // 为新发现的 targets 建立注入会话
      for (const target of validPages) {
        if (!this.activeSessions.has(target.id)) {
          const session = new PageInjectorSession(target, CONFIG.cssPath);
          this.activeSessions.set(target.id, session);
          await session.connect();
        }
      }
    } catch (err) {
      console.error(`[轮询异常] ${err.message}`);
    } finally {
      this.isPolling = false;
    }
  }
}

// 主入口执行
const daemon = new CdpThemeInjectorDaemon();
daemon.start();
