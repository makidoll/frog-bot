import * as execa from "execa";
import { Command } from "../command";
import { downloadToBuffer, getMagickPath } from "../utils";
import { SlashCommandBuilder } from "@discordjs/builders";

async function magick(
	image: Buffer,
	args: string[],
	jpg = false,
): Promise<Buffer> {
	const magick = getMagickPath("convert");
	const { stdout } = await execa(
		magick.path,
		[...magick.args, "-", ...args, jpg ? "jpg:-" : "png:-"],
		{ input: image, encoding: null },
	);
	return stdout as any;
}

// https://gist.github.com/44100hertz/ec0af5c47b4620966b732e72adad33dc

function saturate(image: Buffer) {
	return magick(image, [
		"-modulate",
		"100,150,100", // brightness, saturation, hue
	]);
}

function sharpen(image: Buffer) {
	return magick(image, ["-unsharp", "0x10", "-quality", "15"]);
}

function jpeg(image: Buffer) {
	return magick(image, ["-quality", "10"], true);
}

function contrast(image: Buffer) {
	return magick(image, ["-sigmoidal-contrast", "3x50%", "-quality", "15"]);
}

function scale(image: Buffer, percentage: number) {
	return magick(image, ["-resize", percentage + "x" + percentage + "%"]);
}

export const DeepfryCommand: Command = {
	command: new SlashCommandBuilder()
		.setName("deepfry")
		.setDescription("🍟 do you ever just make image")
		.addAttachmentOption(option =>
			option
				.setName("image")
				.setDescription("image to freepfry")
				.setRequired(true),
		),
	onInteraction: async interaction => {
		const attachment = interaction.options.getAttachment("image", true);

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

			let outputBuffer = inputBuffer;

			outputBuffer = await saturate(outputBuffer);
			outputBuffer = await sharpen(outputBuffer);
			outputBuffer = await jpeg(outputBuffer);

			outputBuffer = await contrast(outputBuffer);
			outputBuffer = await saturate(outputBuffer);
			outputBuffer = await sharpen(outputBuffer);
			outputBuffer = await sharpen(outputBuffer);
			outputBuffer = await jpeg(outputBuffer);

			outputBuffer = await scale(outputBuffer, 50);
			outputBuffer = await scale(outputBuffer, 200);
			outputBuffer = await jpeg(outputBuffer);

			await interaction.editReply({
				files: [outputBuffer],
			});
		} catch (error) {
			interaction.editReply("aw ribbit... it failed sorry :(");
			console.error(error);
		}
	},
};
