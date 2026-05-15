/**
 * compute.glsl.js — GPGPU 计算着色器
 *
 * 每像素 = 一个粒子
 * positionTexture: vec4(x, y, z, 0)  当前位置
 * velocityTexture: vec4(vx, vy, vz, 0)  当前速度
 *
 * 输出：新位置到 positionTexture
 */

export const computePositionFrag = `
uniform vec2 resolution;
uniform float u_dt;
uniform float u_damping;
uniform float u_curlStrength;
uniform float u_time;

// 3D curl noise (简化版)
vec3 curlNoise(vec3 p) {
    float n = sin(p.x * 0.1 + u_time * 0.3) * cos(p.y * 0.1 + u_time * 0.2) * sin(p.z * 0.1 + u_time * 0.1);
    float nx = sin(p.y * 0.12 + u_time * 0.25) * cos(p.z * 0.08);
    float ny = sin(p.z * 0.15 + u_time * 0.2) * cos(p.x * 0.1);
    float nz = sin(p.x * 0.1 + u_time * 0.15) * cos(p.y * 0.12);
    return vec3(nx, ny, nz) * u_curlStrength;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;

    // 阻尼
    vel *= u_damping;

    // Curl noise 流场力
    vec3 curl = curlNoise(pos);
    vel += curl * u_dt;

    // 更新位置
    pos += vel * u_dt;

    gl_FragColor = vec4(pos, 1.0);
}
`;

export const computeVelocityFrag = `
uniform vec2 resolution;
uniform float u_dt;
uniform float u_damping;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 pos = texture2D(positionTexture, uv).xyz;

    // 阻尼衰减
    vel *= u_damping;

    // Curl noise 力写入 velocity
    float nx = sin(pos.y * 0.12 + pos.x * 0.08) * cos(pos.z * 0.1);
    float ny = sin(pos.z * 0.1 + pos.y * 0.06) * cos(pos.x * 0.12);
    float nz = sin(pos.x * 0.08 + pos.z * 0.15) * cos(pos.y * 0.1);
    vel += vec3(nx, ny, nz) * 0.5 * u_dt;

    gl_FragColor = vec4(vel, 1.0);
}
`;
