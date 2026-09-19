#!/bin/bash
# ============================================
# 图床（Luvicii/Luvicii-images）上传公共库
#
# 为什么不用 git：仓库已经 500MB+，克隆在抖动的网络下几乎跑不完；
# 而上传只需要几个文件，走 GitHub API 几秒钟就能完成，且不需要本地仓库。
#
# 用法（在其它脚本里 source 本文件）：
#   cdn_init                              # 读凭据、取当前 HEAD
#   cdn_add music/foo.mp3 /path/foo.mp3   # 加入待提交列表（会立刻上传该文件的 blob）
#   sha=$(cdn_commit "upload music: foo") # 生成一次提交并更新 main，回显新 sha
#
# 代理：
#   PROXY=http://127.0.0.1:7890 ./uploadMusic.sh ...   显式指定
#   不指定时自动探测常见本地端口（7890 / 7897 / 10809 / 1080 / 8118）
#   连接失败会"直连 → 代理"交替重试；API 本身报错（如 403/422）则直接报错，不盲目重试
#
# GitHub 加速站（GH_PROXY）：
#   GH_PROXY=https://gh-proxy.com/    默认值；GH_PROXY= 可关闭
#   它是"URL 前缀"型加速站，即 https://gh-proxy.com/https://github.com/... 这种写法。
#   ⚠️ 只用于【读】：克隆 / ls-remote / API GET（实测 clone refs 1.6s vs 直连 4.0s）。
#   写操作（POST/PATCH）绝不能走它：它不转发 Authorization 头，请求会退化成匿名请求，
#   实测建 blob、更新 ref 一律 403 "Resource not accessible by personal access token"，
#   直连则 201。所以上传始终直连（或本地代理），gh-proxy 只做读失败时的兜底。
#
#   加速克隆（本仓库 500MB+，一般不需要整仓克隆，下面写法只作参考）：
#     source ./cdn-api.sh && git clone "$(cdn_git_url Luvicii/Luvicii-images)"
#
# 注意：GitHub API 匿名请求会 403，必须带 ~/.git-credentials 里 Luvicii 的 token
# ============================================

CDN_REPO="${CDN_REPO:-Luvicii/Luvicii-images}"
CDN_BRANCH="${CDN_BRANCH:-main}"
CDN_API="https://api.github.com/repos/$CDN_REPO"
GH_PROXY="${GH_PROXY-https://gh-proxy.com/}"

CDN_PROXY=""
CDN_TOKEN=""
CDN_HEAD=""
CDN_HEAD_TREE=""
CDN_ENTRIES=""

cdn_detect_proxy() {
  if [ -n "$PROXY" ]; then CDN_PROXY="$PROXY"; echo "（使用代理 $CDN_PROXY）"; return; fi
  if [ -n "$https_proxy" ]; then CDN_PROXY="$https_proxy"; echo "（使用代理 $CDN_PROXY）"; return; fi
  if [ -n "$HTTPS_PROXY" ]; then CDN_PROXY="$HTTPS_PROXY"; echo "（使用代理 $CDN_PROXY）"; return; fi
  local p
  for p in 7890 7897 10809 1080 8118; do
    if curl -s -o /dev/null -m 4 -x "http://127.0.0.1:$p" https://api.github.com 2>/dev/null; then
      CDN_PROXY="http://127.0.0.1:$p"
      echo "（自动发现本地代理 $CDN_PROXY）"
      return
    fi
  done
  echo "（未发现本地代理，直连）"
}

cdn_token() {
  local raw
  raw=$(cat "$HOME/.git-credentials" 2>/dev/null) || return 1
  printf '%s' "$raw" | tr '\r' '\n' | while IFS= read -r line; do
    case "$line" in
      https://Luvicii:*) printf '%s' "$line" | sed -e 's#^https://Luvicii:##' -e 's#@github.com.*##' ;;
    esac
  done
}

# 加速克隆地址：cdn_git_url [owner/repo] → 回显可直接 git clone 的 URL
cdn_git_url() {
  local repo="${1:-$CDN_REPO}"
  printf '%shttps://github.com/%s.git' "$GH_PROXY" "$repo"
}

