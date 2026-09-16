/**
 * 页面（非文章）默认关闭评论区
 *
 * Hexo 的模型层把 Page.comments 默认成 true（node_modules/hexo/dist/models/page.js:24），
 * 主题模板因此区分不出「front-matter 显式开启」和「模型默认值」，写 page.comments === true
 * 之类的判断对每个页面都成立。这里在每条路由渲染前（template_locals）按源文件的
 * front-matter 重新判定：只有显式写了 comments: true 的页面才渲染评论区。
 *
 * 文章（source/_posts/**）不在此列，保持 Hexo 默认行为，仍用 front-matter 的
 * comments: false 关闭。
 */
'use strict'

const fs = require('fs')
const pathFn = require('path')
const frontMatter = require('hexo-front-matter')

const POST_RE = /^_posts[\\/]/

hexo.extend.filter.register('template_locals', locals => {
  const page = locals && locals.page
  if (!page || !page.source || POST_RE.test(page.source)) return locals

  let enabled = false
  try {
    const raw = fs.readFileSync(pathFn.join(hexo.source_dir, page.source), 'utf8')
    enabled = frontMatter.parse(raw).comments === true
  } catch (e) {
    enabled = false // 读不到源文件（生成器造出来的页面）一律按关闭处理
  }
  page.comments = enabled
  return locals
})
