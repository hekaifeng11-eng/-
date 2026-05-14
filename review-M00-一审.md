# review-M00-一审.md — 一审全记录

## 产品视角审查（plan-ceo-review）

**模式**: HOLD SCOPE  
**日期**: 2026-05-14  

### 1. 架构审查
**OK** — 三层景深系统（背景5000小点/中景3500半锐/前景1500大bokeh）映射真实光学对焦，比例合理。  
**⚠️ WARNING** — 弹簧-阻尼物理每粒子每帧独立计算。10000粒子的内存占用 ~640KB，无问题。三层时序需要考虑重叠聚合。

**✅ 建议采纳**: 聚合窗口重叠——背景完成60%时中层开始，中层60%时前景开始。产生层次追逐效果。

### 2. 性能审查
**🔴 严重** — 每帧 10000 次 `ctx.radialGradient` 不可行。Canvas 2D 下每帧路径构建+光栅化消耗 30-50ms，帧率仅 20-30fps。  
**→ 修复方案**: 每层预渲染精灵到离屏 Canvas。每帧只需 3 次渐变预渲染 + 10000 次 `drawImage`（blit 吞吐 ~100K+/帧）。

**⚠️** — 不要每帧排序粒子。按三层分批渲染（bg→mid→fg 三个数组依次）。

### 3. 设计与体验审查
**OK** — 暖调保留原色是正确的色彩策略。无 bloom 后处理是正确决定。

**⚠️** — 散落动画用均匀随机看起来廉价。建议用物理感散射：粒子从中心爆炸式飞出，或从边缘飘入。

**⚠️** — 缺少"散落阶段"时长和缓动的设计。不能瞬间散落然后慢慢聚合。建议散射动画持续 1-2s。

### 4. 数据流与边界情况
**🔴 严重 — 完全缺失边界处理**

| 场景 | 风险 | 建议 |
|---|---|---|
| 超大图片 (4K+) | 网格采样占用过大 | 采样前缩放到 300px 宽 |
| 极小图片 (32x32) | 有效样本过少 | 设最短边 100px 最小值 |
| 透明 PNG | 透明像素变成不可见粒子 | 跳过 alpha < 阈值的采样点 |
| 上传中途切换图片 | 飞行中粒子状态混乱 | 完成当前聚合（加速收尾）→ 重新散落 |
| 低对比度图片 | 汇聚结果平淡 | 检测调色板方差，低时拉伸对比度 |
| 损坏文件 | 浏览器解码错误 | 显示错误状态，不要死画布 |

### 5. 长期可扩展性
**OK** — Canvas 2D 架构对未来加鼠标交互友好（只需在物理循环中加斥力场）。三层分离天然支持景深感交互。数据模型（pos + velocity + target）可迁移到 WebGL。

---

## 架构视角审查（plan-eng-review）

### 1. 模块架构与数据流

```
核心模块依赖图：

config/Constants.js ──▶ core/ParticleArray.js ──▶ physics/SpringDamper.js
                        core/StateMachine.js         physics/PhysicsSystem.js
                        
sampling/ImageLoader.js ──▶ sampling/ImageSampler.js ──▶ sampling/ColorPalette.js
render/SpriteAtlas.js ──▶ render/LayerRenderer.js

controller/ConvergenceScheduler.js
controller/ScatterStrategy.js

app/Orchestrator.js + main.js (rAF循环 + DOM绑定)
```

**✅ 推荐架构** — 使用 `Float32Array` 存储粒子数据（不要创建 10000 个对象），单个连续分配 520KB，零 GC。

### 2. 物理模型验证
**⚠️** — 弹簧阻尼公式正确，但积分方法很关键。推荐**半隐式欧拉**（比显式更稳定）：

```
velocity += (k * (target - pos) - b * velocity) * dt  ← 更新后速度
position += velocity * dt
```

**⚠️** — `dt` 必须以秒为单位（0.01667）。帧率波动时用 `Math.min(dt, 1/30)` 防止标签页切换后物理爆炸。

**✅ 物理参数验证**（以 60fps 校准）：

| 层 | k | b | 阻尼比 | 行为 |
|---|---|---|---|---|
| BG | 0.12 | 0.65 | 0.94（近临界） | 快速到位，无超调 |
| MID | 0.08 | 0.45 | 0.80（欠阻尼） | 温和超调，轻微回摆 |
| FG | 0.04 | 0.25 | 0.62（欠阻尼） | 飘浮感，明显振荡 |

### 3. 聚合时序

```
总时长 8 秒：
bg:   ████████████░░░░░░░░░░░░░░░░░░░░  t=0~1.5s
mid:  ░░░░░░████████████░░░░░░░░░░░░░░  t=1.5~4.5s  
fg:   ░░░░░░░░░░░░░░████████████████░░  t=3.0~6.0s
settle: ░░░░░░░░░░░░░░░░░░░░░░████████  t=6.0~8.0s

重叠：bg 60% 完成时 mid 开始，mid 60% 完成时 fg 开始。
```

