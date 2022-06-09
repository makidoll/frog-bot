import axios from "axios";
import { Message } from "discord.js";
import * as path from "path";
import { Command } from "../command";
import { Services } from "../services/services";
import { plural, stNdRdTh } from "../utils";

export const DalleCommand: Command = {
	command: "dalle",
	shortCommand: "fralle",
	help: {
		arguments: "<prompt>",
		description: "🎨 generate 9 images from text using ai",
	},
	onMessage: async (
		prompt: string,
		message: Message,
		{ htmlRenderer, dalleQueue }: Services,
	) => {
		const serverName = "maki's server, dalle mega fp16";
		const numberOfImages = 6;
		const timePerImage = 10; // seconds

		let workingOnItMessage: Message;

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
						path.resolve(__dirname, "../../assets/dalle-mini.html"),
					async page => {
						await page.evaluate(
							"addImages(" + JSON.stringify(res.data) + ")",
						);
						await page.setViewport({
							width: 256 * 3,
							height: 256 * 2,
						});
					},
				);

				await message.reply({
					content:
						'here is "' + prompt + '", *using: ' + serverName + "*",
					files: [buffer],
				});
			} catch (error) {
				message.reply("aw ribbit... sorry there was an error :(");
				console.error(error);
			}

			if (workingOnItMessage) {
				workingOnItMessage.delete().catch(() => {});
			}
		};

		const queue = dalleQueue.queueTask(dalleTask) + 1;

		const waitMinutes = (timePerImage * numberOfImages * queue) / 60;

		workingOnItMessage = await message.reply(
			"ribbit! generating images... might take up to **" +
				plural(waitMinutes, "minute", "minutes") +
				", " +
				stNdRdTh(queue) +
				" in queue**\n*using: " +
				serverName +
				"*",
		);
	},
};
