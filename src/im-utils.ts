import * as execa from "execa";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as tmp from "tmp-promise";

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

export async function magick(
	image: Buffer,
	command: string,
	args: string[],
): Promise<Buffer> {
	const magick = getMagickPath(command);
	const { stdout } = await execa(
		magick.path,
		[
			...magick.args,
			...(args[0] == "-size" ? [] : ["-"]), // no input
			...args,
			...(args[args.length - 1].endsWith(":-") ? [] : ["png:-"]), // other output format
		],
		{ input: image, encoding: null },
	);
	return stdout as any;
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
) {
	return magick(image, "convert", [
		"-resize",
		`${outputWidth}x${outputHeight}!`,
	]);
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

export async function liquidRescale(
	image: Buffer,
	percentage: number,
	outputWidth: number,
	outputHeight: number,
) {
	return magick(image, "convert", [
		"-liquid-rescale",
		`${percentage}x${percentage}%!`,
		"-resize",
		`${outputWidth}x${outputHeight}!`,
	]);
}

export async function circleCrop(image: Buffer) {
	const { width, height } = await getWidthHeight(image);
	return magick(image, "convert", [
		"-size",
		`${width}x${height}`,
		"xc:none",
		"-fill",
		"-",
		"-draw",
		`arc 0,0 ${width - 1},${height - 1} 0,360`,
	]);
}

export async function centerCompositeScale(
	image: Buffer,
	imageWidth: number,
	imageHeight: number,
	scaleX: number,
	scaleY: number,
) {
	return magick(image, "convert", [
		"-size",
		`${imageWidth}x${imageHeight}`,
		"xc:none",
		"-",
		"-gravity",
		"Center",
		"-geometry",
		`${imageWidth * scaleX}x${imageHeight * scaleY}+0+0!`,
		"-composite",
	]);
}
