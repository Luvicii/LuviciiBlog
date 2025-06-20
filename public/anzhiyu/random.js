var posts=["2025/06/18/hello-world/","2025/06/17/强风吹拂-a-beautiful-story/","2024/06/17/我的卡托维兹之旅/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };