// GLSL for the planet. The Earth surface, cloud deck and atmosphere are
// custom shaders so the day/night terminator, city lights, ocean glint and
// limb scattering all respond to a single sun direction.

export const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vEastW;
  void main() {
    vUv = uv;
    vec3 n = normalize(position);
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-5, 0.0, 0.0));
    vNormalW = normalize(mat3(modelMatrix) * n);
    vEastW = normalize(mat3(modelMatrix) * east);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D normalMap;
  uniform sampler2D specMap;
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float cloudOffset;
  uniform float normalStrength;
  uniform float lightsBoost;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vEastW;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 T = normalize(vEastW - N * dot(vEastW, N));
    vec3 B = cross(N, T);
    vec3 tn = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    tn.xy *= normalStrength;
    vec3 n = normalize(T * tn.x + B * tn.y + N * tn.z);

    vec3 L = normalize(sunDir);
    vec3 V = normalize(cameraPosition - vPosW);
    float ndl = dot(n, L);
    float geoNdl = dot(N, L);

    vec3 albedo = texture2D(dayMap, vUv).rgb;
    albedo = pow(albedo, vec3(2.2));           // sRGB → linear
    vec4 spec = texture2D(specMap, vUv);
    float ocean = spec.r;

    // Cloud shadows: sample the deck displaced towards the sun.
    vec2 shadowUv = vUv + vec2(cloudOffset, 0.0) - vec2(dot(L, T), dot(L, B)) * 0.0025;
    float shadow = 1.0 - texture2D(cloudMap, shadowUv).r * 0.55;

    float diffuse = max(ndl, 0.0);
    // Soft wrap across the terminator, tinted by the long path through air.
    float twilight = smoothstep(-0.18, 0.12, geoNdl);
    vec3 sunColor = mix(vec3(1.0, 0.45, 0.2), vec3(1.0, 0.97, 0.93), smoothstep(0.0, 0.35, geoNdl));
    vec3 day = albedo * sunColor * (diffuse * 2.6 * shadow + 0.012);

    // Ocean glint (Blinn-Phong with Fresnel).
    vec3 H = normalize(L + V);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float glint = pow(max(dot(N, H), 0.0), 90.0) * 2.2 + pow(max(dot(N, H), 0.0), 12.0) * 0.08;
    day += ocean * sunColor * glint * (0.35 + fres) * twilight * shadow;

    // City lights on the night side.
    vec3 lights = pow(texture2D(nightMap, vUv).rgb, vec3(2.2)) * lightsBoost;
    float night = smoothstep(0.1, -0.15, geoNdl);
    vec3 color = day * twilight + lights * night * (1.0 - texture2D(cloudMap, vUv + vec2(cloudOffset, 0.0)).r * 0.7);

    // Aerial perspective: blue haze towards the limb on the lit side.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    vec3 haze = mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.55, 0.3), 1.0 - smoothstep(0.0, 0.4, geoNdl));
    color += haze * rim * smoothstep(-0.2, 0.3, geoNdl) * 0.6;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const cloudVertex = earthVertex;

export const cloudFragment = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float cloudOffset;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(sunDir);
    vec3 V = normalize(cameraPosition - vPosW);
    float c = texture2D(cloudMap, vUv + vec2(cloudOffset, 0.0)).r;
    float ndl = dot(N, L);
    float lit = smoothstep(-0.15, 0.35, ndl);
    vec3 sunColor = mix(vec3(1.0, 0.5, 0.25), vec3(1.0), smoothstep(0.0, 0.4, ndl));
    vec3 col = sunColor * (0.02 + lit * 1.05) + vec3(0.01, 0.015, 0.03);
    float edge = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float alpha = smoothstep(0.08, 0.95, c) * (0.85 - edge * 0.35);
    gl_FragColor = vec4(col * alpha, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Rendered on the back faces of a slightly larger sphere: a cheap single-
// scattering approximation of the limb glow.
export const atmosphereFragment = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 planetCenter;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 N = normalize(vNormalW);
    // 0 at the outer edge of the shell, 1 where it meets the planet's limb.
    float glow = pow(clamp(dot(-N, V) * 3.0, 0.0, 1.0), 3.0);
    vec3 up = normalize(vPosW - planetCenter);
    float sunSide = dot(up, normalize(sunDir));
    float lit = smoothstep(-0.35, 0.35, sunSide);
    vec3 blue = vec3(0.3, 0.55, 1.0);
    vec3 dusk = vec3(1.0, 0.45, 0.2);
    vec3 col = mix(dusk, blue, smoothstep(-0.1, 0.4, sunSide));
    float forward = pow(max(dot(-V, normalize(sunDir)), 0.0), 8.0);
    float intensity = glow * (lit * 1.4 + forward * 2.0);
    gl_FragColor = vec4(col * intensity, intensity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
