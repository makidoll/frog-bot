import { SlashCommandBuilder } from "@discordjs/builders";
import * as sharp from "sharp";
import { Categories, Command } from "../../command.js";
import { downloadToBuffer } from "../../utils.js";

export const RemoveBgCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("removebg")
		.setDescription("✂️ remove background using ai (u2net model)")
		.addAttachmentOption(option =>
			option
				.setName("image")
				.setDescription("image to remove background")
				.setRequired(true),
		)
		.addBooleanOption(option =>
			option
				.setName("dont-trim")
				.setDescription("you dont always want it!")
				.setRequired(false),
		),

	onInteraction: async (interaction, { rembg }) => {
		const attachment = interaction.options.getAttachment("image");
		const dontTrim = interaction.options.getBoolean("dont-trim");

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
			const inputBuffer = await downloadToBuffer(attachment.url);

			const outputSharp = await rembg.remove(sharp(inputBuffer));
			if (!dontTrim) outputSharp.trim();

			const outputBuffer = await outputSharp.png().toBuffer();

			interaction.editReply({
				content: "masking is still wip so results might be a bit off",
				files: [
					{
						attachment: outputBuffer,
						name: "output.png",
					},
				],
			});
		} catch (error) {
			interaction.editReply("aw ribbit... it failed sorry :(");
			console.error(error);
		}
	},
};
