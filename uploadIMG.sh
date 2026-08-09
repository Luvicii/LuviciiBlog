#!/bin/bash
# ============================================
# Luvicii 图床一键上传脚本
# 用法:
#   ./uploadIMG.sh 图片1.png 图片2.jpg          # 上传,默认存到 2026/08/ 目录
#   ./uploadIMG.sh -d 文章名 a.png b.jpg        # 指定子目录
#   ./uploadIMG.sh -c "自定义说明" a.png        # 附带提交说明
# 输出: 每个图片的 jsDelivr 访问 URL
# ============================================

set -e

REPO_URL="https://Luvicii@github.com/Luvicii/Luvicii-images.git"
WORK_DIR="/tmp/luvicii-upload"
SUBDIR="$(date +%Y/%m)"
MESSAGE="upload images"

usage() {
  echo "用法: $0 [-d 子目录] [-c 提交说明] 图片... [-d 子目录] 图片..."
  exit 1
}

[ $# -eq 0 ] && usage

# 收集参数
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -d) SUBDIR="$2"; shift 2 ;;
    -c) MESSAGE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
[ ${#ARGS[@]} -eq 0 ] && usage

# 校验文件
for f in "${ARGS[@]}"; do
  [ -f "$f" ] || { echo "错误: 文件不存在: $f"; exit 1; }
done

# 克隆(复用)图床仓库
if [ ! -d "$WORK_DIR/.git" ]; then
  rm -rf "$WORK_DIR"
  git clone -q "$REPO_URL" "$WORK_DIR"
else
  git -C "$WORK_DIR" pull -q --ff-only origin main || true
fi

# 复制图片
for f in "${ARGS[@]}"; do
  name="$(basename "$f")"
  mkdir -p "$WORK_DIR/$SUBDIR"
  cp "$f" "$WORK_DIR/$SUBDIR/$name"
  echo "已添加: $SUBDIR/$name"
done

# 推送
git -C "$WORK_DIR" add -A
git -C "$WORK_DIR" commit -q -m "$MESSAGE" || { echo "没有新文件,未提交"; exit 0; }
for i in 1 2 3; do
  if git -C "$WORK_DIR" push -q origin main 2>/dev/null; then break; fi
  echo "推送失败,重试 $i..."
  sleep 5
done

# 输出 URL
echo
echo "================== 图片 URL =================="
for f in "${ARGS[@]}"; do
  name="$(basename "$f")"
  echo "https://cdn.jsdelivr.net/gh/Luvicii/Luvicii-images@main/$SUBDIR/$name"
done
echo "==============================================="
