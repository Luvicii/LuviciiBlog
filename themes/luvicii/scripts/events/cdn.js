/**
 * Luvicii
 * Merge CDN
 */

"use strict";

const { version } = require("../../package.json");
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
  const internalSrc = {
    main: {
      name: "hexo-theme-anzhiyu",
      file: "js/main.js",
      version,
    },
    utils: {
      name: "hexo-theme-anzhiyu",
      file: "js/utils.js",
      version,
    },
    translate: {
      name: "hexo-theme-anzhiyu",
      file: "js/tw_cn.js",
      version,
    },
    local_search: {
      name: "hexo-theme-anzhiyu",
      file: "js/search/local-search.js",
      version,
    },
    algolia_js: {
      name: "hexo-theme-anzhiyu",
      file: "js/search/algolia.js",
      version,
    },
    random_friends_post_js: {
      name: "hexo-theme-anzhiyu",
      file: "js/luvicii/random_friends_post.js",
      version,
    },
    right_click_menu_js: {
      name: "hexo-theme-anzhiyu",
      file: "js/luvicii/right_click_menu.js",
      version,
    },
    comment_barrage_js: {
      name: "hexo-theme-anzhiyu",
      file: "js/luvicii/comment_barrage.js",
      version,
    },
    ai_abstract_js: {
      name: "hexo-theme-anzhiyu",
      file: "js/luvicii/ai_abstract.js",
      version,
    },
    people_js: {
      name: "hexo-theme-anzhiyu",
      file: "js/luvicii/people.js",
      version,
    },
  };

  const minFile = file => {
    return file.replace(/(?<!\.min)\.(js|css)$/g, ext => ".min" + ext);
  };

  const createCDNLink = (data, type, cond = "") => {
    Object.keys(data).map(key => {
      let { name, version, file, other_name } = data[key];

      const cdnjs_name = other_name || name;
      const cdnjs_file = file.replace(/^[lib|dist]*\/|browser\//g, "");
      const min_cdnjs_file = minFile(cdnjs_file);
      if (cond === "internal") file = `source/${file}`;
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
        local: cond === "internal" ? `${cdnjs_file}?v=${fileHash(cdnjs_file)}` : `/pluginsSrc/${name}/${file}`,
        jsdelivr: `https://cdn.jsdelivr.net/npm/${name}${verType}/${min_file}`,
        unpkg: `https://unpkg.com/${name}${verType}/${file}`,
        cdnjs: `https://cdnjs.cloudflare.com/ajax/libs/${cdnjs_name}/${version}/${min_cdnjs_file}`,
        elemecdn: `https://npm.elemecdn.com/${name}${verType}/${file}`,
        onmicrosoft: `https://npm.onmicrosoft.cn/${name}${verType}/${file}`,
        cbd: `https://cdn.cbd.int/${name}${verType}/${file}`,
        anheyu: `https://cdn.anheyu.com/npm/${name}${verType}/${min_file}`,
        custom: (CDN.custom_format || "").replace(/\$\{(.+?)\}/g, (match, $1) => value[$1]),
      };

      data[key] = cdnSource[type];
    });

    if (cond === "internal") data["main_css"] = `css/index.css?v=${buildStamp}`;
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
    createCDNLink(internalSrc, CDN.internal_provider, "internal"),
    createCDNLink(thirdPartySrc, CDN.third_party_provider),
    deleteNullValue(CDN.option)
  );
  themeConfig.asset.build_stamp = buildStamp;
});
