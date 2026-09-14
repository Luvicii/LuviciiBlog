---
title: 小空调
layout: default
---

这里是一台小空调，请勿对着出风口长时间直吹~

<div class="ac-toy">
<input type="checkbox" id="ac-on" class="ac-input" checked>
<input type="radio" name="ac-speed" id="ac-sp1" class="ac-input">
<input type="radio" name="ac-speed" id="ac-sp2" class="ac-input" checked>
<input type="radio" name="ac-speed" id="ac-sp3" class="ac-input">
<div class="ac-panel">
<div class="ac-display"><span class="ac-temp">26<small>°C</small></span><span class="ac-mode">❄ 制冷</span></div>
<div class="ac-buttons">
<label for="ac-on" class="ac-btn ac-btn-power">⏻</label>
<label for="ac-sp1" class="ac-btn ac-btn-sp1">低速</label>
<label for="ac-sp2" class="ac-btn ac-btn-sp2">中速</label>
<label for="ac-sp3" class="ac-btn ac-btn-sp3">高速</label>
</div>
</div>
<div class="ac-stage">
<svg class="ac-fan" viewBox="0 0 240 320" aria-label="电风扇">
<defs>
<radialGradient id="acBladeGrad" cx="42%" cy="38%" r="75%">
<stop offset="0%" class="ac-stop-light"/>
<stop offset="55%" class="ac-stop-mid"/>
<stop offset="100%" class="ac-stop-dark"/>
</radialGradient>
<linearGradient id="acMetalGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#e8eefc"/>
<stop offset="100%" stop-color="#b9c6e8"/>
</linearGradient>
<linearGradient id="acHubGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" class="ac-stop-hubtop"/>
<stop offset="100%" class="ac-stop-dark"/>
</linearGradient>
</defs>
<ellipse cx="120" cy="288" rx="72" ry="9" fill="#000" opacity=".08"/>
<path d="M120 82 h30 a26 26 0 0 1 26 26 v8 a26 26 0 0 1 -26 26 h-30 z" fill="url(#acMetalGrad)"/>
<circle cx="176" cy="82" r="7" fill="url(#acMetalGrad)" stroke="#a9b8e0" stroke-width="1.5"/>
<rect x="112" y="192" width="16" height="62" rx="8" fill="url(#acMetalGrad)"/>
<rect x="108" y="188" width="24" height="14" rx="7" class="ac-accent"/>
<ellipse cx="120" cy="274" rx="58" ry="15" fill="url(#acMetalGrad)"/>
<ellipse cx="120" cy="269" rx="46" ry="11" fill="#dfe7fa"/>
<circle cx="100" cy="268" r="4" class="ac-accent"/>
<circle cx="116" cy="270" r="4" class="ac-accent" opacity=".65"/>
<circle cx="132" cy="271" r="4" class="ac-accent" opacity=".4"/>
<g class="ac-blades">
<g id="acBlade">
<path d="M120 110 C129 92 147 68 170 66 C189 64 200 78 194 94 C188 108 167 114 148 114 C136 114 126 116 120 110 Z" fill="url(#acBladeGrad)"/>
</g>
<use href="#acBlade" transform="rotate(72 120 110)"/>
<use href="#acBlade" transform="rotate(144 120 110)"/>
<use href="#acBlade" transform="rotate(216 120 110)"/>
<use href="#acBlade" transform="rotate(288 120 110)"/>
<circle cx="120" cy="110" r="15" fill="url(#acHubGrad)"/>
<circle cx="120" cy="110" r="15" fill="none" stroke="#26379e" stroke-width="1.5"/>
<circle cx="115" cy="105" r="4.5" fill="#fff" opacity=".55"/>
<circle cx="120" cy="110" r="5.5" fill="#26379e"/>
</g>
<g fill="none" stroke="#7c8fc9" stroke-width="2" opacity=".8">
<circle cx="120" cy="110" r="88" stroke-width="4" stroke="#5a6db3"/>
<circle cx="120" cy="110" r="72"/>
<circle cx="120" cy="110" r="56"/>
<circle cx="120" cy="110" r="40"/>
</g>
<g stroke="#8b9bd0" stroke-width="1.6" opacity=".7">
<line x1="120" y1="26" x2="120" y2="40"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(30 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(60 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(90 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(120 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(150 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(180 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(210 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(240 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(270 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(300 120 110)"/>
<line x1="120" y1="26" x2="120" y2="40" transform="rotate(330 120 110)"/>
</g>
</svg>
<svg class="ac-breeze" viewBox="0 0 120 160" aria-hidden="true">
<path class="ac-wind ac-wind-1" d="M4 30 Q 30 18 56 30 T 108 30"/>
<path class="ac-wind ac-wind-2" d="M4 80 Q 30 68 56 80 T 108 80"/>
<path class="ac-wind ac-wind-3" d="M4 130 Q 30 118 56 130 T 108 130"/>
</svg>
</div>
</div>

<style>
.ac-toy {
  --ac-main: var(--luvicii-main, #425aef);
  --spin: 1s;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 20px 0;
  user-select: none;
}
.ac-input { display: none; }

/* 面板 */
.ac-panel {
  width: 320px;
  max-width: 100%;
  border-radius: 16px;
  padding: 14px 18px;
  background: rgba(66, 90, 239, .08);
  border: 1px solid rgba(66, 90, 239, .25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ac-display { display: flex; align-items: baseline; gap: 10px; white-space: nowrap; }
.ac-temp {
  font-size: 34px;
  font-weight: 700;
  color: var(--ac-main);
  font-variant-numeric: tabular-nums;
}
.ac-temp small { font-size: 16px; }
.ac-mode { font-size: 13px; opacity: .7; white-space: nowrap; }
.ac-buttons { display: flex; gap: 8px; flex-shrink: 0; }
.ac-btn {
  cursor: pointer;
  border: 1px solid rgba(66, 90, 239, .35);
  background: transparent;
  color: inherit;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1;
  transition: all .2s;
}
.ac-btn:hover { background: var(--ac-main); color: #fff; }

/* 舞台：风扇 + 风 */
.ac-stage {
  display: flex;
  align-items: center;
  margin-top: 18px;
}
.ac-fan { width: 240px; height: auto; overflow: visible; }

.ac-accent { fill: var(--ac-main); }
.ac-stop-light { stop-color: #8fa8ff; }
.ac-stop-mid { stop-color: var(--ac-main); }
.ac-stop-dark { stop-color: #2c41c9; }
.ac-stop-hubtop { stop-color: #5d73f2; }

.ac-blades {
  animation: ac-spin var(--spin) linear infinite;
  transform-box: view-box;
  transform-origin: 120px 110px;
}

.ac-breeze { width: 110px; height: 150px; margin-left: 6px; }
.ac-wind {
  fill: none;
  stroke: var(--ac-main);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 14 18;
  animation: ac-flow 1.1s linear infinite;
  opacity: .7;
}
.ac-wind-2 { animation-duration: 1.4s; opacity: .5; }
.ac-wind-3 { animation-duration: .9s; opacity: .6; }

@keyframes ac-spin { to { transform: rotate(360deg); } }
@keyframes ac-flow { to { stroke-dashoffset: -32; } }

/* 开关与档位（纯 CSS 状态） */
#ac-sp1:checked ~ .ac-stage { --spin: 1.8s; }
#ac-sp2:checked ~ .ac-stage { --spin: 1s; }
#ac-sp3:checked ~ .ac-stage { --spin: .5s; }
#ac-sp3:checked ~ .ac-stage .ac-blades { filter: blur(1px); }

#ac-sp1:checked ~ .ac-panel .ac-btn-sp1,
#ac-sp2:checked ~ .ac-panel .ac-btn-sp2,
#ac-sp3:checked ~ .ac-panel .ac-btn-sp3,
#ac-on:checked ~ .ac-panel .ac-btn-power {
  background: var(--ac-main);
  color: #fff;
}

#ac-on:not(:checked) ~ .ac-stage .ac-blades { animation-play-state: paused; }
#ac-on:not(:checked) ~ .ac-stage .ac-wind { animation-play-state: paused; opacity: .15; }
#ac-on:not(:checked) ~ .ac-stage .ac-fan { filter: grayscale(.75); opacity: .55; }
#ac-on:not(:checked) ~ .ac-panel .ac-temp,
#ac-on:not(:checked) ~ .ac-panel .ac-mode { opacity: .35; }

@media (max-width: 500px) {
  .ac-fan { width: 190px; }
  .ac-breeze { width: 80px; }
}
</style>
