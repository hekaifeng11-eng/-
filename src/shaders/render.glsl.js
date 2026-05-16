export const renderVertex = `
attribute vec2 a_uv;
attribute vec3 a_color;

uniform sampler2D u_positionTexture;
uniform sampler2D u_velocityTexture;
uniform float u_pointSize;
uniform float u_stretch;
uniform float u_visibleCount;
uniform float u_texWidth;
uniform float u_texHeight;

varying vec3 v_color;
varying float v_life;
varying float v_speed;

void main() {
    vec4 posLife = texture2D(u_positionTexture, a_uv);
    vec3 pos = posLife.xyz;
    float life = posLife.w;
    vec3 vel = texture2D(u_velocityTexture, a_uv).xyz;
    float speed = length(vel);

    v_color = a_color;
    v_life = life;
    v_speed = speed;

    float idx = floor(a_uv.y * u_texHeight) * u_texWidth + floor(a_uv.x * u_texWidth);
    if (idx >= u_visibleCount) {
        gl_Position = vec4(99999.0, 99999.0, 99999.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    float stretchFactor = 1.0 + speed * u_stretch * 0.01;
    gl_PointSize = u_pointSize * stretchFactor * (300.0 / max(-mvPosition.z, 0.001));

    gl_Position = projectionMatrix * mvPosition;
}
`;

export const renderFragment = `
precision highp float;

uniform sampler2D u_circleTexture;
uniform float u_opacity;

varying vec3 v_color;
varying float v_life;
varying float v_speed;

void main() {
    float alpha = texture2D(u_circleTexture, gl_PointCoord).r;

    float lifeFade = smoothstep(0.0, 0.3, v_life) * smoothstep(2.0, 1.5, v_life);
    alpha *= lifeFade;

    float speedGlow = 1.0 + v_speed * 0.02;
    vec3 color = v_color * speedGlow;

    gl_FragColor = vec4(color, alpha * u_opacity);
}
`;
