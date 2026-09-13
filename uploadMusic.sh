#!/bin/bash
# ============================================
# Luvicii 音乐一键上传脚本(与图床同仓库,存到 music/ 目录)
# 用法:
#   ./uploadMusic.sh 歌曲.mp3                   # 只传音频
#   ./uploadMusic.sh 歌曲.mp3 封面.jpg          # 音频+封面
#   ./uploadMusic.sh 歌曲.mp3 封面.jpg 歌词.lrc # 音频+封面+歌词
# 输出: 可直接粘贴到 _config.luvicii.yml 的歌曲配置(YAML)
# ============================================

set -e

REPO_URL="${REPO_URL:-https://Luvicii@github.com/Luvicii/Luvicii-images.git}"  # 可用 REPO_URL=... 覆盖（如 github.com:443 不通时改用 SSH 地址）
WORK_DIR="/tmp/luvicii-upload"
SUBDIR="music"
CDN="https://fastly.jsdelivr.net/gh/Luvicii/Luvicii-images@main"

[ $# -lt 1 ] && { echo "用法: $0 歌曲.mp3 [封面.jpg] [歌词.lrc]"; exit 1; }

AUDIO=""
COVER=""
LRC=""
FILES=()

# 按扩展名识别角色，参数顺序随意；封面可省略或用 - 占位
for f in "$@"; do
  [ "$f" = "-" ] && continue
  [ -f "$f" ] || { echo "错误: 文件不存在: $f"; exit 1; }
  case "$(echo "${f##*.}" | tr 'A-Z' 'a-z')" in
    mp3|m4a|flac|wav|ogg|aac) AUDIO="$f" ;;
    lrc) LRC="$f" ;;
    jpg|jpeg|png|webp|gif|bmp) COVER="$f" ;;
    *) echo "错误: 无法识别的文件类型: $f (仅支持 音频/图片/lrc)" >&2; exit 1 ;;
  esac
  FILES+=("$f")
done

[ -n "$AUDIO" ] || { echo "错误: 缺少音频文件 (.mp3/.m4a/.flac/.wav/.ogg/.aac)" >&2; exit 1; }

# 克隆(复用)图床仓库
if [ ! -d "$WORK_DIR/.git" ]; then
  rm -rf "$WORK_DIR"
  git clone -q "$REPO_URL" "$WORK_DIR"
else
  git -C "$WORK_DIR" pull -q --ff-only origin main || true
fi

# 复制文件
mkdir -p "$WORK_DIR/$SUBDIR"
for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  cp "$f" "$WORK_DIR/$SUBDIR/$name"
  echo "已添加: $SUBDIR/$name"
done

# 推送
git -C "$WORK_DIR" add -A
git -C "$WORK_DIR" commit -q -m "upload music: $(basename "$AUDIO")" || { echo "没有新文件,未提交"; exit 0; }
PUSHED=0
for i in 1 2 3; do
  if git -C "$WORK_DIR" push -q origin main 2>/dev/null; then PUSHED=1; break; fi
  echo "推送失败,重试 $i..."
  sleep 5
done
if [ "$PUSHED" != "1" ]; then
  echo "错误: 推送失败,文件尚未上传成功" >&2
  echo "可稍后手动执行: git -C $WORK_DIR pull --rebase origin main && git -C $WORK_DIR push origin main" >&2
  exit 1
fi

SONG_NAME="$(basename "$AUDIO")"
SONG_NAME="${SONG_NAME%.*}"

# 输出配置
echo
echo "===== 将以下内容粘贴到 _config.luvicii.yml 本地歌单的 songs 列表中 ====="
echo "      - name: $SONG_NAME"
echo "        artist: 歌手名"
echo "        url: $CDN/$SUBDIR/$(basename "$AUDIO")"
[ -n "$COVER" ] && echo "        cover: $CDN/$SUBDIR/$(basename "$COVER")"
[ -n "$LRC" ] && echo "        lrc: $CDN/$SUBDIR/$(basename "$LRC")"
echo "========================================================================="
