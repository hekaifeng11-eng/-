# 粒子汇聚效果 — 方案设计

## 概述
上传任意图片 → 10000 粒子从散落态通过物理模拟汇聚成图片形状，带三层景深（bokeh）效果。

## 技术栈
- HTML5 + Canvas 2D
- 纯原生 JavaScript，零外部依赖
- Float32Array 连续存储粒子数据
- 半隐式欧拉积分物理系统

## 模块划分

| 模块 | 文件 | 职责 |
|------|------|------|
| Config | src/config.js | 所有可调参数常量 |
| Core | src/core.js | ParticleArray (Float32Array) + StateMachine |
| Physics | src/physics.js | SpringDamper + PhysicsSystem (三层物理参数) |
| Sampler | src/sampler.js | ImageLoader + ImageSampler + ColorPalette |
| Renderer | src/renderer.js | SpriteAtlas (预渲染) + LayerRenderer |
| Controller | src/controller.js | ConvergenceScheduler + ScatterStrategy |
| App | src/app.js | Orchestrator (rAF) + main (DOM 绑定) |
| Entry | index.html | Canvas + 文件上传 UI |

## 粒子数据格式

Float32Array, STRIDE=13:
```
[x, y, vx, vy, tx, ty, scatterX, scatterY, size, r, g, b, a]
```

## 物理参数（以 60fps = dt 0.01667s 校准）

| 层 | 粒子数 | 大小 | k | b | 阻尼比 | 聚合延迟 |
|---|---|---|---|---|---|---|
| BG | ~5000 | 1-3px | 0.12 | 0.65 | 0.94 | t=0 |
| MID | ~3500 | 4-8px | 0.08 | 0.45 | 0.80 | t+1.5s |
| FG | ~1500 | 10-25px | 0.04 | 0.25 | 0.62 | t+3.0s |

## 聚合时序
- t=0~1.5s: BG 汇聚，MID+FG 闲散漂移
- t=1.5~4.5s: MID 汇聚，FG 闲散漂移
- t=3.0~6.0s: FG 汇聚
- t=6.0~8.0s: 全局微浮动

## 边界处理
- 超大图片：采样前缩放到 300px 宽
- 超小图片：最短边 < 100px 时放大
- 透明 PNG：跳过 alpha < 20 的像素
- 中途换图：StateMachine 重置 + 重新采样
