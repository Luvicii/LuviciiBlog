hexo.extend.helper.register("getAnimalIcon", function (year) {
  var index = parseInt(year) % 12;
  var icon = {
    0: "luvicii-colorful-icon-monkey",
    1: "luvicii-colorful-icon-rooster",
    2: "luvicii-colorful-icon-dog",
    3: "luvicii-colorful-icon-boar",
    4: "luvicii-colorful-icon-rat",
    5: "luvicii-colorful-icon-ox",
    6: "luvicii-colorful-icon-tiger",
    7: "luvicii-colorful-icon-rabbit",
    8: "luvicii-colorful-icon-dragon",
    9: "luvicii-colorful-icon-snake",
    10: "luvicii-colorful-icon-horse",
    11: "luvicii-colorful-icon-goat",
  };
  return icon[index];
});
