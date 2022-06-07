import axios from "axios";
import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import * as path from "path";
import axiosRetry from "axios-retry";

axiosRetry(axios, { retries: 6 });

export async function dalleCommand(
	message: Message,
	htmlRenderer: HtmlRenderer,
) {
	const prompt = message.content.replace(/^dalle /i, "");

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
			"file://" + path.resolve(__dirname, "../assets/dalle-mini.html"),
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
}
