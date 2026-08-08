hexo.extend.filter.register("before_generate", () => {
  // Get first two digits of the Hexo version number
  const hexoVer = hexo.version.replace(/(^.*\..*)\..*/, "$1");
  const logger = hexo.log;

  if (hexoVer < 5.3) {
    logger.error("Please update Hexo to V5.3.0 or higher!");
    logger.error("请把 Hexo 升级到 V5.3.0 或更高的版本！");
    process.exit(-1);
  }

  if (hexo.locals.get) {
    const data = hexo.locals.get("data");
    if (data && data.luvicii) {
      logger.error(" 'luvicii.yml' is deprecated. Please use '_config.luvicii.yml' ");
      logger.error(" 'luvicii.yml' 已经弃用，请使用 '_config.luvicii.yml' ");
      process.exit(-1);
    }
  }
});
