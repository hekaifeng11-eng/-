export const renderVertex = `
attribute vec2 a_uv;
attribute vec3 a_color;

uniform sampler2D u_positionTexture;
uniform sampler2D u_velocityTexture;
uniform float u_pointSize;
uniform float u_visibleCount;
uniform float u_texWidth;
uniform float u_texHeight;
uniform float u_stretch;

varying vec3 v_color;
varying float v_alpha;
varying vec2 v_vel;

void main() {
    float idx = floor(a_uv.y * u_texHeight) * u_texWidth + floor(a_uv.x * u_texWidth);
    if (idx >= u_visibleCount) {
        gl_Position = vec4(99999.0, 99999.0, 99999.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }

    vec4 posLife = texture2D(u_positionTexture, a_uv);
    vec3 pos = posLife.xyz;
    float life = posLife.w;

    vec3 vel = texture2D(u_velocityTexture, a_uv).xyz;
    v_vel = vel.xy;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    float speed = length(vel);
    float stretch = 1.0 + speed * u_stretch * 0.05;
    gl_PointSize = u_pointSize * stretch * (300.0 / max(-mvPosition.z, 0.001));

    gl_Position = projectionMatrix * mvPosition;

    v_color = a_color;
    v_alpha = smoothstep(0.0, 0.3, life);
}
`;

export const renderFragment = `
precision highp float;

uniform float u_opacity;
uniform sampler2D u_circleTexture;

varying vec3 v_color;
varying float v_alpha;
varying vec2 v_vel;

void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);

    float speed = length(v_vel);
    if (speed > 0.01) {
        vec2 dir = normalize(v_vel);
        float angle = atan(dir.y, dir.x);
        float c = cos(-angle);
        float s = sin(-angle);
        uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
        uv.y *= 1.0 + speed * 0.025;
    }

    float dist = length(uv);

    float coreAlpha = 1.0 - smoothstep(0.0, 0.35, dist);
    float midAlpha  = 1.0 - smoothstep(0.2, 0.5, dist);
    float outerAlpha = 1.0 - smoothstep(0.3, 0.5, dist);

    float alpha = midAlpha;
    if (alpha < 0.005) discard;

    float innerGlow = exp(-dist * 10.0) * 0.6;
    float midGlow   = exp(-dist * 6.0) * 0.3;
    float outerGlow = exp(-dist * 3.0) * 0.15;

    float totalGlow = innerGlow + midGlow + outerGlow;

    vec3 warmShift = vec3(0.02, -0.01, -0.02) * coreAlpha;
    vec3 finalColor = v_color + warmShift + v_color * totalGlow * 1.5;

    float finalAlpha = (alpha + totalGlow) * u_opacity * v_alpha;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
`;
