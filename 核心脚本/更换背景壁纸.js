/**
 * @file 更换背景壁纸.js
 * @description 将指定图片文件转换为 Base64 编码，自动替换 ChatGPT/Codex 主题 CSS 中的壁纸数据
 * @author Antigravity Assistant
 */

const fs = require('fs');
const path = require('path');

/**
 * 将指定图片文件编码为 Base64 Data URL 并安全写入主题 CSS 样式表
 * 
 * @param {string} imagePath - 目标壁纸图片的绝对路径或相对路径（支持 jpg、png、webp 等主流格式）
 * @param {string} cssPath - 待更新的主题 CSS 文件路径
 * @param {number} [darkenOpacity=0.50] - 壁纸暗化遮罩层不透明度（0.0 为完全明亮，1.0 为纯黑遮罩）
 * @returns {boolean} 更新成功返回 true
 * @throws {Error} 当图片文件不存在、格式非法或 CSS 文件写入失败时抛出异常
 */
function replaceWallpaper(imagePath, cssPath, darkenOpacity = 0.50) {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`找不到指定的图片文件: ${imagePath}`);
    }

    console.log(`[1/3] 正在读取图片文件: ${imagePath}`);
    const imgBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';

    const base64Data = imgBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    console.log(`[2/3] 图片 Base64 转码完成，原始体积: ${(imgBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    if (!fs.existsSync(cssPath)) {
      throw new Error(`找不到目标 CSS 文件: ${cssPath}`);
    }

    console.log(`[3/3] 正在更新主题样式表: ${cssPath}`);
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 定位 background-image:
    const bgStart = cssContent.indexOf('background-image:');
    if (bgStart === -1) {
      throw new Error('未在主题 CSS 中定位到 background-image: 声明区块');
    }

    let updatedCss = cssContent;

    // 1. 更新遮罩暗化度
    if (darkenOpacity !== null && darkenOpacity !== undefined && !isNaN(darkenOpacity)) {
      const gradientRegex = /linear-gradient\(rgba\([^)]+\),\s*rgba\([^)]+\)\)/;
      if (gradientRegex.test(updatedCss)) {
        const newGradient = `linear-gradient(rgba(0, 0, 0, ${darkenOpacity.toFixed(2)}), rgba(0, 0, 0, ${darkenOpacity.toFixed(2)}))`;
        updatedCss = updatedCss.replace(gradientRegex, newGradient);
      }
    }

    // 2. 定位 Base64 替换范围
    const urlStart = updatedCss.indexOf('url("', bgStart);
    if (urlStart === -1) {
      throw new Error('未在主题 CSS 中定位到 url(" 声明');
    }

    const dataStart = urlStart + 'url("'.length;
    const dataEnd = updatedCss.indexOf('")', dataStart);
    if (dataEnd === -1) {
      throw new Error('未在主题 CSS 中定位到 Base64 结束引号 ")');
    }

    updatedCss = updatedCss.slice(0, dataStart) + dataUrl + updatedCss.slice(dataEnd);
    fs.writeFileSync(cssPath, updatedCss, 'utf8');

    console.log('[成功] ChatGPT/Codex 主题壁纸更新完毕！');
    return true;
  } catch (err) {
    console.error('[错误] 更换壁纸失败:', err.message);
    throw err;
  }
}

module.exports = { replaceWallpaper };

if (require.main === module) {
  const args = process.argv.slice(2);
  const defaultImg = path.join(__dirname, '..', '主题样式', '壁纸原图.jpg');
  const defaultCss = path.join(__dirname, '..', '主题样式', '晨雾森林毛玻璃主题.css');

  const targetImage = args[0] ? path.resolve(args[0]) : defaultImg;
  const opacity = args[1] !== undefined ? parseFloat(args[1]) : 0.50;

  replaceWallpaper(targetImage, defaultCss, opacity);
}
