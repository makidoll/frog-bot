# frog bot

<img alt="frog bot" width="128" src="https://cdn.discordapp.com/avatars/977105048305807390/1f0478dd7208222a1fc140f9b032d604.png?size=512" />

## how

make sure these are system-wide installed:

-   imagemagick
-   ffmpeg
-   [rembg](https://pypi.org/project/rembg/)

these will get automatically downloaded:

-   webkit (playwright)
-   gifski
-   yt-dlp

copy `.env.sample` to `.env` and set your token

```bash
yarn
yarn build
```

run with `node dist/main.js`

or use `pm2 start ecosystem.config.js`

if you want to use your own ffmpeg installation set env `FFMPEG_BIN`
