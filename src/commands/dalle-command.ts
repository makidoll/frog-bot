import axios from "axios";
import { Message } from "discord.js";
import { HtmlRenderer } from "../html-renderer";
import * as path from "path";
import axiosRetry from "axios-retry";
import { Command } from "../command";

axiosRetry(axios, { retries: 6 });

export const DalleCommand: Command = {
	command: "dalle",
	shortCommand: "falle",
	help: {
		arguments: "<prompt>",
		description: "🎨 generate 9 images from text using ai",
	},
	onMessage: async (
		prompt: string,
		message: Message,
		htmlRenderer: HtmlRenderer,
	) => {
		message.channel.send(
			"ribbit! generating images... might take up to 2 minutes",
		);

		try {
			const res = await axios({
				method: "post",
				url: "https://bf.dallemini.ai/generate",
				timeout: 1000 * 60 * 5, // 5 minutes
				data: { prompt },
			});

			const buffer = await htmlRenderer.renderHtml(
				"file://" +
					path.resolve(__dirname, "../../assets/dalle-mini.html"),
				async page => {
					await page.evaluate(
						"addImages(" + JSON.stringify(res.data.images) + ")",
					);
					await page.setViewport({
						width: 256 * 3,
						height: 256 * 3,
					});
				},
			);

			message.channel.send({
				content: 'here is "' + prompt + '"',
				files: [buffer],
			});
		} catch (error) {
			message.channel.send("aw ribbit... sorry there was an error :(");
			console.error(error);
		}
	},
};
