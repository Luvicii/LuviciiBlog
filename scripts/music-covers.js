"use strict";

// 构建时为 music_playlist 本地歌单中缺少 cover 的歌曲自动补全封面：
// 通过 QQ 音乐公开搜索接口匹配歌曲，再用 albummid 拼出封面直链。
// 结果缓存在 source/_data/music_cover_cache.json（可提交，后续构建无需再请求）。

const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(hexo.source_dir, "_data", "music_cover_cache.json");
const COVER_TPL = mid => `https://y.gtimg.cn/music/photo_new/T002R300x300M000${mid}.jpg`;
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" };

const norm = s => (s || "").toLowerCase().replace(/\s+/g, "");

async function searchCover(name, artist) {
  const keyword = encodeURIComponent(`${name} ${artist || ""}`.trim());
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${keyword}&format=json&p=1&n=5&t=0`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  const songs = data && data.data && data.data.song && data.data.song.list;
  if (!songs || !songs.length) return null;
  const hit = songs.find(s => norm(s.songname) === norm(name)) || songs[0];
  return hit && hit.albummid ? COVER_TPL(hit.albummid) : null;
}

hexo.extend.filter.register("before_generate", async function () {
  const list = hexo.theme.config.music_playlist;
  if (!Array.isArray(list)) return;
  const localLists = list.filter(item => item && Array.isArray(item.songs));
  if (!localLists.length) return;

  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch (e) {}

  let cacheChanged = false;
  for (const item of localLists) {
    for (const song of item.songs) {
      if (!song || song.cover || !song.name) continue;
      const key = `${song.name}|${song.artist || ""}`;
      if (cache[key]) {
        song.cover = cache[key];
        continue;
      }
      try {
        const cover = await searchCover(song.name, song.artist);
        if (cover) {
          cache[key] = cover;
          cacheChanged = true;
          song.cover = cover;
          hexo.log.info(`[music-cover] ${song.name} - ${song.artist || ""} -> ${cover}`);
        } else {
          hexo.log.warn(`[music-cover] 未找到封面: ${song.name} - ${song.artist || ""}`);
        }
      } catch (e) {
        hexo.log.warn(`[music-cover] 查询失败: ${song.name} (${e.message})`);
      }
    }
  }
  if (cacheChanged) {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  }
});
