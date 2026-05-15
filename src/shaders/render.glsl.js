export const renderVertex = `
attribute vec2 a_uv;
attribute vec3 a_color;

uniform sampler2D u_positionTexture;
uniform float u_pointSize;

varying vec3 v_color;

void main() {
    vec3 pos = texture2D(u_positionTexture, a_uv).xyz;
    v_color = a_color;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = u_pointSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const renderFragment = `
precision highp float;

uniform sampler2D u_circleTexture;
uniform float u_opacity;

varying vec3 v_color;

void main() {
    float alpha = texture2D(u_circleTexture, gl_PointCoord).r;
    gl_FragColor = vec4(v_color, alpha * u_opacity);
}
`;
