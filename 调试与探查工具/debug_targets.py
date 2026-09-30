"""
列出所有 CDP targets 信息的调试脚本。
"""
import urllib.request
import json

def print_targets() -> None:
    """
    获取并打印本地 CDP 调试端口的所有 target 信息。

    :return: None
    :raises urllib.error.URLError: 网络连接异常
    """
    res = urllib.request.urlopen("http://127.0.0.1:9335/json/list")
    data = json.loads(res.read().decode("utf-8"))
    for idx, target in enumerate(data):
        print(f"[{idx}] type={target.get('type')} title={target.get('title')} url={target.get('url')[:100]}")

if __name__ == "__main__":
    print_targets()
