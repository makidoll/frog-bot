import axios from "axios";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import * as execa from "execa";
import * as tmp from "tmp-promise";
import { ClientUser, Guild, User } from "discord.js";

export async function downloadToBuffer(url: string) {
	try {
		const req = await axios({ url, responseType: "arraybuffer" });
		return req.data;
	} catch (error) {
		return "";
	}
}
export async function downloadToDataUri(url: string) {
	try {
		const req = await axios({ url, responseType: "arraybuffer" });
		const contentType = req.headers["content-type"].split(" ")[0];
		const base64Data = req.data.toString("base64");
		return "data:" + contentType + ";base64," + base64Data;
	} catch (error) {
		return "";
	}
}

export async function getUsernameAndAvatarURL(
	user: User | ClientUser,
	guild: Guild,
) {
	const member = await guild.members.fetch({ user });
	return {
		username: member?.displayName ?? user.username,
		avatarURL: member?.displayAvatarURL() ?? user.avatarURL(),
	};
}

export function stNdRdTh(n: number) {
	const mod = n % 10;
	if (mod == 1) return n + "st";
	else if (mod == 2) return n + "nd";
	else if (mod == 3) return n + "rd";
	else return n + "th";
}

export function plural(n: number, single: string, plural) {
	if (n == 1 || n == -1) return n + " " + single;
	else return n + " " + plural;
}

export function getMagickPath(tool: string) {
	return os.platform() == "win32"
		? { path: "magick", args: [tool] }
		: { path: tool, args: [] };
}

export function getGifskiPath() {
	const platform = os.platform();
	if (platform == "win32") {
		return path.resolve(
			__dirname,
			"..//node_modules/gifski/bin/windows/gifski.exe",
		);
	} else {
		return path.resolve(
			__dirname,
			"..//node_modules/gifski/bin/debian/gifski",
		);
	}
}

export async function getWidthHeight(image: Buffer) {
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

export async function rescale(
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

export async function makeGif(frames: Buffer[], fps: number, quality: number) {
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
