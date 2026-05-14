# review-M02-M07.md — 全部核心模块审查全记录

## 审查请求包

### 模块
模块: M02-M07 — 粒子效果核心引擎（完整审查）
包含所有核心模块：

1. src/core.js: ParticleArray (Float32Array 连续存储 10000 粒子) + StateMachine (IDLE/SCATTERING/CONVERGING/SETTLED/ERROR)
2. src/physics.js: SpringDamper 半隐式欧拉积分 + PhysicsSystem 三层物理驱动
3. src/sampler.js: ImageLoader (File→Image 解码) + ImageSampler (网格采样+边界保护) + ColorPalette (暖调偏移)
4. src/renderer.js: 三层混合渲染 (BG fillRect / MID arc / FG bokeh精灵+高光芯)
5. src/controller.js: ConvergenceScheduler (三层时间门控) + ScatterStrategy (质心爆炸式散落)
6. src/app.js: Orchestrator (rAF 主循环) + DOM 绑定 (上传/拖拽/换图/D键调试)
7. index.html + config.js: 入口、样式、全局常量

---

### 第1轮 — 小米审核报告（原始）

### 小米审核报告

| 维度 | 评级 | 说明 |
|------|------|------|
| 逻辑 | 🟡 | 存在几个关键逻辑问题：状态机转换可能竞态、采样数控制可能超限、粒子数组边界处理不一致、门控逻辑可能失效 |
| 安全 | 🟢 | 用户输入经过校验，DOM操作使用textContent而非innerHTML，XSS风险较低 |
| 工程 | 🟡 | 命名清晰但有不一致处，错误处理较完整，但存在全局依赖和重复代码 |

### 问题列表

1. **[🔴] src/controller.js:57-65** — `ConvergenceScheduler.isGateOpen()` 中bg层门开逻辑错误，未使用`gateDelay`参数
   - 当前实现：`return this.elapsed >= CONFIG.physics.scatterDuration;`
   - 问题：bg层的门开时间应基于`CONFIG.layers.bg.gateDelay`（当前为0），而非固定的scatterDuration
   - 影响：bg层粒子永远在scatterDuration后才开始汇聚，违背设计意图

2. **[🟡] src/core.js:67-72** — `ParticleArray.init()` 中样本不足时处理逻辑不一致
   - 第一个循环使用`const sample = samples[idx] || samples[samples.length - 1];`
   - 第二个循环使用`const lastSample = samples[samples.length - 1] || {...}`
   - 问题：两个默认值不同（颜色值：rgb(200,150,80) vs rgb(200,150,80)，但位置计算可能不一致）
   - 建议：统一使用相同的默认值生成逻辑

3. **[🟡] src/sampler.js:63-79** — 采样步长循环可能产生超过maxCount的采样
   - 循环条件：`if (samples.length <= maxSamples || step >= 20) break;`
   - 问题：当step=20时，即使samples.length > maxSamples也会break
   - 后果：`ParticleArray.init()`中`for (let i = 0; i < count && idx < this.n; i++, idx++)`可能只取前

### 第1轮 — 智谱审核报告（原始）

### 智谱审核报告

| 维度 | 评级 | 说明 |
| 需求 | 🟢 | 完整实现了图片上传→采样→散落→三层汇聚的核心功能，状态机设计合理，三层物理驱动和渲染策略符合要求。 |
| 体验 | 🟡 | 交互流畅，状态提示清晰，但错误处理可以更完善，边界状态处理不够全面。 |
| 对接 | 🟢 | 模块间接口设计一致，没有破坏现有接口，配置集中管理便于维护。 |

问题列表：
- [🟡] src/sampler.js:116-118 — 当图片采样结果为空时，仅显示错误提示，但没有处理边界情况（如完全透明图片）
- [🟡] src/physics.js:8-9 — springDamper函数没有处理极端情况（如k或b为负值或NaN）
- [🟡] src/app.js:170-174 — 窗口大小调整时，粒子位置按比例缩放，但没有考虑粒子大小和散落半径的调整
- [🟡] src/renderer.js:88-90 — FG层渲染时，如果粒子大小小于1.5像素，高光芯可能不可见，但没有最小尺寸保护
- [🟢] src/core.js:39-52 — ParticleArray.init方法中，如果样本不足，剩余粒子使用最后一个采样位置，可能导致视觉不连续
- [🟢] src/controller.js:67-75 — ConvergenceScheduler.isGateOpen方法中，mid/fg层的门开启条件描述与实际实现略有差异
- [🟢] src/app.js:155-158 — 加载图片时，如果图片加载失败，状态机直接设为IDLE，但没有考虑重试机制

