#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

uniform float u_user_image_aspect_ratio;

uniform sampler2D u_tex_base;
uniform sampler2D u_tex_overlay;
uniform sampler2D u_tex_user;

void main()
{
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    vec4 base = texture2D(u_tex_base, uv);

    vec4 overlay = texture2D(u_tex_overlay, uv);
    vec2 overlayUv = overlay.rg * 2.0 - 1.0;

    // assume imac aspect ratio to be 16 / 10
    float aspectRatioScale = (10.0 / 16.0) * u_user_image_aspect_ratio;

    // cover image onto screen
    if (aspectRatioScale > 1.0) {
        overlayUv.x *= 1.0 / aspectRatioScale;
    } else {
        overlayUv.y *= aspectRatioScale;
    }

    overlayUv = overlayUv * 0.5 + 0.5;

    vec4 user = texture2D(u_tex_user, overlayUv.rg);

    // gl_FragColor = vec4(uv, 0.0, 1.0);
    gl_FragColor = vec4(mix(base.rgb, user.rgb, overlay.a), 1.0);

}
