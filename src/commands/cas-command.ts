import { SlashCommandBuilder } from "@discordjs/builders";
import { fitBox } from "fit-box";
import { Command } from "../command.js";
import {
	getWidthHeight,
	liquidRescale,
	makeGif,
	rescale,
} from "../im-utils.js";
import { downloadToBuffer } from "../utils.js";

export const CasCommand: Command = {
	command: new SlashCommandBuilder()
		.setName("cas") // fras
		.setDescription("🎆 makes a funny content aware scaling zoomy gif")
		.addAttachmentOption(option =>
			option
				.setName("image")
				.setDescription("do thing with")
				.setRequired(true),
		),

	onInteraction: async interaction => {
		const attachment = interaction.options.getAttachment("image");

		// if (attachment == null && !argument.startsWith("http")) {
		if (attachment == null) {
			interaction.reply("ribbit! please send an image");
			return;
		}

		if (
			attachment &&
			!["image/png", "image/jpeg", "image/webp"].includes(
				attachment.contentType,
			)
		) {
			interaction.reply("ribbit! png or jpg please");
			return;
		}

		interaction.deferReply();

		try {
			const originalInputBuffer = await downloadToBuffer(
				// attachment == null ? argument : attachment.url,
				attachment.url,
			);

			const { width, height } = fitBox({
				boundary: { width: 400, height: 300 },
				box: await getWidthHeight(originalInputBuffer),
			});

			// downscale first or otherwise it will take forever
			const inputBuffer = await rescale(
				originalInputBuffer,
				width,
				height,
			);

			// 100 to smallest
			const smallestSize = 10;

			const frames = await Promise.all(
				new Array(100 - smallestSize + 1).fill(null).map((_, i) => {
					const percentage = 100 - i;
					return liquidRescale(
						inputBuffer,
						percentage,
						width,
						height,
					);
				}),
			);

			const outputBuffer = await makeGif(frames, 30, 80);

			interaction.editReply({
				files: [
					{
						attachment: outputBuffer,
						name: "output.gif",
					},
				],
			});
		} catch (error) {
			interaction.editReply("aw ribbit... it failed sorry :(");
			console.error(error);
		}
	},
};
