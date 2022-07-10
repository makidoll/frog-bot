import { Command } from "../command.js";
import {
	downloadToBuffer,
	makeGif,
	getMagickPath,
	getWidthHeight,
	rescale,
} from "../utils.js";
import * as execa from "execa";
import * as fs from "fs/promises";
import { fitBox } from "fit-box";
import { SlashCommandBuilder } from "@discordjs/builders";

async function centerCompositeScale(
	image: Buffer,
	imageWidth: number,
	imageHeight: number,
	scaleX: number,
	scaleY: number,
): Promise<Buffer> {
	const magick = getMagickPath("convert");
	const { stdout } = await execa(
		magick.path,
		[
			...magick.args,
			"-size",
			`${imageWidth}x${imageHeight}`,
			"xc:none",
			"-",
			"-gravity",
			"Center",
			"-geometry",
			`${imageWidth * scaleX}x${imageHeight * scaleY}+0+0!`,
			"-composite",
			"png:-",
		],
		{ input: image, encoding: null },
	);
	return stdout as any;
}

export const SquishyCommand: Command = {
	command: new SlashCommandBuilder()
		.setName("squishy")
		.setDescription("🦆 make image into squishy gif")
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
			let inputBuffer = await downloadToBuffer(
				// attachment == null ? argument : attachment.url,
				attachment.url,
			);

			let { width, height } = await getWidthHeight(inputBuffer);
			if (width > 400 || height > 300) {
				let newSize = fitBox({
					boundary: { width: 400, height: 300 },
					box: { width, height },
				});
				width = newSize.width;
				height = newSize.height;
				inputBuffer = await rescale(inputBuffer, width, height);
			}

			const squishyLength = 0.6; // seconds
			const squishyFps = 50; // highest for gif
			const squishyAmountX = 0.6; // smallest size
			const squishyAmountY = 0.6; // smallest size

			const frames = await Promise.all(
				new Array(squishyFps * squishyLength).fill(null).map((_, i) => {
					const time = i / (squishyLength * squishyFps);

					const scaleX =
						1 -
						(1 -
							(Math.sin(time * (Math.PI * 2) + Math.PI / 2) *
								0.5 +
								0.5)) *
							(1 - squishyAmountX);

					const scaleY =
						1 -
						(1 -
							(Math.cos(time * (Math.PI * 2) + Math.PI / 2) *
								0.5 +
								0.5)) *
							(1 - squishyAmountY);

					return centerCompositeScale(
						inputBuffer,
						width,
						height,
						scaleX,
						scaleY,
					);
				}),
			);

			const outputBuffer = await makeGif(frames, squishyFps, 80);

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