# 调 API：连接失败才重试（直连/代理/加速站轮换）；HTTP 错误直接报告
# 读请求（GET）可走 GH_PROXY 兜底；写请求只走直连/本地代理（加速站会丢 Authorization → 403）
cdn_api() {
  local method="$1" path="$2" body=""
  [ $# -ge 3 ] && body="$3"
  local url="$CDN_API$path"
  local modes="direct proxy"
  [ "$method" = "GET" ] && [ -n "$GH_PROXY" ] && modes="direct proxy ghproxy"
  local round=1 mode last_err="连接失败"
  while [ "$round" -le 3 ]; do
    for mode in $modes; do
      if [ "$mode" = proxy ] && [ -z "$CDN_PROXY" ]; then continue; fi
      local args=(-sS -m 300 -w '\n%{http_code}' -X "$method"
        -H "Authorization: token $CDN_TOKEN"
        -H "Accept: application/vnd.github+json"
        -H "X-GitHub-Api-Version: 2022-11-28"
        -H "User-Agent: luvicii-cdn-upload")
      if [ "$mode" = proxy ]; then args+=(-x "$CDN_PROXY"); fi
      if [ -n "$body" ]; then args+=(--data-binary "@$body"); fi
      local req_url="$url"
      [ "$mode" = ghproxy ] && req_url="${GH_PROXY}${url}"
      local out code payload
      if out=$(curl "${args[@]}" "$req_url" 2>/dev/null); then
        code=$(printf '%s' "$out" | tail -n1)
        payload=$(printf '%s' "$out" | sed '$d')
        if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 300 ] 2>/dev/null; then
          printf '%s' "$payload"
          return 0
        fi
        if [ "$code" != "000" ]; then
          echo "错误：API $method $path 返回 $code —— $(printf '%s' "$payload" | tr -d '\n' | head -c 220)" >&2
          return 1
        fi
        last_err="连接被中断"
      fi
    done
    round=$((round + 1))
    if [ "$round" -le 3 ]; then echo "  $last_err，重试第 $round 轮（直连/代理/加速站轮换）…" >&2; sleep 4; fi
  done
  echo "错误：访问 GitHub API 失败（$last_err）" >&2
  return 1
}

cdn_init() {
  cdn_detect_proxy
  CDN_TOKEN=$(cdn_token)
  if [ -z "$CDN_TOKEN" ]; then echo "错误：~/.git-credentials 里找不到 Luvicii 的凭据" >&2; return 1; fi
  CDN_ENTRIES=$(mktemp)
  : > "$CDN_ENTRIES"
  local ref commit
  ref=$(cdn_api GET "/git/ref/heads/$CDN_BRANCH") || return 1
  CDN_HEAD=$(printf '%s' "$ref" | jq -r '.object.sha // empty')
  if [ -z "$CDN_HEAD" ]; then echo "错误：取不到 $CDN_BRANCH 的 HEAD" >&2; return 1; fi
  commit=$(cdn_api GET "/git/commits/$CDN_HEAD") || return 1
  CDN_HEAD_TREE=$(printf '%s' "$commit" | jq -r '.tree.sha // empty')
  if [ -z "$CDN_HEAD_TREE" ]; then echo "错误：取不到 HEAD 的 tree" >&2; return 1; fi
  echo "远端 $CDN_BRANCH：$(printf '%s' "$CDN_HEAD" | cut -c1-7)"
}

# cdn_add <仓库内路径> <本地文件>
cdn_add() {
  local repo_path="$1" file="$2"
  if [ ! -f "$file" ]; then echo "错误：文件不存在 $file" >&2; return 1; fi
  local body resp sha size
  body=$(mktemp)
  python3 - "$file" > "$body" <<'PY'
import base64, json, sys
with open(sys.argv[1], 'rb') as f:
    data = f.read()
print(json.dumps({"content": base64.b64encode(data).decode(), "encoding": "base64"}))
PY
  resp=$(cdn_api POST "/git/blobs" "$body") || { rm -f "$body"; return 1; }
  rm -f "$body"
  sha=$(printf '%s' "$resp" | jq -r '.sha // empty')
  if [ -z "$sha" ]; then echo "错误：上传 blob 失败 $repo_path" >&2; return 1; fi
  python3 - "$repo_path" "$sha" >> "$CDN_ENTRIES" <<'PY'
import json, sys
print(json.dumps({"path": sys.argv[1], "mode": "100644", "type": "blob", "sha": sys.argv[2]}))
PY
  size=$(( $(stat -c %s "$file") / 1024 ))
  printf '  已上传 %-30s %s KB\n' "$repo_path" "$size"
}

# cdn_commit <提交说明> → 回显新提交 sha
cdn_commit() {
  local message="$1"
  local body resp tree commit
  body=$(mktemp)
  python3 - "$CDN_ENTRIES" "$CDN_HEAD_TREE" > "$body" <<'PY'
import json, sys
entries = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
print(json.dumps({"base_tree": sys.argv[2], "tree": entries}))
PY
  resp=$(cdn_api POST "/git/trees" "$body") || { rm -f "$body"; return 1; }
  tree=$(printf '%s' "$resp" | jq -r '.sha // empty')
  if [ -z "$tree" ]; then rm -f "$body"; echo "错误：创建 tree 失败" >&2; return 1; fi

  python3 - "$message" "$tree" "$CDN_HEAD" > "$body" <<'PY'
import json, sys
print(json.dumps({"message": sys.argv[1], "tree": sys.argv[2], "parents": [sys.argv[3]]}))
PY
  resp=$(cdn_api POST "/git/commits" "$body") || { rm -f "$body"; return 1; }
  commit=$(printf '%s' "$resp" | jq -r '.sha // empty')
  if [ -z "$commit" ]; then rm -f "$body"; echo "错误：创建 commit 失败" >&2; return 1; fi

  python3 - "$commit" > "$body" <<'PY'
import json, sys
print(json.dumps({"sha": sys.argv[1]}))
PY
  cdn_api PATCH "/git/refs/heads/$CDN_BRANCH" "$body" >/dev/null || { rm -f "$body"; return 1; }
  rm -f "$body"
  printf '%s' "$commit"
}
