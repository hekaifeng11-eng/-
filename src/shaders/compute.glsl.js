export const computePositionFrag = `
uniform sampler2D positionTexture;
uniform float u_dt;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;

    pos += vel * u_dt;

    gl_FragColor = vec4(pos, 1.0);
}
`;

export const computeVelocityFrag = `
uniform sampler2D velocityTexture;
uniform float u_dt;
uniform float u_damping;
uniform float u_springK;
uniform float u_curlStrength;
uniform float u_state;
uniform float u_time;
uniform float u_maxVel;

uniform sampler2D targetTexture;
uniform sampler2D scatterTexture;

vec3 curlNoise(vec3 p) {
    float nx = sin(p.y * 0.12 + u_time * 0.15) * cos(p.z * 0.08 + u_time * 0.1);
    float ny = sin(p.z * 0.10 + u_time * 0.12) * cos(p.x * 0.10 + u_time * 0.08);
    float nz = sin(p.x * 0.08 + u_time * 0.10) * cos(p.y * 0.12 + u_time * 0.06);
    return vec3(nx, ny, nz);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec3 vel     = texture2D(velocityTexture, uv).xyz;
    vec3 pos     = texture2D(positionTexture, uv).xyz;
    vec3 target  = texture2D(targetTexture, uv).xyz;
    vec3 scatter = texture2D(scatterTexture, uv).xyz;

    vec3 goal = mix(target, scatter, u_state);

    vec3 spring = (goal - pos) * u_springK;
    vel += spring * u_dt;

    vel *= clamp(u_damping, 0.9, 1.0);

    vec3 curl = curlNoise(pos) * u_curlStrength;
    vel += curl * u_dt;

    vel = clamp(vel, -u_maxVel, u_maxVel);

    gl_FragColor = vec4(vel, 1.0);
}
`;
