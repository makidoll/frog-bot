#ifdef GL_ES
precision highp float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

uniform float u_mapper_aspect_ratio;

uniform sampler2D u_tex_dark;
uniform sampler2D u_tex_mapper;
uniform sampler2D u_tex_mapper2;
uniform sampler2D u_tex_neutral;

uniform sampler2D u_tex_user_left;
uniform sampler2D u_tex_user_right;

float invMix(float a, float b, float v)
{
    return (v - a) / (b - a);
}

#define DISCORD_BG vec3(0x2B, 0x2D, 0x31) / 255.0

void main()
{
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    vec2 in_mapper_uv = uv;
    in_mapper_uv.y *= u_mapper_aspect_ratio;
    in_mapper_uv.y += (1.0 - u_mapper_aspect_ratio) / 2.0;

    vec3 mapper = texture2D(u_tex_mapper, in_mapper_uv).rgb;
    vec3 mapper2 = texture2D(u_tex_mapper2, in_mapper_uv).rgb;

    float mapper2_id = mapper2.g;

    vec3 neutral = texture2D(u_tex_neutral, uv).rgb;

    if (mapper2_id < 0.25) {
        gl_FragColor = vec4(neutral, 1.0);
        return;
    }

    const float mapper_const = 16.0;
    float mapper_id = mapper.b * mapper_const;

    vec2 mapper_id_uv = vec2(mod(mapper_id, 1.0), floor(mapper_id) / mapper_const);
    vec2 mapper_uv = (mapper_id_uv) + (mapper.xy / mapper_const);
    mapper_uv.x -= (mapper_id_uv.y / mapper_const);

    vec4 user_color = vec4(0.0);

    if (mapper2_id < 0.5) {
        // mapper_uv isnt a square so lets transform it a little
        // only for left side

        mapper_uv.y = invMix(-0.1, 1.0, mapper_uv.y);

        // glsl want textures flipped
        mapper_uv.y = 1.0 - mapper_uv.y;

        user_color = texture2D(u_tex_user_left, mapper_uv);
    } else {
        // glsl want textures flipped
        mapper_uv.y = 1.0 - mapper_uv.y;

        user_color = texture2D(u_tex_user_right, mapper_uv);
    }

    // discord background when theres tranparency
    user_color.rgb = mix(DISCORD_BG, user_color.rgb, user_color.a);
    user_color.a = 1.0;

    vec3 dark = texture2D(u_tex_dark, uv).rgb;

    gl_FragColor = vec4(user_color.rgb * neutral + dark, 1.0);
}