**🔴 关键** — 门未打开时，粒子必须在 scatter 位置附近持续微漂移（加低幅噪声），不能让 5000 个粒子冻住不动。

### 4. 渲染性能预算（60fps = 16.67ms）

| 阶段 | 操作 | 预估耗时 |
|---|---|---|
| Update | 弹簧阻尼 × 10000 | 1.0-1.5ms |
| Update | 噪声注入 | 0.2ms |
| Render | clearRect | 0.1ms |
| Render | drawImage × 10000 | 3.0-5.0ms |
| Overhead | rAF 等 | 0.5ms |
| **总计** | | **~7.5ms** ✅ 远低于预算 |

**⚠️** — `ctx.save()`/`ctx.restore()` 不能在热循环中调用（每帧 1-2μs × 10000 = 10-20ms）。每层批量设置一次状态。

### 5. 实现阶段（按依赖顺序）

| 阶段 | 内容 | 预估 |
|---|---|---|
| 1 | Constants.js 常量定义 | 15min |
| 2 | ParticleArray + SpringDamper + StateMachine（纯数据+纯物理） | 45min |
| 3a | ImageLoader + ImageSampler + ColorPalette（图片管线） | 1h |
| 3b | SpriteAtlas（预渲染三层精灵） | 30min |
| 4 | PhysicsSystem + LayerRenderer（物理解+渲染） | 1h |
| 5 | ConvergenceScheduler + ScatterStrategy（聚合控制） | 45min |
| 6 | Orchestrator + main.js（rAF循环+DOM绑定） | 45min |
| 7 | 边界处理 + 错误处理 + 打磨 | 1-2h |
| **总计** | | **~6-7 小时** |

### 6. 边界情况处理
- 采样超过 10000：自动增大步长直到 ≤ 10000
- 图片最小边 < 100px：放大到 100px
- 透明 PNG：跳过 alpha < 20 的采样点
- 中途切换图片：StateMachine 重置 → 重新采样 → 重新散落
- 损坏文件：ImageLoader 回调 → DOM 错误提示
- 标签页切换恢复：dt 上限 33ms 防止物理爆炸

### 7. 测试策略
- **可单元测试**: SpringDamper（纯函数）、ColorPalette（纯函数）、StateMachine（状态转换）、ImageSampler（采样逻辑）、ConvergenceScheduler（门控时序）
- **集成测试**: 物理→渲染管线（离屏 Canvas 像素验证）、图片加载→采样流程
- **视觉审查**: 聚合美感、bokeh 感、色调变换，需人眼确认
- **调试工具**: 按 D 键切换调试叠加层（FPS、状态、粒子数、进度）

---

## 安全视角审查（cso）

### Phase 0: 架构模型

| 维度 | 评估 |
|---|---|
| 技术栈 | 纯前端 HTML + Canvas 2D，无框架，无后端 |
| 网络请求 | 零 — 所有图片在浏览器本地处理，无 API 调用 |
| 数据存储 | 零 — 无 localStorage、无 cookie、无用户数据 |
| 外部依赖 | 零 — 纯原生 JS，无 npm 包 |

### 攻击面总结

**⚠️ 整体风险: 极低**

| 类别 | 风险 | 说明 |
|---|---|---|
| XSS / 注入 | 🟢 无风险 | 无 innerHTML，Canvas 不执行 HTML |
| 数据泄露 | 🟢 无风险 | 图片仅在浏览器本地 Canvas 处理 |
| CSRF | 🟢 不适用 | 无后端 API，无状态修改操作 |
| 供应链 | 🟢 无风险 | 零外部依赖，零 npm 包 |
| 认证 | 🟢 不适用 | 纯前端页面，无用户系统 |
| 文件上传 | 🟢 低风险 | FileReader + Image 在内存中解码，不上传服务器 |

### 注意事项（非漏洞，属于最佳实践）

| 事项 | 建议 |
|---|---|
| CSP 头 | 如果嵌入到生产页面，建议设置 `img-src 'self' blob: data:` |
| Canvas 隐私 | 如用户上传的图片包含敏感信息，Canvas 渲染遵循浏览器同源策略 |
| 文件类型检查 | 建议在 FileReader 之前检查 MIME 类型 (`image/png`, `image/jpeg` 等)，避免非图片文件触发解码错误 |
| 文件大小限制 | 建议限制上传文件大小（如 10MB），防止超大文件导致内存压力 |

**结论**: 该项目安全面极小，无 CRITICAL/HIGH 级别风险。主要关注点应在稳健性（边界处理）而非安全性。

---

> **安全审查免责声明**: 本工具不替代专业安全审计。/cso 是 AI 辅助的常见漏洞模式扫描，并不全面。对于处理敏感数据、支付或 PII 的生产系统，请聘用专业渗透测试公司。
