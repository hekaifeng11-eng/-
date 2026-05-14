/**
 * app.js — Orchestrator + DOM 绑定
 *
 * Orchestrator: 持有所有子系统，驱动 rAF 循环
 * main():       DOM 事件绑定，上传交互，拖拽
 */

// ─── Orchestrator ───

class Orchestrator {
  constructor(canvas, statusEl, errorEl, hintEl) {
    this.renderer = new LayerRenderer(canvas);
    this.physics = null;
    this.particles = null;
    this.scheduler = new ConvergenceScheduler();
    this.stateMachine = new StateMachine();

    this.statusEl = statusEl;
    this.errorEl = errorEl;
    this.hintEl = hintEl;

    this.rafId = null;
    this.lastTime = 0;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.frameCount = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const oldW = CONFIG.canvas.width;
    const oldH = CONFIG.canvas.height;
    CONFIG.canvas.width = w;
    CONFIG.canvas.height = h;
    this.renderer.resize(w, h);

    if (this.particles && oldW > 0 && oldH > 0) {
      const scaleX = w / oldW;
      const scaleY = h / oldH;
      const data = this.particles.data;
      // 重新缩放所有粒子的位置和散落目标
      for (let i = 0; i < this.particles.n; i++) {
        const off = i * STRIDE;
        data[off + P.X] *= scaleX;
        data[off + P.Y] *= scaleY;
        data[off + P.TX] *= scaleX;
        data[off + P.TY] *= scaleY;
        data[off + P.SX] *= scaleX;
        data[off + P.SY] *= scaleY;
      }
    }
    this._lastW = w;
    this._lastH = h;
  }

  // ─── 加载图片 ───

  async loadImage(file) {
    try {
      this.hideError();
      this.stop();

      const img = await ImageLoader.load(file);
      const w = CONFIG.canvas.width;
      const h = CONFIG.canvas.height;

      // 采样
      const result = ImageSampler.sample(img, w, h);
      if (result.samples.length === 0) {
        this.showError('未检测到有效像素，请换一张图片');
        return;
      }

      // 创建粒子（即使样本不足也保证分配 10000 个）
      this.particles = new ParticleArray(CONFIG.particles.maxCount);
      this.particles.init(result.centroidX, result.centroidY, CONFIG.layers, result.samples);

      // 物理系统
      this.physics = new PhysicsSystem(this.particles);

      // 散落目标
      ScatterStrategy.scatter(this.particles, result.centroidX, result.centroidY, w, h);

      // 重置调度器
      this.scheduler.reset();

      // 先切回 IDLE 再转 SCATTERING（确保状态合法）
      this.stateMachine.state = STATE.IDLE;
      this.stateMachine.transition(STATE.SCATTERING);

      // UI
      this.hintEl.classList.add('hidden');
      document.getElementById('upload-label').textContent = '更换图片';

      // 启动
      this.lastTime = performance.now();
      this.startLoop();

    } catch (err) {
      this.showError(err.message || '图片加载失败');
    }
  }

  // ─── 循环控制 ───

  startLoop() {
    if (this.rafId) return;
    const loop = (now) => {
      const realDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.tick(realDt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ─── 每帧逻辑 ───

  tick(realDt) {
    this.frameCount++;

    // FPS
    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    const state = this.stateMachine.state;

    // 只在动画态进行物理和渲染
    if (state === STATE.SCATTERING || state === STATE.CONVERGING || state === STATE.SETTLED) {
      this.scheduler.advance(realDt);
      this.physics.step(realDt, this.scheduler.elapsed, (layerIdx) => {
        return this.scheduler.isGateOpen(layerIdx);
      });

      // 状态转换
      if (state === STATE.SCATTERING && this.scheduler.elapsed >= CONFIG.physics.scatterDuration) {
        this.stateMachine.transition(STATE.CONVERGING);
      }
      if (state === STATE.CONVERGING && this.scheduler.isComplete) {
        this.stateMachine.transition(STATE.SETTLED);
      }

      this.renderer.draw(this.particles);
    }

    this.updateStatus(state);
  }

  // ─── UI ───

  updateStatus(state) {
    if (!this.statusEl) return;
    const pct = Math.min(100, Math.round(this.scheduler.progress * 100));
    this.statusEl.innerHTML = `STATE: ${state}<br>${pct}%`;
  }

  showError(msg) {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg;
    this.errorEl.classList.add('show');
    this.stateMachine.state = STATE.IDLE;
    setTimeout(() => this.hideError(), 3000);
  }

  hideError() {
    if (this.errorEl) {
      this.errorEl.classList.remove('show');
    }
  }
}

// ─── main — DOM 绑定 ───

(function main() {
  const canvas = document.getElementById('canvas');
  const fileInput = document.getElementById('file-input');
  const uploadZone = document.getElementById('upload-zone');
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error-toast');
  const hintEl = document.getElementById('hint');

  const orchestrator = new Orchestrator(canvas, statusEl, errorEl, hintEl);

  // 点击上传
  uploadZone.addEventListener('click', () => fileInput.click());

  // 文件选择
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) orchestrator.loadImage(file);
    fileInput.value = '';
  });

  // 拖拽到上传区域
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      orchestrator.loadImage(file);
    }
  });

  // 全局拖拽（整页都可拖入）
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      orchestrator.loadImage(file);
    }
  });

  // D 键切换状态显示
  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      const cur = statusEl.style.opacity;
      statusEl.style.opacity = cur === '1' ? '0' : '1';
    }
  });
})();
