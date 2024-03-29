import { SlashCommandBuilder } from "@discordjs/builders";
import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import slugify from "slugify";
import { Categories, Command } from "../src/command";
import { froglog } from "../src/froglog";
import { plural, stNdRdTh } from "../src/utils";

const dalleSavedPath = path.resolve(__dirname, "../../dalle-saved/");
fs.mkdir(dalleSavedPath).catch(() => {});

export const DalleCommand: Command = {
	category: Categories.other,
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
					dalleSavedPath,
					slugify(prompt) +
						"-" +
						Math.floor(Date.now() / 1000) +
						".png",
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
				froglog.error(error);
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
