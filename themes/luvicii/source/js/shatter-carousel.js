/* 首页轮播「玻璃碎裂」图片切换特效（移植自 AstroChamiBlog 的 banner shatter 模块）。
   被动触发：不含定时器，由外部（Swiper 的 slideChangeTransitionStart）调用 shatterTo。
   破碎由 WebGL2 单 canvas 实例化渲染（GPU 结算），无 WebGL2 或首帧自检失败时回退 DOM 碎片，
   prefers-reduced-motion 时降级为淡入淡出。
   对外接口：window.ShatterCarousel = { init(stageEl, firstSrc, cfg), shatterTo(nextSrc), destroy() } */
(() => {
	/* 全部可调参数；碎片密度针对小尺寸图片区（约 700×206px）调整，其余物理参数与源一致 */
	const SHATTER_DEFAULTS = {
		cols: 16,
		rows: 7,
		small_cols: 10,
		small_rows: 6,
		fallback_cols: 12,
		fallback_rows: 5,
		fallback_small_cols: 8,
		fallback_small_rows: 4,
		wind_angles: [45, 135, 225, 315, 0, 180],
		wind_jitter: 12,
		sweep: 1200,
		delay_jitter: 150,
		dur: 800,
		dur_range: 600,
		drift: 500,
		drift_range: 600,
		sway: 120,
		dy_jitter: 60,
		tumble: 80,
		spin: 540,
		scale_min: 0.3,
		scale_max: 0.65,
		jag: 14,
		cut_chance: 0.95,
		cut_min: 0.5,
		cut_max: 0.8,
		wind_freq_min: 5,
		wind_freq_max: 13,
		wind_amp_min: 6,
		wind_amp_max: 20,
		wind_lift_min: 20,
		wind_lift_max: 60,
		perspective: 900,
	};

	/* 状态挂到 window 上的共享槽位：pjax 重载本脚本时保留舞台状态，
	   避免新旧两个模块实例各自的闭包状态打架（旧舞台引用丢失、新实例无舞台） */
	const store = (window.__shatterCarouselStore = window.__shatterCarouselStore || { stage: null, lock: false, noCors: false });

	const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)');

	/* 图片先以 crossorigin=anonymous 加载（图床支持 CORS 时 WebGL texImage2D 不会因画布污染失败）；
	   一旦某张图带 CORS 加载失败，标记 store.noCors 并不带 CORS 重载该图，
	   此后所有图都不再带 CORS，碎裂也跳过 GL 路径直接走 DOM 碎片回退 */
	const assignSrc = (img, src) => {
		img.onerror = () => {
			if (store.noCors) return; /* 不带 CORS 也失败，放弃 */
			store.noCors = true;
			img.onerror = null;
			img.removeAttribute('crossorigin');
			img.src = src;
		};
		if (store.noCors) img.removeAttribute('crossorigin');
		else img.crossOrigin = 'anonymous';
		img.src = src;
	};

	const normalizeConfig = (overrides) => {
		const cfg = { ...SHATTER_DEFAULTS, ...(overrides || {}) };
		/* 数量类字段至少为 1；范围字段保证 min ≤ max */
		['cols', 'rows', 'small_cols', 'small_rows', 'fallback_cols', 'fallback_rows', 'fallback_small_cols', 'fallback_small_rows'].forEach(
			(k) => (cfg[k] = Math.max(1, Math.round(Number(cfg[k]) || 1))),
		);
		cfg.scale_min = Math.min(0.99, Math.max(0.01, Number(cfg.scale_min) || 0.3));
		cfg.scale_max = Math.max(cfg.scale_min, Math.min(1, Number(cfg.scale_max) || 0.65));
		[
			['dur', 'dur_range'],
			['drift', 'drift_range'],
			['wind_freq_min', 'wind_freq_max'],
			['wind_amp_min', 'wind_amp_max'],
			['wind_lift_min', 'wind_lift_max'],
			['cut_min', 'cut_max'],
		].forEach(([a, b]) => {
			cfg[a] = Number(cfg[a]);
			cfg[b] = Number(cfg[b]);
			if (!(cfg[b] > cfg[a])) cfg[b] = cfg[a];
		});
		return cfg;
	};

	/* object-fit:cover 下图片在容器内的实际显示矩形（碎片背景按它对齐，避免拉伸错位） */
	const coverRect = (img, w, h) => {
		const iw = img.naturalWidth || w;
		const ih = img.naturalHeight || h;
		const scale = Math.max(w / iw, h / ih);
		const dw = iw * scale;
		const dh = ih * scale;
		return { dw, dh, ox: (w - dw) / 2, oy: (h - dh) / 2 };
	};

	/* 纯淡入淡出：prefers-reduced-motion 降级、舞台不可见时使用 */
	function fadeTo(nextSrc) {
		const stage = store.stage;
		if (!stage) return;
		stage.currentSrc = nextSrc;
		if (store.lock) return; /* 碎裂进行中：由收尾按 currentSrc 补齐 */
		const { cur, nxt } = stage;
		stage.el.appendChild(nxt); /* nxt 移到 cur 之上，淡入才可见 */
		nxt.style.transition = 'opacity 0.6s ease';
		nxt.style.transform = 'none';
		assignSrc(nxt, nextSrc);
		nxt.style.opacity = '1';
		setTimeout(() => {
			if (store.stage !== stage) return;
			/* 淡入完成：nxt 已稳定显示新图，交换角色（nxt 提升为 cur） */
			nxt.style.transition = 'none';
			cur.style.opacity = '0';
			stage.cur = nxt;
			stage.nxt = cur;
		}, 620);
	}

	/* 碎裂收尾：nxt 自碎裂开始就一直在垫底显示新图、早已完成光栅，
	   直接交换角色把它提升为顶层 cur，全程不给任何 img 换 src——
	   收尾时换 src 会让 cur 重新光栅滞后 ~100ms，而同步隐藏的 nxt 不再兜底，整图区域白闪一帧 */
	const settleShatter = (stage) => {
		const { cur, nxt } = stage;
		/* 碎裂中途若 fadeTo 又改过目标图，以 currentSrc 为准补齐 nxt */
		if (stage.currentSrc && nxt.src !== new URL(stage.currentSrc, window.location.href).href) assignSrc(nxt, stage.currentSrc);
		cur.style.opacity = '0';
		nxt.style.transition = 'none';
		nxt.style.transform = 'none';
		nxt.style.opacity = '1';
		stage.el.appendChild(nxt); /* DOM 顺序后置 = 层叠在上 */
		stage.cur = nxt;
		stage.nxt = cur;
		store.lock = false;
	};

	/* ---------------------------------------------------------- */
	/* WebGL 碎片渲染器：破碎特效整个搬进 1 块 canvas（1 次 draw）  */
	/* ---------------------------------------------------------- */

	/* 顶点着色器：全部物理（侵蚀前沿延迟、cubic-bezier 缓动、3D 翻滚、
	   缺口生长、perspective:900px 透视）都在 GPU 里按 uTime 结算 */
	const SHATTER_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner; /* 角点相对碎片中心的偏移；中心顶点为 (0,0) */
layout(location = 1) in vec2 aUV;
layout(location = 2) in float aEdge;  /* 0=沿水平边切角 1=沿竖直边切角 -1=中心顶点不切 */
layout(location = 3) in vec2 aCenter;
layout(location = 4) in float aDelay;
layout(location = 5) in float aDur;
layout(location = 6) in vec2 aDelta;
layout(location = 7) in vec4 aBase;
layout(location = 8) in float aCut;   /* 该顶点的切角深度(px) */
layout(location = 9) in vec4 aWind; /* x:摆动相位 y:摆动频率 z:摆动幅度 w:托起高度 */
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform vec2 uPerp; /* 垂直于风向的单位向量（摆动用） */
uniform float uFocal;
uniform float uTime;
out vec2 vUV;
out float vAlpha;

float bezierX(float t) {
	float u = 1.0 - t;
	return 3.0 * u * u * t * 0.22 + 3.0 * u * t * t * 0.36 + t * t * t;
}
float bezierXd(float t) {
	float u = 1.0 - t;
	return 3.0 * u * (1.0 - 3.0 * t) * 0.22 + 3.0 * t * (2.0 - 3.0 * t) * 0.36 + 3.0 * t * t;
}
float bezierY(float t) {
	float u = 1.0 - t;
	return 3.0 * u * u * t * 0.61 + 3.0 * u * t * t + t * t * t;
}
/* CSS cubic-bezier(0.22, 0.61, 0.36, 1)：牛顿法反解 t，复刻 DOM 版缓动 */
float easeTransform(float x) {
	float t = clamp(x, 0.0, 1.0);
	for (int i = 0; i < 4; i++) {
		float err = bezierX(t) - x;
		float d = max(bezierXd(t), 0.001);
		t = clamp(t - err / d, 0.0, 1.0);
	}
	return bezierY(t);
}
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
	/* 与 DOM 版同款时序：transform 缓动 / 缺口 ease-in（前 35%）/ 透明 ease-in（后 55%） */
	float e = easeTransform(clamp((uTime - aDelay) / aDur, 0.0, 1.0));
	float pj = clamp((uTime - aDelay) / max(aDur * 0.99, 0.001), 0.0, 1.0);
	float ej = pj * pj;
	float pa = clamp((uTime - (aDelay + aDur * 0.42)) / max(aDur * 0.55, 0.001), 0.0, 1.0);
	vAlpha = 1.0 - pa * pa;

	/* 切角：起爆后角点沿所在边内缩形成斜边（切深随 ej 生长），
	   静止时切深×0 即完美矩形无缝拼合，起爆后四边形随机变成五~八边形 */
	vec2 c = aCorner;
	if (aEdge > -0.5) {
		if (aEdge < 0.5) c.x -= sign(c.x) * aCut * ej;
		else c.y -= sign(c.y) * aCut * ej;
	}

	/* 吹拂感：脱落后被风托起（先升后落）、垂直风向正弦摆动（阵风）、翻滚角来回抖 */
	float wobblePhase = uTime * aWind.y + aWind.x;
	float wob = sin(wobblePhase) * aWind.z * e;
	float lift = -sin(3.14159 * min(e * 1.15, 1.0)) * aWind.w;
	vec2 windOffset = aDelta * e + uPerp * wob + vec2(0.0, lift);

	float s = 1.0 - (1.0 - aBase.w) * e;
	float rz = aBase.z * e + sin(wobblePhase * 0.9) * 0.6 * e;
	vec3 p = rotX(aBase.x * e) * rotY(aBase.y * e) * rotZ(rz) * vec3(c * s, 0.0);
	vec3 world = vec3(aCenter + windOffset, 0.0) + p;

	/* 与 DOM 层 perspective:900px 一致的透视 */
	float sp = uFocal / max(uFocal - world.z, 1.0);
	vec2 clip = (world.xy - uCenter) / uHalf * sp;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
	vUV = aUV;
}`;

	const SHATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
in float vAlpha;
uniform sampler2D uTex;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUV) * vAlpha; }`;

	/* 生成全部碎片参数（GL 与 DOM 回退共用一套随机量） */
	const buildShards = (cfg, wx, wy, px, py, minProj, projRange, cols, rows, cw, ch) => {
		/* 抖动缺口延迟到起爆时才出现（静止时碎片层 = 完美无缝复刻原图，不提前破碎） */
		const jag = () => Number((Math.random() * cfg.jag).toFixed(1));
		/* 切角深度：概率 cfg.cut_chance，深度为所在边长的 cut_min~cut_max（角顺序 TL,TR,BR,BL） */
		const cut = (len) => (Math.random() < cfg.cut_chance ? (cfg.cut_min + Math.random() * (cfg.cut_max - cfg.cut_min)) * len : 0);
		const shards = [];
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const left = Math.round(x * cw);
				const top = Math.round(y * ch);
				const tw = Math.ceil(cw) + 2;
				const th = Math.ceil(ch) + 2;
				/* 侵蚀式破碎前沿：延迟按碎片在风向上的投影排序（扫描窗口 sweep ≈ 消散时长） */
				const projCx = x * cw + cw / 2;
				const projCy = y * ch + ch / 2;
				const delay = ((projCx * wx + projCy * wy - minProj) / projRange) * cfg.sweep + Math.random() * cfg.delay_jitter;
				const dur = cfg.dur + Math.random() * cfg.dur_range;
				/* 被风吹走：脱离前沿后沿风向长距离卷走，叠加横向飘摆与小幅上下扰动，
				   配合着色器里的托起/摆动呈现吹拂感 */
				const drift = cfg.drift + Math.random() * cfg.drift_range;
				const sway = (Math.random() - 0.5) * cfg.sway;
				const dx = wx * drift + px * sway;
				const dy = wy * drift + py * sway + (Math.random() - 0.5) * cfg.dy_jitter;
				shards.push({
					left,
					top,
					tw,
					th,
					cx: left + tw / 2,
					cy: top + th / 2,
					delay,
					dur,
					dx,
					dy,
					rx: (Math.random() - 0.5) * cfg.tumble,
					ry: (Math.random() - 0.5) * cfg.tumble,
					rz: (Math.random() - 0.5) * cfg.spin, /* 翻滚抖动 */
					scale: cfg.scale_min + Math.random() * (cfg.scale_max - cfg.scale_min),
					jag: [jag(), jag(), jag(), jag()],
					cutH: [cut(tw), cut(tw), cut(tw), cut(tw)], /* 每角沿水平边的切深 */
					cutV: [cut(th), cut(th), cut(th), cut(th)], /* 每角沿竖直边的切深 */
					/* 吹拂参数：摆动相位/频率/幅度、被风托起的高度（仅 WebGL 路径使用） */
					windPhase: Math.random() * Math.PI * 2,
					windFreq: cfg.wind_freq_min + Math.random() * (cfg.wind_freq_max - cfg.wind_freq_min),
					windAmp: cfg.wind_amp_min + Math.random() * (cfg.wind_amp_max - cfg.wind_amp_min),
					windLift: cfg.wind_lift_min + Math.random() * (cfg.wind_lift_max - cfg.wind_lift_min),
				});
			}
		}
		return shards;
	};

	/* 首帧像素自检：帧缓冲与参考绘制逐点对比，偏差过大即判定该驱动渲染异常 */
	const shatterGLOK = (gl, cur, rect, canvas, dpr) => {
		try {
			const W = canvas.width;
			const H = canvas.height;
			const ref = document.createElement('canvas');
			ref.width = W;
			ref.height = H;
			const rctx = ref.getContext('2d');
			rctx.drawImage(cur, rect.ox * dpr, rect.oy * dpr, rect.dw * dpr, rect.dh * dpr);
			const refData = rctx.getImageData(0, 0, W, H).data;
			const buf = new Uint8Array(4);
			/* 5×3 采样点均匀铺开（碎片重叠区内容一致，边界点也安全） */
			for (let r = 1; r < 4; r++) {
				for (let c = 1; c < 6; c++) {
					const sx = Math.round((c * W) / 6);
					const sy = Math.round((r * H) / 4);
					gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
					const ri = ((H - 1 - sy) * W + sx) * 4;
					if (
						Math.abs(buf[0] - refData[ri]) > 10 ||
						Math.abs(buf[1] - refData[ri + 1]) > 10 ||
						Math.abs(buf[2] - refData[ri + 2]) > 10
					) {
						return false;
					}
				}
			}
			return true;
		} catch (err) {
			return false;
		}
	};

	/* WebGL2 实例化渲染；任何一步失败返回 false，走 DOM 回退。px/py 为垂直风向的单位向量（摆动方向） */
	function initShatterGL(stage, rect, w, h, shards, px, py) {
		const { el, cur, nxt } = stage;
		try {
			const canvas = document.createElement('canvas');
			canvas.style.cssText = 'position:absolute;inset:0;z-index:5;pointer-events:none;';
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.max(1, Math.round(w * dpr));
			canvas.height = Math.max(1, Math.round(h * dpr));
			const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
			if (!gl) return false;

			const compile = (type, src) => {
				const sh = gl.createShader(type);
				gl.shaderSource(sh, src);
				gl.compileShader(sh);
				if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
				return sh;
			};
			const prog = gl.createProgram();
			gl.attachShader(prog, compile(gl.VERTEX_SHADER, SHATTER_VERT));
			gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, SHATTER_FRAG));
			gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
			gl.useProgram(prog);

			/* 顶点缓冲：每片 = 中心顶点 + 外圈 8 点（4 角 × 沿水平/竖直边各 1 个切角点）
			   的三角扇共 24 顶点；每个顶点直接携带该片的全部参数（兼容所有驱动） */
			const VSTRIDE = 20; // corner(2) uv(2) edge(1) center(2) delay(1) dur(1) delta(2) base(4) cut(1) wind(4)
			const cornerData = new Float32Array(shards.length * 24 * VSTRIDE);
			const SIGNS = [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			]; // TL,TR,BR,BL
			/* 外圈顺序绕周长一圈：上边两角(沿水平边) → 右边两角(沿竖直边) → 下边 → 左边 */
			const RING = [
				[0, 0],
				[1, 0],
				[1, 1],
				[2, 1],
				[2, 0],
				[3, 0],
				[3, 1],
				[0, 1],
			]; // [角序号, 0=水平边/1=竖直边]
			shards.forEach((s, i) => {
				const ringPt = ([ci, edge]) => ({
					bx: (SIGNS[ci][0] * s.tw) / 2,
					by: (SIGNS[ci][1] * s.th) / 2,
					edge,
					cut: edge === 0 ? s.cutH[ci] : s.cutV[ci],
				});
				const centerPt = { bx: 0, by: 0, edge: -1, cut: 0 };
				for (let k = 0; k < 8; k++) {
					[centerPt, ringPt(RING[k]), ringPt(RING[(k + 1) % 8])].forEach((v, j) => {
						const o = (i * 24 + k * 3 + j) * VSTRIDE;
						cornerData[o] = v.bx;
						cornerData[o + 1] = v.by;
						cornerData[o + 2] = (s.cx + v.bx - rect.ox) / rect.dw;
						cornerData[o + 3] = (s.cy + v.by - rect.oy) / rect.dh;
						cornerData[o + 4] = v.edge;
						cornerData[o + 5] = s.cx;
						cornerData[o + 6] = s.cy;
						cornerData[o + 7] = s.delay / 1000;
						cornerData[o + 8] = s.dur / 1000;
						cornerData[o + 9] = s.dx;
						cornerData[o + 10] = s.dy;
						cornerData[o + 11] = (s.rx * Math.PI) / 180;
						cornerData[o + 12] = (s.ry * Math.PI) / 180;
						cornerData[o + 13] = (s.rz * Math.PI) / 180;
						cornerData[o + 14] = s.scale;
						cornerData[o + 15] = v.cut;
						cornerData[o + 16] = s.windPhase;
						cornerData[o + 17] = s.windFreq;
						cornerData[o + 18] = s.windAmp;
						cornerData[o + 19] = s.windLift;
					});
				}
			});
			const cornerBuf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
			gl.bufferData(gl.ARRAY_BUFFER, cornerData, gl.STATIC_DRAW);
			[
				[0, 2, 0],
				[1, 2, 8],
				[2, 1, 16],
				[3, 2, 20],
				[4, 1, 28],
				[5, 1, 32],
				[6, 2, 36],
				[7, 4, 44],
				[8, 1, 60],
				[9, 4, 64],
			].forEach(([loc, size, off]) => {
				gl.enableVertexAttribArray(loc);
				gl.vertexAttribPointer(loc, size, gl.FLOAT, false, VSTRIDE * 4, off);
			});

			/* 纹理：当前图（UV 映射与 DOM 版 background-size/position 完全一致） */
			const tex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cur);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.clearColor(0, 0, 0, 0);
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.uniform2f(gl.getUniformLocation(prog, 'uCenter'), w / 2, h / 2);
			gl.uniform2f(gl.getUniformLocation(prog, 'uHalf'), w / 2, h / 2);
			gl.uniform2f(gl.getUniformLocation(prog, 'uPerp'), px, py);
			gl.uniform1f(gl.getUniformLocation(prog, 'uFocal'), stage.cfg.perspective);
			const uTimeLoc = gl.getUniformLocation(prog, 'uTime');

			let maxEnd = 0;
			shards.forEach((s) => {
				maxEnd = Math.max(maxEnd, s.delay + s.dur);
			});

			let raf = 0;
			const destroyGL = () => {
				cancelAnimationFrame(raf);
				canvas.remove();
				gl.deleteTexture(tex);
				gl.deleteBuffer(cornerBuf);
				gl.deleteProgram(prog);
			};

			/* 首帧先画好、finish 落盘并自检通过后才挂载画布——
			   否则新图会在画布首帧就绪前透出来，出现"先切新图再飘散" */
			const t0 = performance.now();
			gl.uniform1f(uTimeLoc, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, shards.length * 24);
			gl.finish();
			if (!shatterGLOK(gl, cur, rect, canvas, dpr)) {
				destroyGL();
				return false;
			}
			el.appendChild(canvas);

			const frame = () => {
				if (store.stage !== stage) {
					destroyGL();
					return;
				}
				const t = (performance.now() - t0) / 1000;
				gl.uniform1f(uTimeLoc, t);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.drawArrays(gl.TRIANGLES, 0, shards.length * 24);
				if (t * 1000 <= maxEnd + 80) {
					raf = requestAnimationFrame(frame);
					return;
				}
				destroyGL();
				settleShatter(stage);
			};
			raf = requestAnimationFrame(frame);
			return true;
		} catch (err) {
			return false;
		}
	}

	function runShatter(nextSrc) {
		const stage = store.stage;
		if (!stage || store.lock) return;
		store.lock = true;
		const { el, cur, nxt } = stage;
		const cfg = stage.cfg;

		/* 新图垫底完全静止（不缩放落定：任何缩放都会让图顶/图底在破碎开始时上下动一下） */
		nxt.style.transition = 'none';
		assignSrc(nxt, nextSrc);
		nxt.style.opacity = '1';
		nxt.style.transform = 'none';

		const w = el.offsetWidth;
		const h = el.offsetHeight;
		const rect = coverRect(cur, w, h);
		/* WebGL 路径碎片数量（GPU 一次 draw call 结算，多几倍也轻松）；小屏与 DOM 回退单独降档 */
		const small = w < 768;
		const cols = small ? cfg.small_cols : cfg.cols;
		const rows = small ? cfg.small_rows : cfg.rows;
		const cw = w / cols;
		const ch = h / rows;
		/* 风向：候选角度随机取一，再叠 ±wind_jitter 抖动 */
		const baseAngles = cfg.wind_angles;
		const windAngle = ((baseAngles[(Math.random() * baseAngles.length) | 0] + Math.random() * cfg.wind_jitter * 2 - cfg.wind_jitter) * Math.PI) / 180;
		const wx = Math.cos(windAngle);
		const wy = Math.sin(windAngle);
		const px = -wy; /* 垂直于风向，用于横向飘摆 */
		const py = wx;
		/* 起爆延迟按碎片在风向上的投影排序：上风处先被吹走，形成斜向波浪 */
		const cornerProjs = [0, 0, w, 0, 0, h, w, h].reduce((acc, _, i, arr) => {
			if (i % 2 === 0) acc.push(arr[i] * wx + arr[i + 1] * wy);
			return acc;
		}, []);
		const minProj = Math.min(...cornerProjs);
		const projRange = Math.max(...cornerProjs) - minProj || 1;
		const shards = buildShards(cfg, wx, wy, px, py, minProj, projRange, cols, rows, cw, ch);
		/* 碎片层已完整复刻当前图，立刻隐藏底下的原图——否则碎片飞走后露出的还是旧图，
		   清理时才瞬间跳新图（旧图重现→突变） */
		stage.currentSrc = nextSrc;

		/* WebGL 优先：1 个 canvas、1 次 draw call，GPU 结算全部动画，主线程零开销；
		   图源不支持 CORS（store.noCors）时纹理必然被污染，直接走 DOM 回退 */
		if (!store.noCors && initShatterGL(stage, rect, w, h, shards, px, py)) {
			cur.style.opacity = '0';
			return;
		}

		/* 回退：DOM 碎片（无 WebGL2 或首帧自检失败），降到 fallback 档位保证流畅 */
		const dcols = small ? cfg.fallback_small_cols : cfg.fallback_cols;
		const drows = small ? cfg.fallback_small_rows : cfg.fallback_rows;
		const domShards =
			dcols === cols && drows === rows
				? shards
				: buildShards(cfg, wx, wy, px, py, minProj, projRange, dcols, drows, w / dcols, h / drows);
		const layer = document.createElement('div');
		layer.style.cssText = `position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;perspective:${cfg.perspective}px;`;
		const tiles = [];
		domShards.forEach((s) => {
			const tile = document.createElement('div');
			tile.style.cssText = [
				'position:absolute',
				`left:${s.left}px`,
				`top:${s.top}px`,
				`width:${s.tw}px`,
				`height:${s.th}px`,
				`background-image:url("${cur.src}")`,
				`background-size:${rect.dw.toFixed(1)}px ${rect.dh.toFixed(1)}px`,
				`background-position:${(rect.ox - s.left).toFixed(1)}px ${(rect.oy - s.top).toFixed(1)}px`,
				'clip-path:inset(0% 0% 0% 0%)',
				'will-change:transform,opacity,clip-path',
			].join(';');
			layer.appendChild(tile);
			tiles.push({ tile, ...s });
		});
		el.appendChild(layer);
		/* 不在本拍隐藏 cur：若碎片层首帧光栅被推迟，cur 与碎片层同为旧图、视觉无缝；
			   下一拍碎片层必定已绘制，再隐藏 cur 并起爆，避免新图抢先闪一帧 */
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				if (store.stage !== stage) return;
				cur.style.opacity = '0';
				let maxEnd = 0;
				tiles.forEach(({ tile, delay, dur, dx, dy, rx, ry, rz, scale, jag }) => {
					tile.style.transition =
						`transform ${dur.toFixed(0)}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${delay.toFixed(0)}ms, ` +
						`opacity ${(dur * 0.55).toFixed(0)}ms ease-in ${(delay + dur * 0.45).toFixed(0)}ms, ` +
						`clip-path ${(dur * 0.35).toFixed(0)}ms ease-in ${delay.toFixed(0)}ms`;
					tile.style.transform =
						`translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) ` +
						`rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg) scale(${scale.toFixed(2)})`;
					tile.style.opacity = '0';
					/* 缺口与飞散同时出现：消散到哪里就破碎到哪里 */
					tile.style.clipPath = `inset(${jag[0]}% ${jag[1]}% ${jag[2]}% ${jag[3]}%)`;
					maxEnd = Math.max(maxEnd, delay + dur);
				});
				setTimeout(() => {
					layer.remove();
					if (store.stage !== stage) return;
					settleShatter(stage);
				}, maxEnd + 80);
			}),
		);
	}

	window.ShatterCarousel = {
		/* 建立舞台：stageEl 内需含 cur/nxt 两张 absolute 填充的 img，显示首图 */
		init(stageEl, firstSrc, cfg) {
			if (!stageEl || !firstSrc) return;
			this.destroy();
			stageEl.innerHTML = '';
			const mkImg = () => {
				const img = document.createElement('img');
				img.alt = '';
				img.setAttribute('aria-hidden', 'true');
				img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:5px;';
				return img;
			};
			const nxt = mkImg();
			nxt.style.opacity = '0';
			const cur = mkImg();
			assignSrc(cur, firstSrc);
			stageEl.appendChild(nxt);
			stageEl.appendChild(cur);
			store.stage = { el: stageEl, cur, nxt, currentSrc: firstSrc, cfg: normalizeConfig(cfg) };
		},

		/* 预载完成后执行碎裂切换到新图；prefers-reduced-motion 时降级为淡入淡出 */
		shatterTo(nextSrc) {
			const stage = store.stage;
			if (!stage || !nextSrc || stage.currentSrc === nextSrc) return;
			/* 舞台不可见（如窗口缩到窄屏 display:none）时走淡入淡出，保持 currentSrc 同步 */
			if (reducedMotion().matches || !stage.el.offsetWidth || !stage.el.offsetHeight) {
				fadeTo(nextSrc);
				return;
			}
			if (store.lock) return;
			/* 先预载完成再碎裂，避免碎完白屏；带 CORS 预载失败则不带 CORS 重试并标记降级 */
			const probe = new Image();
			probe.onload = () => {
				if (store.stage) runShatter(nextSrc);
			};
			probe.onerror = () => {
				if (store.noCors) return; /* 不带 CORS 也失败，放弃本次切换 */
				store.noCors = true;
				const retry = new Image();
				retry.onload = () => {
					if (store.stage) runShatter(nextSrc);
				};
				retry.src = nextSrc;
			};
			if (!store.noCors) probe.crossOrigin = 'anonymous';
			probe.src = nextSrc;
		},

		destroy() {
			/* 进行中的 raf/setTimeout 会在下一拍自检 store.stage 后自行清理 */
			store.stage = null;
			store.lock = false;
		},
	};
})();
