/**
 * Luvicii
 * Merge CDN
 *
 * 主题自身资源（main.js / utils.js / CSS 等）一律本地自托管，不带任何 CDN 分支；
 * 只有第三方库（plugins.yml）按 CDN.third_party_provider 生成 CDN 地址，
 * 需要本地化的条目在 CDN.option 里逐条覆盖为本地路径。
 */

"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

hexo.extend.filter.register("before_generate", () => {
  const themeConfig = hexo.theme.config;
  const { CDN } = themeConfig;

  // 缓存破除：本地内部资源带内容哈希，CSS 带构建时间戳（hexo g/Server 每次生成都变）
  const buildStamp = Date.now().toString(36);
  const fileHash = file => {
    try {
      const abs = path.join(hexo.theme_dir, "source", file);
      return crypto.createHash("md5").update(fs.readFileSync(abs)).digest("hex").slice(0, 8);
    } catch (e) {
      return buildStamp;
    }
  };

  const thirdPartySrc = hexo.render.renderSync({ path: path.join(hexo.theme_dir, "/plugins.yml"), engine: "yaml" });

  // 主题自身脚本：路径写死本地，附内容哈希做缓存破除
  const internalSrc = {
    main: "js/main.js",
    utils: "js/utils.js",
    translate: "js/tw_cn.js",
    local_search: "js/search/local-search.js",
    algolia_js: "js/search/algolia.js",
    random_friends_post_js: "js/luvicii/random_friends_post.js",
    right_click_menu_js: "js/luvicii/right_click_menu.js",
    comment_barrage_js: "js/luvicii/comment_barrage.js",
    ai_abstract_js: "js/luvicii/ai_abstract.js",
    people_js: "js/luvicii/people.js",
  };
  const internalAssets = { main_css: `css/index.css?v=${buildStamp}` };
  Object.keys(internalSrc).forEach(key => {
    internalAssets[key] = `${internalSrc[key]}?v=${fileHash(internalSrc[key])}`;
  });

  const minFile = file => {
    return file.replace(/(?<!\.min)\.(js|css)$/g, ext => ".min" + ext);
  };

  // 第三方库：生成 CDN 地址
  const createCDNLink = (data, type) => {
    Object.keys(data).map(key => {
      let { name, version, file, other_name } = data[key];

      const cdnjs_name = other_name || name;
      const cdnjs_file = file.replace(/^[lib|dist]*\/|browser\//g, "");
      const min_cdnjs_file = minFile(cdnjs_file);
      const min_file = minFile(file);
      const verType = CDN.version ? `@${version}` : "";

      const value = {
        version,
        name,
        file,
        cdnjs_file,
        min_file,
        min_cdnjs_file,
        cdnjs_name,
      };
      const cdnSource = {
        local: `/pluginsSrc/${name}/${file}`,
        jsdelivr: `https://cdn.jsdelivr.net/npm/${name}${verType}/${min_file}`,
        unpkg: `https://unpkg.com/${name}${verType}/${file}`,
        cdnjs: `https://cdnjs.cloudflare.com/ajax/libs/${cdnjs_name}/${version}/${min_cdnjs_file}`,
        elemecdn: `https://npm.elemecdn.com/${name}${verType}/${file}`,
        onmicrosoft: `https://npm.onmicrosoft.cn/${name}${verType}/${file}`,
        cbd: `https://cdn.cbd.int/${name}${verType}/${file}`,
        custom: (CDN.custom_format || "").replace(/\$\{(.+?)\}/g, (match, $1) => value[$1]),
      };

      data[key] = cdnSource[type];
    });

    return data;
  };

  // delete null value
  const deleteNullValue = obj => {
    if (!obj) return;
    for (const i in obj) {
      obj[i] === null && delete obj[i];
    }
    return obj;
  };

  themeConfig.asset = Object.assign(
    internalAssets,
    createCDNLink(thirdPartySrc, CDN.third_party_provider),
    deleteNullValue(CDN.option)
  );
  themeConfig.asset.build_stamp = buildStamp;
});
