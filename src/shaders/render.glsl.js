export const renderVertex = `
attribute vec2 a_uv;
attribute vec3 a_color;

uniform sampler2D u_targetTexture;
uniform sampler2D u_scatterTexture;
uniform float u_state;
uniform float u_transitionMode;
uniform float u_time;
uniform float u_pointSize;
uniform float u_visibleCount;
uniform float u_texWidth;
uniform float u_texHeight;
uniform float u_stretch;
uniform float u_noiseStrength;
uniform float u_noiseSpeed;
uniform vec3 u_modelCenter;
uniform float u_modelRadius;
uniform float u_modelMinY;
uniform float u_modelMaxY;

varying vec3 v_color;
varying float v_alpha;
varying vec2 v_vel;

vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float ns = u_time * u_noiseSpeed;
    float nx_p = sin((p.y + e) * 0.12 + ns) * cos((p.z + e) * 0.08 + ns * 0.7);
    float nx_m = sin((p.y - e) * 0.12 + ns) * cos((p.z - e) * 0.08 + ns * 0.7);
    float ny_p = sin((p.z + e) * 0.10 + ns * 0.8) * cos((p.x + e) * 0.10 + ns * 0.5);
    float ny_m = sin((p.z - e) * 0.10 + ns * 0.8) * cos((p.x - e) * 0.10 + ns * 0.5);
    float nz_p = sin((p.x + e) * 0.08 + ns * 0.7) * cos((p.y + e) * 0.12 + ns * 0.4);
    float nz_m = sin((p.x - e) * 0.08 + ns * 0.7) * cos((p.y - e) * 0.12 + ns * 0.4);
    float dnx_dy = (nx_p - nx_m) / (2.0 * e);
    float dny_dz = (ny_p - ny_m) / (2.0 * e);
    float dnz_dx = (nz_p - nz_m) / (2.0 * e);
    return vec3(dnz_dx - dny_dz, dnx_dy - dnz_dx, dny_dz - dnx_dy);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// mode: uses float, compared by integer ranges
// ordering determines WHEN each particle transitions (0=first, 1=last)
float computeOrder(vec3 targetPos, vec2 uv, float mode) {
    float d = length(targetPos - u_modelCenter) / max(u_modelRadius, 0.001);
    float yNorm = (u_modelMaxY - u_modelMinY) < 0.001 ? 0.5 :
        (targetPos.y - u_modelMinY) / (u_modelMaxY - u_modelMinY);
    float angle = (atan(targetPos.z - u_modelCenter.z, targetPos.x - u_modelCenter.x)
        + 3.14159265) / 6.2831853;
    float rng = hash(uv);
    float cluster = floor(rng * 6.0) / 6.0;

    if (mode < 0.5) return 0.5;                   // Uniform
    if (mode < 1.5) return yNorm;                  // Wave: bottom→top
    if (mode < 2.5) return clamp(d, 0.0, 1.0);     // Implode: outer→inner
    if (mode < 3.5) return 1.0 - clamp(d, 0.0, 1.0); // Radiate: inner→outer
    if (mode < 4.5) return angle;                  // Spiral: angular sweep
    if (mode < 5.5) return rng;                    // Glitch: random
    return cluster;                                 // Shatter: cluster groups
}

// Each mode has a distinct window size for different feel
float getModeWindow(float mode) {
    if (mode < 0.5) return 0.55;  // Uniform: very wide, gentle overlap
    if (mode < 1.5) return 0.35;  // Wave: clear wave front
    if (mode < 2.5) return 0.22;  // Implode: tight collapse
    if (mode < 3.5) return 0.40;  // Radiate: slow bloom outward
    if (mode < 4.5) return 0.18;  // Spiral: fast sweep
    if (mode < 5.5) return 0.06;  // Glitch: near-instant per particle
    return 0.12;                   // Shatter: quick cluster snap
}

float getEffectiveProgress(vec3 targetPos, vec2 uv, float globalProgress, float mode) {
    float order = computeOrder(targetPos, uv, mode);
    float window = getModeWindow(mode);
    float start = order * (1.0 - window);
    float end = start + window;
    float raw = (globalProgress - start) / (end - start);

    // Mode-specific easing
    float t = clamp(raw, 0.0, 1.0);
    if (mode > 4.5) {
        // Glitch/Shatter: snappy ease
        t = t * t * (3.0 - 2.0 * t);
        t = t * t;
    }
    return t;
}

void main() {
    float idx = floor(a_uv.y * u_texHeight) * u_texWidth + floor(a_uv.x * u_texWidth);
    if (idx >= u_visibleCount) {
        gl_Position = vec4(99999.0, 99999.0, 99999.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }

    vec3 targetPos = texture2D(u_targetTexture, a_uv).xyz;
    vec3 scatterPos = texture2D(u_scatterTexture, a_uv).xyz;

    float globalProgress = 1.0 - u_state;
    float mode = u_transitionMode;
    float progress = getEffectiveProgress(targetPos, a_uv, globalProgress, mode);
    vec3 pos = mix(scatterPos, targetPos, progress);

    // --- Mode-specific path effects ---

    // Implode (mode 2): radial suck + vertical compression during transition
    if (mode > 1.5 && mode < 3.5) {
        vec3 toCenter = u_modelCenter - pos;
        float d = length(toCenter);
        if (d > 0.01) {
            float suck = (1.0 - progress) * 0.4;
            if (mode > 2.5) suck *= 0.3; // Radiate: milder
            pos += normalize(toCenter) * d * suck;
            // Implode: compress vertically
            if (mode < 2.5) pos.y += (targetPos.y - pos.y) * 0.3 * (1.0 - progress);
        }
    }

    // Spiral (mode 4): strong orbital motion around Y axis
    if (mode > 3.5 && mode < 4.5) {
        vec3 toCenter = pos - u_modelCenter;
        float hDist = length(vec2(toCenter.x, toCenter.z));
        if (hDist > 0.5) {
            vec3 radial = normalize(vec3(toCenter.x, 0.0, toCenter.z));
            vec3 tangent = cross(vec3(0.0, 1.0, 0.0), radial);
            float spiralAngle = (1.0 - progress) * 6.2832 * 4.0 + hash(a_uv) * 6.2832;
            float amplitude = (1.0 - progress) * hDist * 0.35;
            pos += tangent * amplitude * sin(spiralAngle);
            pos.y += amplitude * 0.3 * cos(spiralAngle * 0.7);
        }
    }

    // Glitch (mode 5): teleport jitter
    if (mode > 4.5 && mode < 5.5 && progress < 0.98) {
        float gx = hash(a_uv + progress) - 0.5;
        float gy = hash(a_uv * 2.0 + progress) - 0.5;
        float gz = hash(a_uv * 3.0 + progress) - 0.5;
        float jitterStr = (1.0 - progress) * 80.0;
        pos += vec3(gx, gy, gz) * jitterStr;
    }

    // Shatter (mode 6): cluster group displacement
    if (mode > 5.5 && progress < 0.95) {
        float cid = floor(hash(a_uv) * 6.0);
        vec3 clusterOffset = vec3(
            sin(cid * 2.1) * 60.0,
            cos(cid * 1.7) * 40.0,
            sin(cid * 3.3 + 1.2) * 60.0
        );
        pos += clusterOffset * (1.0 - progress) * (1.0 - progress);
    }

    // --- Noise ---
    float distToTarget = length(pos - targetPos);
    float noiseScale = mix(0.08, 1.0, smoothstep(0.0, 150.0, distToTarget));

    // Glitch/Shatter: extra noise
    if (mode > 4.5 && progress < 0.95) noiseScale = mix(noiseScale, 2.0, 1.0 - progress);

    vec3 noise = curlNoise(pos * 0.1) * u_noiseStrength * noiseScale * 30.0;
    pos += noise;

    // Fake velocity for particle stretch
    vec3 fakeVel = noise * 10.0;
    // Enhance velocity for spiral/implode during transition
    if (progress > 0.01 && progress < 0.99) {
        if (mode > 1.5 && mode < 3.5) fakeVel += (targetPos - pos) * 2.0;
        if (mode > 3.5 && mode < 4.5) fakeVel *= 3.0;
    }
    v_vel = fakeVel.xy;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float speed = length(fakeVel);
    float stretch = 1.0 + speed * u_stretch * 0.05;
    gl_PointSize = u_pointSize * stretch * (300.0 / max(-mvPosition.z, 0.001));
    gl_Position = projectionMatrix * mvPosition;

    v_color = a_color;

    // Alpha: mode-dependent fade curve
    if (mode > 4.5) {
        // Glitch/Shatter: hard pop
        v_alpha = smoothstep(0.0, 0.3, progress);
    } else if (mode > 3.5 && mode < 4.5) {
        // Spiral: late bloom
        v_alpha = smoothstep(0.2, 0.6, progress);
    } else {
        // Others: smooth dissolve
        v_alpha = mix(0.4, 1.0, progress);
    }
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
