/**
 * sampler.js — 图片加载 + 网格采样 + 暖色调色
 *
 * ImageLoader:  File → Image 解码，带错误处理
 * ImageSampler: 缩放图片 → 固定网格采样 → 产出目标点
 * ColorPalette: RGB → 暖调偏移
 */

// ─── ColorPalette ───

const ColorPalette = {
  /**
   * 暖调偏移：RGB 各通道乘以增益系数
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @returns {{r, g, b}}
   */
  warmShift(r, g, b) {
    const cfg = CONFIG.color;
    return {
      r: Math.min(255, Math.max(0, Math.round(r * cfg.warmR))),
      g: Math.min(255, Math.max(0, Math.round(g * cfg.warmG))),
      b: Math.min(255, Math.max(0, Math.round(b * cfg.warmB))),
    };
  },

  /**
   * Cool→Warm 深度渐变：近=暖橙金，远=冷蓝紫
   * @param {number} depth - Z 深度值
   * @param {number} depthRange - 深度范围
   * @returns {{r, g, b}}
   */
  depthGradient(depth, depthRange) {
    const t = Math.max(-1, Math.min(1, depth / depthRange));
    const blend = (t + 1) / 2;
    // Warm gold: rgb(255, 200, 80)  →  Cool blue: rgb(60, 120, 255)
    return {
      r: Math.round(255 * (1 - blend) + 60 * blend),
      g: Math.round(200 * (1 - blend) + 120 * blend),
      b: Math.round(80 * (1 - blend) + 255 * blend),
    };
  },
};

// ─── ImageLoader ───

class ImageLoader {
  /**
   * 从 File 对象加载图片
   * @param {File} file
   * @returns {Promise<Image>}
   */
  static load(file) {
    return new Promise((resolve, reject) => {
      // 检查文件类型
      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
      if (!validTypes.includes(file.type)) {
        reject(new Error(`不支持的文件类型: ${file.type}`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片解码失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }
}

// ─── ImageSampler ───

class ImageSampler {
  /**
   * 从 Image 对象网格采样
   * @param {Image} img
   * @param {number} canvasW - 画布宽度（用于居中）
   * @param {number} canvasH - 画布高度
   * @returns {{ samples: Array<{x,y,r,g,b}>, centroidX: number, centroidY: number, imgX: number, imgY: number, drawW: number, drawH: number }}
   */
  static sample(img, canvasW, canvasH) {
    const cfg = CONFIG.particles;

    // 0. 计算缩放和居中（确保采样图像不超过画布且不超过 maxImageDim）
    const scale = Math.min(
      cfg.maxImageDim / img.width,
      cfg.maxImageDim / img.height,
      canvasW / img.width  * 0.95,
      canvasH / img.height * 0.95
    );
    let sampleW = Math.round(img.width * scale);
    let sampleH = Math.round(img.height * scale);

    // 最小尺寸保护
    const minDim = cfg.minImageDim;
    if (sampleW < minDim && sampleH < minDim) {
      const minScale = Math.max(minDim / sampleW, minDim / sampleH);
      sampleW = Math.round(sampleW * minScale);
      sampleH = Math.round(sampleH * minScale);
    }

    // 画布上绘制位置（居中）
    const drawW = sampleW;
    const drawH = sampleH;
    const imgX = (canvasW - drawW) / 2;
    const imgY = (canvasH - drawH) / 2;

    // 1. 绘制到离屏 Canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = sampleW;
    offCanvas.height = sampleH;
    const ctx = offCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, sampleW, sampleH);

    // 2. 读取像素
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    const pixels = imageData.data;

    // 3. 计算步长，确保采样数 ≤ maxCount
    let step = cfg.defaultStep;
    const maxSamples = cfg.maxCount;
    let samples = [];

    // 尝试逐步增加步长直到采样数在限制内
    while (true) {
      samples = [];
      for (let y = 0; y < sampleH; y += step) {
        for (let x = 0; x < sampleW; x += step) {
          const idx = (y * sampleW + x) * 4;
          const alpha = pixels[idx + 3];
          if (alpha < cfg.alphaThreshold) continue;

          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const warm = ColorPalette.warmShift(r, g, b);

          // 亮度 → Z 深度（亮=近，暗=远）
          const brightness = (r + g + b) / (3 * 255);
          const depthRange = CONFIG.camera ? CONFIG.camera.depthRange : 0;
          const depth = (brightness - 0.5) * 2 * depthRange;

          samples.push({
            x: imgX + x,
            y: imgY + y,
            r: warm.r,
            g: warm.g,
            b: warm.b,
            depth: depth,
          });
        }
      }
      if (samples.length <= maxSamples || step >= 20) break;
      step += 1;
    }

    // 严格截断到 maxCount
    if (samples.length > maxSamples) {
      samples.length = maxSamples;
    }

    // 完全透明图片保护
    if (samples.length === 0) {
      // 使用暖金色随机粒子填充
      for (let i = 0; i < Math.min(100, maxSamples); i++) {
        samples.push({
          x: imgX + Math.random() * sampleW,
          y: imgY + Math.random() * sampleH,
          r: 220 + Math.floor(Math.random() * 35),
          g: 180 + Math.floor(Math.random() * 40),
          b: 100 + Math.floor(Math.random() * 30),
        });
      }
    }

    // 4. 计算质心（用于散落起点）
    let sumX = 0, sumY = 0, totalWeight = 0;
    for (const s of samples) {
      const brightness = s.r + s.g + s.b;
      sumX += s.x * brightness;
      sumY += s.y * brightness;
      totalWeight += brightness;
    }
    const centroidX = totalWeight > 0 ? sumX / totalWeight : canvasW / 2;
    const centroidY = totalWeight > 0 ? sumY / totalWeight : canvasH / 2;

    return {
      samples,
      centroidX,
      centroidY,
      imgX,
      imgY,
      drawW,
      drawH,
    };
  }
}
