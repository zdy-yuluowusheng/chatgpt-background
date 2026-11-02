"""
Inspect CSS rules matching Card 1 and its children to see why text is not drawn.
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.dirname(__file__))
from cdp_helper import get_page_ws_url, evaluate_script

async def main() -> None:
    """
    Check matched rules, font, color, text-indent, mix-blend-mode, text-shadow,
    containment, content-visibility, etc.

    :return: None
    :raises Exception: On failure
    """
    ws_url = get_page_ws_url()
    if not ws_url:
        print("Failed to find main window ws_url")
        return

    script = """
    (() => {
        const card1 = document.querySelectorAll('div.rounded-2xl.overflow-hidden.border.border-default')[1];
        if (!card1) return { error: '未找到 Card 1' };

        const span = card1.querySelector('span.truncate');
        const kbd = card1.querySelector('kbd');

        function inspectProps(el) {
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            return {
                tag: el.tagName,
                className: el.className,
                text: el.innerText,
                color: cs.color,
                fontFamily: cs.fontFamily,
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                lineHeight: cs.lineHeight,
                opacity: cs.opacity,
                visibility: cs.visibility,
                display: cs.display,
                overflow: cs.overflow,
                textIndent: cs.textIndent,
                transform: cs.transform,
                mixBlendMode: cs.mixBlendMode,
                isolation: cs.isolation,
                contentVisibility: cs.contentVisibility,
                contain: cs.contain,
                backdropFilter: cs.backdropFilter,
                filter: cs.filter,
                webkitTextFillColor: cs.webkitTextFillColor
            };
        }

        return {
            card: inspectProps(card1),
            row: inspectProps(card1.children[0]),
            span: inspectProps(span),
            kbd: inspectProps(kbd)
        };
    })()
    """
    res = await evaluate_script(ws_url, script)
    print("Props:", json.dumps(res, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
