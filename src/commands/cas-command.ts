import { Message } from "discord.js";
import { Command } from "../command.js";
import { downloadToBuffer } from "../utils.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as tmp from "tmp-promise";
import * as os from "os";
import * as execa from "execa";
import { fitBox } from "fit-box";
import { Services } from "../services/services.js";

function getMagickPath(tool: string) {
	return os.platform() == "win32"
		? { path: "magick", args: [tool] }
		: { path: tool, args: [] };
}

function getGifskiPath() {
	const platform = os.platform();
	if (platform == "win32") {
		return path.resolve(
			__dirname,
			"../../node_modules/gifski/bin/windows/gifski.exe",
		);
	} else {
		return path.resolve(
			__dirname,
			"../../node_modules/gifski/bin/debian/gifski",
		);
	}
}

async function getWidthHeight(image: Buffer) {
	const magick = getMagickPath("identify");
	const { stdout } = await execa(
		magick.path,
		[...magick.args, "-format", "%wx%h", "-"],
		{
			input: image,
		},
	);
	const [widthStr, heightStr] = stdout.split("x");
	return { width: parseInt(widthStr), height: parseInt(heightStr) };
}

async function rescale(
	image: Buffer,
	outputWidth: number,
	outputHeight: number,
): Promise<Buffer> {
	const magick = getMagickPath("convert");
	const { stdout } = await execa(
		magick.path,
		[
			...magick.args,
			"-",
			"-resize",
			`${outputWidth}x${outputHeight}!`,
			"png:-",
		],
		{ input: image, encoding: null },
	);
	return stdout as any;
}

async function liquidRescale(
	image: Buffer,
	percentage: number,
	outputWidth: number,
	outputHeight: number,
): Promise<Buffer> {
	const magick = getMagickPath("convert");
	const { stdout } = await execa(
		magick.path,
		[
			...magick.args,
			"-",
			"-liquid-rescale",
			`${percentage}x${percentage}%!`,
			"-resize",
			`${outputWidth}x${outputHeight}!`,
			"png:-",
		],
		{ input: image, encoding: null },
	);
	return stdout as any;
}

async function makeGif(frames: Buffer[], fps: number, quality: number) {
	const framePaths = await Promise.all(
		frames.map(async frame => {
			const filePath = await tmp.file({ postfix: ".png" });
			await fs.writeFile(filePath.path, frame);
			return filePath;
		}),
	);

	const outputPath = await tmp.file({ postfix: ".gif" });

	await execa(getGifskiPath(), [
		"--output",
		outputPath.path,
		"--fps",
		fps.toString(),
		"--quality",
		quality.toString(),
		"--nosort",
		...framePaths.map(p => p.path),
	]);

	const outputBuffer = await fs.readFile(outputPath.path);

	// remove all temp files

	for (const framePath of framePaths) {
		await framePath.cleanup();
	}

	outputPath.cleanup();

	// ok done

	return outputBuffer;
}

export const CasCommand: Command = {
	command: "cas",
	shortCommand: "fras",
	help: {
		arguments: "<attached image>",
		description: "🎆 makes a funny content aware scaling zoomy gif",
	},
	onMessage: async (
		argument: string,
		message: Message,
		{ htmlRenderer }: Services,
	) => {
		const attachment = message.attachments.at(0);

		if (attachment == null && !argument.startsWith("http")) {
			message.reply("ribbit! please send an image");
			return;
		}

		if (
			attachment &&
			!["image/png", "image/jpeg", "image/webp"].includes(
				attachment.contentType,
			)
		) {
			message.reply("ribbit! png or jpg please");
			return;
		}

		const workingOnItMessage = await message.reply(
			"ribbit! im working on it, please wait",
		);

		try {
			const originalInputBuffer = await downloadToBuffer(
				attachment == null ? argument : attachment.url,
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

			await message.reply({
				files: [
					{
						attachment: outputBuffer,
						name: "output.gif",
					},
				],
			});
		} catch (error) {
			message.reply("aw ribbit... it failed sorry :(");
			console.error(error);
		}

		workingOnItMessage.delete().catch(() => {});
	},
};
