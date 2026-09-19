/**
 * 相册横幅「照片墙」素材
 *
 * 为什么需要：照片墙要用相册图片做背景，而相册里常有 4K/5K 原图（单张 7MB、解码后 59MB），
 * 浏览器把它们缩到 181x304 显示时会明显掉帧。这里在构建期把它们统一压成 360x600 的 webp
 * （每张约 20~40KB），文件落在 themes/luvicii/source/img/wall/，由 Hexo 正常复制进站点。
 *
 * 使用方式：什么都不用做。新增相册照片后正常构建（hexo g / hexo server）即可自动补生成，
 * 生成的图片随其他改动一起提交；CI 构建时文件已存在会直接跳过，不会重复下载。
 * 需要 ImageMagick（magick / convert）；缺失时会告警并回退用原图。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const PER_ALBUM = 24 // 每个相册最多取几张进素材池
const W = 360 // 缩略图宽（照片墙格子 181px，取 2 倍图）
const H = 600
const QUALITY = 78
const URL_PREFIX = '/img/wall/'

const wallDir = () => path.join(hexo.theme_dir, 'source', 'img', 'wall')
const thumbName = url => 'wall-' + crypto.createHash('md5').update(url).digest('hex').slice(0, 10) + '.webp'

// 读取相册数据并按「固定种子洗牌 + 每册配额」抽出素材池（同一份数据结果稳定）
function poolUrls() {
  let albums = []
  try {
    albums = hexo.render.renderSync({ path: path.join(hexo.source_dir, '_data', 'album.yml'), engine: 'yaml' }) || []
  } catch (e) {
    return []
  }
  const out = []
  for (const a of albums) {
    const urls = []
    if (a && a.cover) urls.push(a.cover)
    for (const it of (a && a.album_list) || []) {
      for (const im of (it && it.image) || []) {
        if (!urls.includes(im)) urls.push(im)
      }
    }
    if (!urls.length) continue
    // 按 URL 哈希排序取前 PER_ALBUM 张：与顺序无关、结果稳定——
    // 相册里新增照片时只会替换掉"哈希排在最后"的那张，其余缩略图可继续复用，不必重新下载生成
    const h = u => crypto.createHash('md5').update(u).digest('hex')
    urls.slice().sort((x, y) => (h(x) < h(y) ? -1 : 1)).slice(0, PER_ALBUM).forEach(u => out.push(u))
  }
  return [...new Set(out)]
}

function findMagick() {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' })
      return bin
    } catch (e) {
      /* 继续找 */
    }
  }
  return null
}

// 构建前：补齐缺失的缩略图
hexo.extend.filter.register('before_generate', () => {
  const dir = wallDir()
  fs.mkdirSync(dir, { recursive: true })

  const urls = poolUrls()
  if (!urls.length) return // 相册数据读不到就别乱动（下面会清理孤儿文件）

  // 清理孤儿：相册换过图之后，旧 URL 生成的缩略图不再被引用，顺手删掉避免目录越堆越大
  const keep = new Set(urls.map(thumbName))
  for (const f of fs.readdirSync(dir)) {
    if (/^wall-[0-9a-f]{10}\.webp$/.test(f) && !keep.has(f)) {
      try { fs.unlinkSync(path.join(dir, f)) } catch (e) { /* ignore */ }
    }
  }

  const missing = urls.filter(u => !fs.existsSync(path.join(dir, thumbName(u))))
  if (!missing.length) return

  const magick = findMagick()
  if (!magick) {
    hexo.log.warn('[photo-wall] 未找到 ImageMagick，跳过缩略图生成；照片墙将回退使用原图（可能掉帧）')
    return
  }

  hexo.log.info('[photo-wall] 生成 %d 张缩略图（首次或相册有更新时才会有这一步）', missing.length)
  const tmp = path.join(require('os').tmpdir(), 'photo-wall-' + process.pid)
  fs.mkdirSync(tmp, { recursive: true })

  let ok = 0
  missing.forEach((url, i) => {
    const raw = path.join(tmp, 'raw')
    const out = path.join(dir, thumbName(url))
    try {
      execFileSync('curl', ['-sSL', '--max-time', '120', '-o', raw, url], { stdio: 'ignore' })
      execFileSync(magick, [raw, '-auto-orient', '-resize', W + 'x' + H + '^', '-gravity', 'center',
        '-extent', W + 'x' + H, '-strip', '-quality', String(QUALITY), out], { stdio: 'ignore' })
      if (fs.existsSync(out) && fs.statSync(out).size > 0) {
        ok++
        hexo.log.debug('[photo-wall] %d/%d %s', i + 1, missing.length, path.basename(out))
      }
    } catch (e) {
      try { fs.unlinkSync(out) } catch (e2) { /* ignore */ }
      hexo.log.warn('[photo-wall] 生成失败：%s', url.split('/').pop())
    }
  })
  fs.rmSync(tmp, { recursive: true, force: true })
  hexo.log.info('[photo-wall] 完成：%d/%d 张（新增文件记得随提交一起提交，CI 就不用再生成）', ok, missing.length)
})

// 模板用：返回当前可用的本地缩略图清单
hexo.extend.helper.register('photo_wall_pool', function () {
  const dir = wallDir()
  return poolUrls()
    .map(u => thumbName(u))
    .filter(f => fs.existsSync(path.join(dir, f)))
    .map(f => URL_PREFIX + f)
})
