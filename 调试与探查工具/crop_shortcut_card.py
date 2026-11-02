"""
Crop shortcut card region and examine pixels.
"""
import os
from PIL import Image

def main() -> None:
    """
    Crop the keyboard shortcuts card area to closely inspect text rendering.

    :return: None
    """
    img_path = r"d:\work\chatgpt-background\验收_当前快捷键即时截图.png"
    if not os.path.exists(img_path):
        print("Image does not exist")
        return
    img = Image.open(img_path)
    # 裁剪卡片区域 (left: 400, top: 250, right: 1200, bottom: 750)
    # 注意需要考虑系统缩放比或图片实际分辨率
    w, h = img.size
    print(f"Image dimensions: {w}x{h}")
    # 实际截图尺寸是多大？如果是 2x 或 1.5x 或原尺寸
    crop_box = (int(w * 0.25), int(h * 0.25), int(w * 0.8), int(h * 0.8))
    cropped = img.crop(crop_box)
    cropped.save(r"d:\work\chatgpt-background\验收_快捷键卡片区域局部特写.png")
    print("Cropped saved")

if __name__ == "__main__":
    main()
