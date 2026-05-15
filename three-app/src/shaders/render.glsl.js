/**
 * render.glsl.js — 粒子渲染着色器
 *
 * 从 FBO 纹理读取位置，渲染为点精灵
 * 硬核心 + 柔软拖尾外晕（模块二构架起点）
 */

export const renderVertex = `
attribute vec2 a_uv;
uniform sampler2D u_positionTexture;
uniform float u_pointSize;

void main() {
    vec3 pos = texture2D(u_positionTexture, a_uv).xyz;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = u_pointSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const renderFragment = `
precision highp float;

uniform vec3 u_color;
uniform float u_opacity;

void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);

    // 圆形硬边
    float alpha = 1.0 - smoothstep(0.35, 0.5, dist);
    if (alpha < 0.01) discard;

    // 径向辉光
    float glow = exp(-dist * 8.0) * 0.8;

    gl_FragColor = vec4(u_color, (alpha + glow) * u_opacity);
}
`;
