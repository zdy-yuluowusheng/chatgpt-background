/**
 * @file 对比壁纸数据.js
 * @description 对比 antigravity-background 与 chatgpt-background 的壁纸 base64 数据与配置差异
 */

import fs from 'node:fs';

/**
 * 对比两处的壁纸数据并输出长度与匹配情况
 * 
 * @returns {void}
 * @throws {Error} 文件读取失败时抛出错误
 */
function compareWallpapers() {
  try {
    const c1 = fs.readFileSync('d:/work/chatgpt-background/主题样式/晨雾森林毛玻璃主题.css', 'utf8');
    const c2 = fs.readFileSync('d:/work/antigravity-background/主题样式/晨雾森林毛玻璃主题.css', 'utf8');
    const m1 = c1.match(/url\("data:image\/jpeg;base64,([^"]+)"\)/);
    const m2 = c2.match(/url\("data:image\/jpeg;base64,([^"]+)"\)/);
    console.log('chatgpt wallpaper base64 len:', m1 ? m1[1].length : 0);
    console.log('antigravity wallpaper base64 len:', m2 ? m2[1].length : 0);
    console.log('base64 is identical:', m1 && m2 && m1[1] === m2[1]);
  } catch (err) {
    console.error('对比异常:', err);
  }
}

compareWallpapers();
