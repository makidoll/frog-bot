import axios from "axios";
import * as path from "path";
import * as fs from "fs/promises";
import { Command } from "../command";
import { plural, stNdRdTh } from "../utils";
import { SlashCommandBuilder } from "@discordjs/builders";

export const DalleCommand: Command = {
	command: new SlashCommandBuilder()
		.setName("dalle")
		.setDescription("🎨 generate 6 images from text using ai")
		.addStringOption(option =>
			option
				.setName("prompt")
				.setDescription("what to tell the ai to make")
				.setRequired(true),
		),
	onInteraction: async (interaction, { htmlRenderer, dalleQueue }) => {
		const serverName = "maki's server, dalle mega fp32";
		const numberOfImages = 6;
		const timePerImage = 12; // seconds

		const prompt = interaction.options.getString("prompt", true);

		const dalleTask = async () => {
			try {
				const res = await axios({
					method: "post",
					url: "http://192.168.1.10:41773/dalle",
					timeout: 1000 * 60 * 5, // 5 minutes
					data: { num_images: numberOfImages, text: prompt },
				});

				const buffer = await htmlRenderer.renderHtml(
					"file://" +
						path.resolve(__dirname, "../../assets/dalle.html"),
					async page => {
						await page.setViewport({
							width: 256 * 3,
							height: 256 * 2 + 64,
						});
						await page.evaluate(
							"addImages(" +
								JSON.stringify(res.data) +
								"," +
								JSON.stringify(prompt) +
								")",
						);
						await new Promise(resolve => {
							setTimeout(resolve, 200);
						});
					},
				);

				const filePath = path.resolve(
					__dirname,
					"../../dalle-saved/",
					Date.now() + ".png",
				);

				// dont await
				fs.writeFile(filePath, buffer);

				await interaction.followUp({
					// content: 'here is **"' + prompt + '"**',
					files: [
						{
							attachment: buffer,
							name: "dalle.png",
						},
					],
				});
			} catch (error) {
				interaction.followUp(
					"aw ribbit... sorry there was an error :(",
				);
				console.error(error);
			}
		};

		const queue = dalleQueue.queueTask(dalleTask) + 1;

		const waitMinutes = (timePerImage * numberOfImages * queue) / 60;

		await interaction.reply(
			'ribbit! generating images for **"' +
				prompt +
				'"...**\nmight take up to **' +
				plural(waitMinutes, "minute", "minutes") +
				", " +
				stNdRdTh(queue) +
				" in queue**. *using: " +
				serverName +
				"*",
		);
	},
};
