import { SlashCommandBuilder } from "@discordjs/builders";
import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import slugify from "slugify";
import { Categories, Command } from "../command";
import { plural, stNdRdTh } from "../utils";
import { formatDistance } from "date-fns";

const novelAiSavedPath = path.resolve(__dirname, "../../novelai-saved/");

fs.mkdir(novelAiSavedPath).catch(() => {});

export const NovelAiCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("novelai")
		.setDescription("⛩️ generate anime images from text using ai")
		.addStringOption(option =>
			option
				.setName("prompt")
				.setDescription("what to tell the ai to make")
				.setRequired(true),
		)
		.addStringOption(option =>
			option
				.setName("resolution")
				.setDescription("which resolution to generate")
				.setRequired(false)
				.addChoices(
					{ name: "more horizontal (768 x 512)", value: "768x512" },
					{ name: "horizontal (640 x 512)", value: "640x512" },
					{ name: "square (512 x 512)", value: "512x512" },
					{ name: "vertical (512 x 640)", value: "512x640" },
					{ name: "more vertical (512 x 768)", value: "512x768" },
				),
		),
	onInteraction: async (
		interaction,
		{ htmlRenderer, stableDiffusionQueue: novelAiQueue },
	) => {
		const serverName = "maki's server, novel ai leak fp32";

		// const timePerImage = 4; // seconds
		// const numberOfImages = 3;
		const timePerBatch = 7; // seconds, on a 3090 ti

		const prompt = interaction.options.getString("prompt", true);
		const resolution =
			interaction.options.getString("resolution", false) ?? "512x768";

		const width = Number(resolution.split("x")[0]);
		const height = Number(resolution.split("x")[1]);

		const apiEndpoint = "http://192.168.1.10:7860";
		// const apiEndpoint = "http://100.74.145.116:7860";

		const stableDiffusionTask = async () => {
			try {
				await axios({
					method: "post",
					url: apiEndpoint + "/sdapi/v1/options",
					timeout: 1000 * 60 * 3, // 3 minutes
					data: {
						sd_model_checkpoint:
							"nai-animefull-final-pruned.ckpt [925997e9]",
						CLIP_stop_at_last_layers: 2,
						eta_noise_seed_delta: 31337,
					},
				});

				const res = await axios({
					method: "post",
					url: apiEndpoint + "/sdapi/v1/txt2img",
					timeout: 1000 * 60 * 1, // 1 minute
					data: {
						negative_prompt:
							"lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
						prompt: "Masterpiece, best quality, " + prompt,
						width,
						height,
						steps: 20,
						cfg_scale: 12,
						n_iter: 1,
						batch_size: 3,
					},
				});

				const images = res.data.images.map(
					(b64: string) => "data:image/png;base64," + b64,
				);

				const unsafe = new Array(images.length)
					.fill(null)
					.map(() => false);

				const buffer = await htmlRenderer.renderHtml(
					"file://" +
						path.resolve(__dirname, "../../assets/novelai.html"),
					async page => {
						await page.setViewportSize({
							width: width * 3,
							height: height + 128,
						});
						await page.evaluate(
							"addImages(" +
								JSON.stringify(prompt) +
								"," +
								JSON.stringify(images) +
								"," +
								JSON.stringify(unsafe) +
								"," +
								JSON.stringify(width) +
								"," +
								JSON.stringify(height) +
								")",
						);
						await new Promise(resolve => {
							setTimeout(resolve, 1000);
						});
					},
				);

				const filePath = path.resolve(
					novelAiSavedPath,
					slugify(prompt) +
						"-" +
						Math.floor(Date.now() / 1000) +
						".png",
				);

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
			} catch (error) {
				const apiError = error?.response?.data?.error;

				// otherwise we're editing or following up way too fast
				await new Promise(resolve =>
					setTimeout(() => {
						resolve(null);
					}, 1000),
				);

				interaction.followUp(
					"aw ribbit... sorry there was an error :(",
				);

				console.error(error);
			}
		};

		const queue = novelAiQueue.queueTask(stableDiffusionTask) + 1;

		const date = Date.now();
		const waitMs = timePerBatch * queue * 1000;

		await interaction.reply(
			'ribbit! generating images for **"' +
				prompt +
				'"...**\nmight take **' +
				// plural(waitMinutes, "minute", "minutes") +
				formatDistance(date + waitMs, date, { includeSeconds: true }) +
				", " +
				stNdRdTh(queue) +
				" in queue**\n*using: " +
				serverName +
				"*",
		);
	},
};
