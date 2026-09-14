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
<svg class="ac-fan" viewBox="0 0 200 260" aria-label="电风扇">
<rect x="94" y="168" width="12" height="60" rx="6" class="ac-stand"/>
<ellipse cx="100" cy="240" rx="52" ry="13" class="ac-base"/>
<ellipse cx="100" cy="236" rx="40" ry="9" class="ac-base-top"/>
<g class="ac-blades">
<path d="M100 95 C114 68 142 52 158 63 C172 73 164 96 142 102 C126 106 110 104 100 95 Z"/>
<path d="M100 95 C114 68 142 52 158 63 C172 73 164 96 142 102 C126 106 110 104 100 95 Z" transform="rotate(120 100 95)"/>
<path d="M100 95 C114 68 142 52 158 63 C172 73 164 96 142 102 C126 106 110 104 100 95 Z" transform="rotate(240 100 95)"/>
<circle cx="100" cy="95" r="12" class="ac-hub"/>
<circle cx="100" cy="95" r="5" class="ac-hub-cap"/>
</g>
<g class="ac-cage">
<circle cx="100" cy="95" r="75"/>
<circle cx="100" cy="95" r="58"/>
<circle cx="100" cy="95" r="40"/>
<line x1="100" y1="22" x2="100" y2="36"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(30 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(60 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(90 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(120 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(150 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(180 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(210 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(240 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(270 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(300 100 95)"/>
<line x1="100" y1="22" x2="100" y2="36" transform="rotate(330 100 95)"/>
<circle cx="100" cy="95" r="75" class="ac-cage-outer"/>
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
.ac-fan { width: 220px; height: auto; overflow: visible; }

.ac-blades path { fill: var(--ac-main); opacity: .85; }
.ac-hub { fill: var(--ac-main); }
.ac-hub-cap { fill: #fff; opacity: .9; }
.ac-blades {
  animation: ac-spin var(--spin) linear infinite;
  transform-box: view-box;
  transform-origin: 100px 95px;
}
.ac-cage circle, .ac-cage line {
  fill: none;
  stroke: var(--ac-main);
  stroke-width: 1.6;
  opacity: .55;
}
.ac-cage-outer { stroke-width: 4; opacity: .9; }
.ac-stand { fill: var(--ac-main); opacity: .8; }
.ac-base { fill: var(--ac-main); opacity: .9; }
.ac-base-top { fill: #fff; opacity: .25; }

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

#ac-sp1:checked ~ .ac-panel .ac-btn-sp1,
#ac-sp2:checked ~ .ac-panel .ac-btn-sp2,
#ac-sp3:checked ~ .ac-panel .ac-btn-sp3,
#ac-on:checked ~ .ac-panel .ac-btn-power {
  background: var(--ac-main);
  color: #fff;
}

#ac-on:not(:checked) ~ .ac-stage .ac-blades { animation-play-state: paused; }
#ac-on:not(:checked) ~ .ac-stage .ac-wind { animation-play-state: paused; opacity: .15; }
#ac-on:not(:checked) ~ .ac-stage .ac-fan { filter: grayscale(.7); opacity: .6; }
#ac-on:not(:checked) ~ .ac-panel .ac-temp,
#ac-on:not(:checked) ~ .ac-panel .ac-mode { opacity: .35; }

@media (max-width: 500px) {
  .ac-fan { width: 170px; }
  .ac-breeze { width: 80px; }
}
</style>
