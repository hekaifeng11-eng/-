export const computePositionFrag = `
uniform float u_dt;
uniform float u_life;
uniform sampler2D positionTexture;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec4 posLife = texture2D(positionTexture, uv);
    vec3 pos = posLife.xyz;
    float life = posLife.w;
    vec3 vel = texture2D(velocityTexture, uv).xyz;

    life -= u_dt * u_life;

    if (life <= 0.0) {
        float a = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        float b = fract(sin(dot(uv, vec2(93.989, 67.345))) * 23421.631);
        float c = fract(sin(dot(uv, vec2(47.163, 23.871))) * 9841.273);
        float d = fract(sin(dot(uv, vec2(31.416, 47.853))) * 12845.231);
        pos = vec3(
            (a - 0.5) * 1600.0,
            (b - 0.5) * 1600.0,
            (c - 0.5) * 1600.0
        );
        vel = vec3(0.0);
        life = 0.5 + d * 1.5;
    }

    pos += vel * u_dt;

    gl_FragColor = vec4(pos, life);
}
`;

export const computeVelocityFrag = `
uniform float u_dt;
uniform float u_damping;
uniform float u_springK;
uniform float u_curlStrength;
uniform float u_state;
uniform float u_time;
uniform float u_maxVel;
uniform float u_vortexStrength;
uniform vec3 u_vortexCenter;
uniform vec3 u_mousePos;
uniform float u_mouseStrength;

uniform sampler2D velocityTexture;
uniform sampler2D targetTexture;
uniform sampler2D scatterTexture;

vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float nx_p = sin((p.y + e) * 0.12 + u_time * 0.15) * cos((p.z + e) * 0.08 + u_time * 0.1);
    float nx_m = sin((p.y - e) * 0.12 + u_time * 0.15) * cos((p.z - e) * 0.08 + u_time * 0.1);
    float ny_p = sin((p.z + e) * 0.10 + u_time * 0.12) * cos((p.x + e) * 0.10 + u_time * 0.08);
    float ny_m = sin((p.z - e) * 0.10 + u_time * 0.12) * cos((p.x - e) * 0.10 + u_time * 0.08);
    float nz_p = sin((p.x + e) * 0.08 + u_time * 0.10) * cos((p.y + e) * 0.12 + u_time * 0.06);
    float nz_m = sin((p.x - e) * 0.08 + u_time * 0.10) * cos((p.y - e) * 0.12 + u_time * 0.06);

    float dnx_dy = (nx_p - nx_m) / (2.0 * e);
    float dnx_dz = dnx_dy;
    float dny_dz = (ny_p - ny_m) / (2.0 * e);
    float dny_dx = dny_dz;
    float dnz_dx = (nz_p - nz_m) / (2.0 * e);
    float dnz_dy = dnz_dx;

    return vec3(dnz_dy - dny_dz, dnx_dz - dnz_dx, dny_dx - dnx_dy);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec3 vel     = texture2D(velocityTexture, uv).xyz;
    vec4 posLife = texture2D(positionTexture, uv);
    vec3 pos     = posLife.xyz;
    vec3 target  = texture2D(targetTexture, uv).xyz;
    vec3 scatter = texture2D(scatterTexture, uv).xyz;

    vec3 goal = mix(target, scatter, u_state);

    vec3 spring = (goal - pos) * u_springK;
    vel += spring * u_dt;

    vel *= clamp(u_damping, 0.9, 1.0);

    vec3 curl = curlNoise(pos) * u_curlStrength;
    vel += curl * u_dt;

    if (abs(u_vortexStrength) > 0.001) {
        vec3 toCenter = u_vortexCenter - pos;
        float dist = length(toCenter);
        if (dist > 1.0) {
            vec3 radial = normalize(toCenter);
            vec3 up = vec3(0.0, 1.0, 0.0);
            vec3 tangent = cross(up, radial);
            float tangentLen = length(tangent);
            if (tangentLen < 0.001) {
                tangent = cross(vec3(1.0, 0.0, 0.0), radial);
                tangentLen = length(tangent);
            }
            tangent = tangent / max(tangentLen, 0.001);
            vec3 spiral = tangent * u_vortexStrength + radial * u_vortexStrength * 0.5;
            vel += spiral * u_dt;
        }
    }

    if (abs(u_mouseStrength) > 0.001) {
        vec3 toMouse = pos - u_mousePos;
        float mouseDist = length(toMouse);
        if (mouseDist > 1.0 && mouseDist < 300.0) {
            vec3 mouseForce = normalize(toMouse) * u_mouseStrength / (mouseDist * 0.1 + 1.0);
            vel += mouseForce * u_dt;
        }
    }

    float speed = length(vel);
    if (speed > u_maxVel) {
        vel = vel / speed * u_maxVel;
    }

    gl_FragColor = vec4(vel, 1.0);
}
`;
