"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelAiCommand = void 0;
const builders_1 = require("@discordjs/builders");
const axios_1 = require("axios");
const fs = require("fs/promises");
const path = require("path");
const slugify_1 = require("slugify");
const command_1 = require("../src/command");
const utils_1 = require("../src/utils");
const date_fns_1 = require("date-fns");
const froglog_1 = require("../src/froglog");
const novelAiSavedPath = path.resolve(__dirname, "../../novelai-saved/");
fs.mkdir(novelAiSavedPath).catch(() => { });
exports.NovelAiCommand = {
    category: command_1.Categories.other,
    command: new builders_1.SlashCommandBuilder()
        .setName("novelai")
        .setDescription("🍣 generate anime images from text using ai")
        .addStringOption(option => option
        .setName("prompt")
        .setDescription("what to tell the ai to make")
        .setRequired(true))
        .addStringOption(option => option
        .setName("resolution")
        .setDescription("which resolution to generate")
        .setRequired(false)
        .addChoices({ name: "more horizontal (768 x 512)", value: "768x512" }, { name: "horizontal (640 x 512)", value: "640x512" }, { name: "square (512 x 512)", value: "512x512" }, { name: "vertical (512 x 640)", value: "512x640" }, { name: "more vertical (512 x 768)", value: "512x768" })),
    onInteraction: async (interaction, { htmlRenderer, stableDiffusionQueue: novelAiQueue }) => {
        const serverName = "maki's server, novel ai leak fp32";
        const timePerBatch = 15; // seconds, on a 3090 ti
        const steps = 50;
        const prompt = interaction.options.getString("prompt", true);
        const resolution = interaction.options.getString("resolution", false) ?? "512x768";
        const width = Number(resolution.split("x")[0]);
        const height = Number(resolution.split("x")[1]);
        const apiEndpoint = "http://192.168.1.10:7860";
        // const apiEndpoint = "http://100.74.145.116:7860";
        const stableDiffusionTask = async () => {
            try {
                await (0, axios_1.default)({
                    method: "post",
                    url: apiEndpoint + "/sdapi/v1/options",
                    timeout: 1000 * 60 * 3,
                    data: {
                        sd_model_checkpoint: "nai-animefull-final-pruned.ckpt [925997e9]",
                        CLIP_stop_at_last_layers: 2,
                        eta_noise_seed_delta: 31337,
                        sd_hypernetwork: "anime(1145414c)",
                    },
                });
                const res = await (0, axios_1.default)({
                    method: "post",
                    url: apiEndpoint + "/sdapi/v1/txt2img",
                    timeout: 1000 * 60 * 1,
                    data: {
                        negative_prompt: "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
                        prompt: "Masterpiece, best quality, " + prompt,
                        width,
                        height,
                        steps,
                        cfg_scale: 12,
                        n_iter: 1,
                        batch_size: 3,
                    },
                });
                const images = res.data.images.map((b64) => "data:image/png;base64," + b64);
                const unsafe = new Array(images.length)
                    .fill(null)
                    .map(() => false);
                const buffer = await htmlRenderer.renderHtml("file://" +
                    path.resolve(__dirname, "../../../assets/novelai.html"), async (page) => {
                    await page.setViewportSize({
                        width: width * 3,
                        height: height + 128,
                    });
                    await page.evaluate("addImages(" +
                        JSON.stringify(prompt) +
                        "," +
                        JSON.stringify(images) +
                        "," +
                        JSON.stringify(unsafe) +
                        "," +
                        JSON.stringify(width) +
                        "," +
                        JSON.stringify(height) +
                        ")");
                    await new Promise(resolve => {
                        setTimeout(resolve, 1000);
                    });
                });
                const filePath = path.resolve(novelAiSavedPath, (0, slugify_1.default)(prompt) +
                    "-" +
                    Math.floor(Date.now() / 1000) +
                    ".png");
                // dont await
                fs.writeFile(filePath, buffer);
                await interaction.followUp({
                    content: "ribbit!",
                    files: [
                        {
                            attachment: buffer,
                            name: "novelai.png",
                        },
                    ],
                });
            }
            catch (error) {
                const apiError = error?.response?.data?.error;
                // otherwise we're editing or following up way too fast
                await new Promise(resolve => setTimeout(() => {
                    resolve(null);
                }, 1000));
                interaction.followUp("aw ribbit... sorry there was an error :(");
                froglog_1.froglog.error(error);
            }
        };
        const queue = novelAiQueue.queueTask(stableDiffusionTask) + 1;
        const date = Date.now();
        const waitMs = timePerBatch * queue * 1000;
        await interaction.reply('ribbit! generating images for **"' +
            prompt +
            '"...**\nmight take **' +
            // plural(waitMinutes, "minute", "minutes") +
            (0, date_fns_1.formatDistance)(date + waitMs, date, { includeSeconds: true }) +
            ", " +
            (0, utils_1.stNdRdTh)(queue) +
            " in queue**\n*using: " +
            serverName +
            "*");
    },
};
