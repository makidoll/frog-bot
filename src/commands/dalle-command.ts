import axios from "axios";
import { Message } from "discord.js";
import { HtmlRenderer } from "../html-renderer";
import * as path from "path";
import axiosRetry from "axios-retry";
import { Command } from "../command";

axiosRetry(axios, { retries: 6 });

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
		htmlRenderer: HtmlRenderer,
	) => {
		const serverName = "maki's server, dalle mega fp16";

		const workingOnIt = await message.reply(
			"ribbit! generating images... might take up to a minute, using: " +
				serverName,
		);

		try {
			const res = await axios({
				method: "post",
				// url: "https://bf.dallemini.ai/generate",
				url: "http://192.168.1.10:41773/dalle",
				timeout: 1000 * 60 * 5, // 5 minutes
				// data: { prompt },
				data: { num_images: 9, text: prompt },
			});

			const buffer = await htmlRenderer.renderHtml(
				"file://" +
					path.resolve(__dirname, "../../assets/dalle-mini.html"),
				async page => {
					await page.evaluate(
						// "addImages(" + JSON.stringify(res.data.images) + ")",
						"addImages(" + JSON.stringify(res.data) + ")",
					);
					await page.setViewport({
						width: 256 * 3,
						height: 256 * 3,
					});
				},
			);

			await message.reply({
				content: 'here is "' + prompt + '", using: ' + serverName,
				files: [buffer],
			});
		} catch (error) {
			message.reply("aw ribbit... sorry there was an error :(");
			console.error(error);
		}

		workingOnIt.delete().catch(() => {});
	},
};
