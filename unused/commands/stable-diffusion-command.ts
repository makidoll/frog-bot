import { SlashCommandBuilder } from "@discordjs/builders";
import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import slugify from "slugify";
import { Categories, Command } from "../../command";
import { froglog } from "../../froglog";
import { plural, stNdRdTh } from "../../utils";

const stableDiffusionSavedPath = path.resolve(
	__dirname,
	"../../stable-diffusion-saved/",
);

fs.mkdir(stableDiffusionSavedPath).catch(() => {});

export const StableDiffusionCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("stablediffusion")
		.setDescription("🎨 generate 3 images from text using ai")
		.addStringOption(option =>
			option
				.setName("prompt")
				.setDescription("what to tell the ai to make")
				.setRequired(true),
		)
		.addBooleanOption(option =>
			option
				.setName("ancestral")
				.setDescription("uses k_euler_a instead of k_euler")
				.setRequired(false),
		),
	onInteraction: async (
		interaction,
		{ htmlRenderer, stableDiffusionQueue },
	) => {
		const serverName = "maki's server, sd v1.4 fp32";
		const timePerImage = 4; // seconds
		const numberOfImages = 3;

		const prompt = interaction.options.getString("prompt", true);
		const ancestral = interaction.options.getBoolean("ancestral", false);

		const sampler = ancestral ? "k_euler_a" : "k_euler";

		let generatingOutsideOfDiscord = false;

		const stableDiffusionTask = async () => {
			try {
				const res = await axios({
					method: "post",
					// url: "http://maki-pc.local:5000/api/generate/oneoff",
					url: "http://192.168.1.10:57467/api/generate/oneoff",
					timeout: 1000 * 60 * 1, // 1 minute
					data: {
						prompt,
						sampler,
					},
				});

				const buffer = await htmlRenderer.renderHtml(
					"file://" +
						path.resolve(
							__dirname,
							"../../../assets/stable-diffusion.html",
						),
					async page => {
						await page.setViewportSize({
							width: 512 * 3,
							height: 512 * 1 + 128,
						});
						await page.evaluate(
							"addImages(" +
								JSON.stringify(prompt) +
								"," +
								JSON.stringify(res.data.images) +
								"," +
								JSON.stringify(res.data.unsafe) +
								")",
						);
						await new Promise(resolve => {
							setTimeout(resolve, 1000);
						});
					},
				);

				const filePath = path.resolve(
					stableDiffusionSavedPath,
					slugify(prompt) +
						"-" +
						Math.floor(Date.now() / 1000) +
						".png",
				);

				// dont await
				fs.writeFile(filePath, buffer);

				await interaction.followUp({
					content: "ribbit! using *" + sampler + "*",
					files: [
						{
							attachment: buffer,
							name: "stable-diffusion.png",
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

				if (
					typeof apiError == "string" &&
					apiError.toLowerCase().includes("busy")
				) {
					if (generatingOutsideOfDiscord == false) {
						interaction.editReply(
							'ribbit! generating images for **"' +
								prompt +
								'"...** using *' +
								sampler +
								"*\nsomeone **outside of discord is generating**, please wait. *using: " +
								serverName +
								"*",
						);
						generatingOutsideOfDiscord = true;
					}
					await new Promise(resolve =>
						setTimeout(() => {
							resolve(null);
						}, 1000 * 4),
					);
					return stableDiffusionTask();
				}

				interaction.followUp(
					"aw ribbit... sorry there was an error :(",
				);

				froglog.error(error);
			}
		};

		const queue = stableDiffusionQueue.queueTask(stableDiffusionTask) + 1;

		const waitMinutes = (timePerImage * numberOfImages * queue) / 60;

		await interaction.reply(
			'ribbit! generating images for **"' +
				prompt +
				'"...** using *' +
				sampler +
				"*\nmight take up to **" +
				plural(waitMinutes, "minute", "minutes") +
				", " +
				stNdRdTh(queue) +
				" in queue**. *using: " +
				serverName +
				"*",
		);
	},
};
