#!/bin/bash
# ============================================
# Luvicii 图床一键上传（走 GitHub API，不克隆仓库）
#
# 用法:
#   ./uploadIMG.sh 图片1.png 图片2.jpg              # 上传到 <年>/<月>/ 目录
#   ./uploadIMG.sh -d 文章名 a.png b.jpg            # 指定子目录
#   ./uploadIMG.sh -c "自定义说明" a.png            # 附带提交说明
#   PROXY=http://127.0.0.1:7890 ./uploadIMG.sh …    # 指定代理（默认自动探测本地端口）
#   注意: gh-proxy 这类加速站只用于读（克隆/GET），上传写操作直连 —— 详见 cdn-api.sh 头部
#   DRY_RUN=1 ./uploadIMG.sh …                      # 只打印，不上传
#
# 输出: 每个图片的 jsDelivr 访问 URL
# ============================================

set -e
cd "$(dirname "$0")"
source ./cdn-api.sh

SUBDIR="$(date +%Y/%m)"
MESSAGE="upload images"
ARGS=()

usage() { echo "用法: $0 [-d 子目录] [-c 提交说明] 图片..."; exit 1; }
[ $# -eq 0 ] && usage

while [ $# -gt 0 ]; do
  case "$1" in
    -d) SUBDIR="$2"; shift 2 ;;
    -c) MESSAGE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
[ ${#ARGS[@]} -eq 0 ] && usage

for f in "${ARGS[@]}"; do
  if [ ! -f "$f" ]; then echo "错误: 文件不存在: $f" >&2; exit 1; fi
done

if [ -n "$DRY_RUN" ]; then
  echo "[DRY_RUN] 将上传到 $SUBDIR/ ："
  for f in "${ARGS[@]}"; do echo "  - $(basename "$f")"; done
  exit 0
fi

cdn_init
for f in "${ARGS[@]}"; do
  cdn_add "$SUBDIR/$(basename "$f")" "$f"
done
SHA=$(cdn_commit "$MESSAGE")
if [ -z "$SHA" ]; then echo "错误: 提交失败" >&2; exit 1; fi
echo "✓ 新提交 $(printf '%s' "$SHA" | cut -c1-7)"

echo
echo "================== 图片 URL =================="
for f in "${ARGS[@]}"; do
  echo "https://fastly.jsdelivr.net/gh/Luvicii/Luvicii-images@main/$SUBDIR/$(basename "$f")"
done
echo "=============================================="
