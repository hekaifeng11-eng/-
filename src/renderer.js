/**
 * renderer.js — 分层渲染器
 *
 * 渲染策略（避免每帧 10000 次 radialGradient）：
 *   BG (5000, 1-3px): fillRect 实色小点，极快
 *   MID (3500, 4-8px): arc + fillStyle 半实半虚，较快
 *   FG (1500, 10-25px): 预渲染 bokeh 精灵 + drawImage（仅 1500 次）
 *
 * 所有粒子每帧获取颜色：逐粒子设置 fillStyle（纯色绘制，无渐变）— 保证精细度
 */

// ─── 预渲染高光精灵（用于 FG 的 1px 白芯）───

const HighlightSprite = {
  canvas: null,
  generate() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 3;
    this.canvas.height = 3;
    const ctx = this.canvas.getContext('2d');
    const grad = ctx.createRadialGradient(1.5, 1.5, 0, 1.5, 1.5, 1.5);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 3, 3);
  },
};

// ─── FG Bokeh 精灵（预渲染大光斑）───

const BokehSprite = {
  canvas: null,
  generate() {
    const size = 27; // 略大于最大 FG 粒子 25px
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    const ctx = this.canvas.getContext('2d');
    const cx = size / 2, cy = size / 2, r = cx;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.15, 'rgba(255,240,200,0.85)');
    grad.addColorStop(0.5, 'rgba(255,200,150,0.4)');
    grad.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  },
};

// ─── LayerRenderer ───

class LayerRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    HighlightSprite.generate();
    BokehSprite.generate();
  }

  /** 调整画布尺寸 */
  resize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  /**
   * 渲染一帧
   */
  draw(particles) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 清空
    ctx.fillStyle = CONFIG.canvas.bgColor;
    ctx.fillRect(0, 0, w, h);

    const data = particles.data;
    const n = particles.n;

    // ── 第一遍：BG 层（小实心点，fillRect）──
    const bgRange = particles.layerRange(0);
    ctx.globalAlpha = CONFIG.render.bgAlpha;
    for (let i = bgRange.start; i < bgRange.end; i++) {
      const off = i * STRIDE;
      const x = data[off + P.X];
      const y = data[off + P.Y];
      const s = data[off + P.SIZE];
      if (x + s < 0 || x - s > w || y + s < 0 || y - s > h) continue;
      const r = data[off + P.R];
      const g = data[off + P.G];
      const b = data[off + P.B];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }

    // ── 第二遍：MID 层（弧线填充）──
    const midRange = particles.layerRange(1);
    ctx.globalAlpha = CONFIG.render.midAlpha;
    for (let i = midRange.start; i < midRange.end; i++) {
      const off = i * STRIDE;
      const x = data[off + P.X];
      const y = data[off + P.Y];
      const s = data[off + P.SIZE];
      if (x + s < 0 || x - s > w || y + s < 0 || y - s > h) continue;
      const r = data[off + P.R];
      const g = data[off + P.G];
      const b = data[off + P.B];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 第三遍：FG 层（bokeh 光斑 + 高光芯）──
    const fgRange = particles.layerRange(2);
    ctx.globalAlpha = CONFIG.render.fgAlpha;
    const bokeh = BokehSprite.canvas;
    const highlight = HighlightSprite.canvas;
    for (let i = fgRange.start; i < fgRange.end; i++) {
      const off = i * STRIDE;
      const x = data[off + P.X];
      const y = data[off + P.Y];
      const s = data[off + P.SIZE];
      if (x + s < 0 || x - s > w || y + s < 0 || y - s > h) continue;
      const r = data[off + P.R];
      const g = data[off + P.G];
      const b = data[off + P.B];

      // 1. 画暖色调底光
      ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();

      // 2. 画白色 bokeh 精灵（光斑形状）
      ctx.drawImage(bokeh, x - s / 2, y - s / 2, s, s);

      // 3. 画中心高光芯（精细感关键）
      const highlightSize = Math.max(1.5, s * 0.12);
      ctx.drawImage(highlight, x - highlightSize / 2, y - highlightSize / 2, highlightSize, highlightSize);
    }

    ctx.globalAlpha = 1;
  }
}
