/**
 * renderer-webgl.js — WebGL 3D 点精灵渲染器
 *
 * 支持：3D 透视投影、绕 Y 轴旋转、径向辉光、Z 雾
 */

// ─── 顶点着色器 ───

const VS_SRC = `
attribute vec3 a_position;
attribute float a_size;
attribute vec3 a_color;

uniform vec2 u_resolution;
uniform float u_angle;
uniform float u_focalLength;

varying vec3 v_color;
varying float v_depthFade;

void main() {
    v_color = a_color / 255.0;

    // 以画布中心为原点
    vec2 center = u_resolution * 0.5;
    vec3 pos = vec3(a_position.x - center.x, a_position.y - center.y, a_position.z);

    // 绕 Y 轴旋转
    float c = cos(u_angle);
    float s = sin(u_angle);
    vec3 rot = vec3(
        pos.x * c - pos.z * s,
        pos.y,
        pos.x * s + pos.z * c
    );

    // 透视投影：近大远小
    float focal = u_focalLength;
    float depth = rot.z + focal;

    // 裁掉摄像机后面的粒子
    if (depth <= 1.0) {
        gl_Position = vec4(0.0, 0.0, -1.0, 0.0);
        gl_PointSize = 0.0;
        v_depthFade = 0.0;
        return;
    }

    float scale = focal / depth;

    // Z 雾衰减：远=0(雾)，近=1(清晰)
    float fog = smoothstep(focal * 0.3, focal * 1.0, depth);

    // 投影到裁剪空间
    vec2 screenPos = rot.xy * scale + center;
    vec2 clip = screenPos / u_resolution * 2.0 - 1.0;
    clip.y *= -1.0;

    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = clamp(a_size * scale, 0.5, 128.0);
}
`;

// ─── 片元着色器 ───

const FS_SRC = `
precision mediump float;
varying vec3 v_color;
varying float v_depthFade;

uniform float u_alpha;
uniform float u_glowIntensity;

void main() {
    vec2 mid = gl_PointCoord - vec2(0.5);
    float dist = length(mid);

    // 圆形粒子
    float alpha = 1.0 - smoothstep(0.35, 0.5, dist);
    if (alpha < 0.01) discard;

    // 径向辉光
    float glow = exp(-dist * 10.0) * u_glowIntensity;

    // 中心暖色增强
    vec3 color = v_color * (1.0 + glow * 0.5);

    // Z 雾
    float fog = v_depthFade;
    alpha = (alpha + glow) * u_alpha * fog;
    color *= fog;

    gl_FragColor = vec4(color, alpha);
}
`;

// ─── WebGLRenderer ───

class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = 0;
        this.height = 0;

        const gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false,
        });
        if (!gl) throw new Error('WebGL not supported');
        this.gl = gl;

        this._initShaders(gl);
        this._initBuffers(gl);
        this._initState(gl);
    }

    _initShaders(gl) {
        const vs = this._compile(gl, gl.VERTEX_SHADER, VS_SRC);
        const fs = this._compile(gl, gl.FRAGMENT_SHADER, FS_SRC);

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Shader link failed: ' + gl.getProgramInfoLog(prog));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        this.program = prog;
        gl.useProgram(prog);

        this.aPos = gl.getAttribLocation(prog, 'a_position');
        this.aSize = gl.getAttribLocation(prog, 'a_size');
        this.aColor = gl.getAttribLocation(prog, 'a_color');

        this.uRes = gl.getUniformLocation(prog, 'u_resolution');
        this.uAngle = gl.getUniformLocation(prog, 'u_angle');
        this.uFocal = gl.getUniformLocation(prog, 'u_focalLength');
        this.uAlpha = gl.getUniformLocation(prog, 'u_alpha');
        this.uGlow = gl.getUniformLocation(prog, 'u_glowIntensity');
    }

    _compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(s));
        }
        return s;
    }

    _initBuffers(gl) {
        this.vbo = gl.createBuffer();
    }

    _initState(gl) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.039, 0.039, 0.059, 1.0);
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
        this.gl.uniform2f(this.uRes, w, h);
        this.gl.uniform1f(this.uFocal, CONFIG.camera.focalLength);
    }

    /**
     * 渲染一帧
     * @param {ParticleArray} particles
     * @param {number} cameraAngle - 当前摄像机角度（弧度）
     */
    draw(particles, cameraAngle) {
        const gl = this.gl;
        const n = particles.n;
        if (n === 0) return;

        gl.clear(gl.COLOR_BUFFER_BIT);

        // 上传粒子数据（首帧 bufferData，后续 bufferSubData 避免重分配）
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        if (this._bufferSize !== particles.data.byteLength) {
            this._bufferSize = particles.data.byteLength;
            gl.bufferData(gl.ARRAY_BUFFER, particles.data, gl.DYNAMIC_DRAW);
        } else {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, particles.data);
        }

        const stride = STRIDE * 4;

        gl.enableVertexAttribArray(this.aPos);
        gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(this.aSize);
        gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, stride, P.SIZE * 4);

        gl.enableVertexAttribArray(this.aColor);
        gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, stride, P.R * 4);

        // 摄像机角度
        gl.uniform1f(this.uAngle, cameraAngle);

        // 分三层绘制（不同透明度 / 辉光强度）
        const bg = particles.layerRange(0);
        const mid = particles.layerRange(1);
        const fg = particles.layerRange(2);

        gl.uniform1f(this.uAlpha, CONFIG.render.bgAlpha);
        gl.uniform1f(this.uGlow, CONFIG.camera.glowIntensity * 0.5);
        gl.drawArrays(gl.POINTS, bg.start, bg.end - bg.start);

        gl.uniform1f(this.uAlpha, CONFIG.render.midAlpha);
        gl.uniform1f(this.uGlow, CONFIG.camera.glowIntensity * 0.8);
        gl.drawArrays(gl.POINTS, mid.start, mid.end - mid.start);

        gl.uniform1f(this.uAlpha, CONFIG.render.fgAlpha);
        gl.uniform1f(this.uGlow, CONFIG.camera.glowIntensity);
        gl.drawArrays(gl.POINTS, fg.start, fg.end - fg.start);
    }
}
