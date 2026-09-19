#!/bin/bash
# ============================================
# Luvicii 音乐一键上传（走 GitHub API，不克隆仓库）
#
# 用法:
#   ./uploadMusic.sh 歌曲.mp3                      # 只传音频
#   ./uploadMusic.sh 歌曲.flac 封面.jpg 歌词.lrc     # 音频+封面+歌词，顺序随意、可省略
#   PROXY=http://127.0.0.1:7890 ./uploadMusic.sh …  # 指定代理（默认自动探测本地端口）
#   DRY_RUN=1 ./uploadMusic.sh …                    # 只打印将要做的操作，不真的上传
#
# 输出: 可直接粘贴到 _config.luvicii.yml 的 music_playlist 配置
#       （歌词 URL 自动固定到本次提交 sha，避免 jsDelivr 缓存旧内容）
# ============================================

set -e
cd "$(dirname "$0")"
source ./cdn-api.sh

if [ $# -lt 1 ]; then echo "用法: $0 歌曲.mp3 [封面.jpg] [歌词.lrc]"; exit 1; fi

AUDIO=""; COVER=""; LRC=""; FILES=()
for f in "$@"; do
  [ "$f" = "-" ] && continue
  if [ ! -f "$f" ]; then echo "错误: 文件不存在: $f" >&2; exit 1; fi
  case "$(echo "${f##*.}" | tr 'A-Z' 'a-z')" in
    mp3|m4a|flac|wav|ogg|aac) AUDIO="$f" ;;
    lrc) LRC="$f" ;;
    jpg|jpeg|png|webp|gif|bmp) COVER="$f" ;;
    *) echo "错误: 无法识别的文件类型: $f" >&2; exit 1 ;;
  esac
  FILES+=("$f")
done
if [ -z "$AUDIO" ]; then echo "错误: 缺少音频文件（.mp3/.m4a/.flac/.wav/.ogg/.aac）" >&2; exit 1; fi

if [ -n "$DRY_RUN" ]; then
  echo "[DRY_RUN] 将上传到 music/："
  for f in "${FILES[@]}"; do echo "  - $(basename "$f")"; done
  exit 0
fi

cdn_init
for f in "${FILES[@]}"; do
  cdn_add "music/$(basename "$f")" "$f"
done
SHA=$(cdn_commit "upload music: $(basename "$AUDIO")")
if [ -z "$SHA" ]; then echo "错误: 提交失败" >&2; exit 1; fi
echo "✓ 新提交 $(printf '%s' "$SHA" | cut -c1-7)"

CDN="https://fastly.jsdelivr.net/gh/Luvicii/Luvicii-images"
SONG="$(basename "$AUDIO")"; SONG="${SONG%.*}"
name_of() { printf '%s' "$(basename "$1")"; }
echo
echo "===== 粘贴到 _config.luvicii.yml 的 music_playlist 中 ====="
echo "  - name: $SONG"
echo "    songs:"
echo "      - name: $SONG"
echo "        artist: 歌手名"
echo "        url: \"$CDN@main/music/$(name_of "$AUDIO")\""
if [ -n "$COVER" ]; then echo "        cover: \"$CDN@main/music/$(name_of "$COVER")\" "; fi
if [ -n "$LRC" ]; then echo "        lrc: \"$CDN@$SHA/music/$(name_of "$LRC")\"   # 固定版本，避免 jsDelivr 缓存"; fi
echo "=========================================================="
