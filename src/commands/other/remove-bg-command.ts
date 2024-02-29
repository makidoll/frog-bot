import { SlashCommandBuilder } from "@discordjs/builders";
import sharp from "sharp";
import { Categories, Command } from "../../command.js";
import { froglog } from "../../froglog.js";
import { transparentBackground } from "../../image-utils.js";
import { downloadToBuffer } from "../../utils.js";

export const RemoveBgCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("remove-bg")
		.setDescription("✂️ remove background using ai (uses InSPyReNet 2022)")
		.addAttachmentOption(option =>
			option
				.setName("image")
				.setDescription("image to remove background")
				.setRequired(true),
		)
		.addBooleanOption(option =>
			option
				.setName("fast-mode")
				.setDescription(
					"fast mode which sometimes yields different results",
				)
				.setRequired(false),
		)
		.addNumberOption(option =>
			option
				.setName("threshold")
				.setDescription(
					"threshold which sometimes yields different results",
				)
				.setMinValue(0)
				.setMaxValue(1)
				.setRequired(false),
		)
		.addBooleanOption(option =>
			option
				.setName("trim")
				.setDescription("trims the pixels around the subject")
				.setRequired(false),
		),
	// .addBooleanOption(option =>
	// 	option
	// 		.setName("post-process-mask")
	// 		.setDescription("sometimes the edges are too smooth")
	// 		.setRequired(false),
	// ),
	onInteraction: async interaction => {
		const attachment = interaction.options.getAttachment("image");
		const fastMode = interaction.options.getBoolean("fast-mode");
		const threshold = interaction.options.getNumber("threshold");
		const trim = interaction.options.getBoolean("trim");

		if (attachment == null) {
			await interaction.reply("ribbit! please send an image");
			return;
		}

		// if (
		// 	attachment &&
		// 	!["image/png", "image/jpeg", "image/webp"].includes(
		// 		attachment.contentType,
		// 	)
		// ) {
		// 	interaction.reply("ribbit! png or jpg please");
		// 	return;
		// }

		await interaction.deferReply();

		// can there be no extension?
		const outputFilename = attachment.name.replace(
			/\.[^]+?$/,
			"_masked.png",
		);

		try {
			const inputBuffer = await downloadToBuffer(attachment.url);

			let outputBuffer = await transparentBackground(
				inputBuffer,
				new URL(attachment.url).pathname,
				fastMode ?? false,
				threshold, // can be null
			);

			if (trim) {
				outputBuffer = await sharp(outputBuffer)
					.trim()
					.png()
					.toBuffer();
			}

			await interaction.editReply({
				files: [
					{
						attachment: outputBuffer,
						name: outputFilename,
					},
				],
			});
		} catch (error) {
			await interaction.editReply("aw ribbit... it failed sorry :(");
			froglog.error(error);
		}
	},
};
