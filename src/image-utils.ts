import * as execa from "execa";
import * as fs from "fs/promises";
import * as os from "os";
import { Writable } from "stream";
import * as tmp from "tmp-promise";
import { ToolName, ToolsManager, which } from "./tools-manager";

export async function getMagickPath(tool: string) {
	// windows: magick convert ...
	// linux: convert ...
	// macos: convert ...

	const magickPath = await ToolsManager.instance.getPath(ToolName.magick);

	// TODO: tools manager should really do this
	return os.platform() == "win32"
		? { path: magickPath, args: [tool] }
		: { path: await which(tool), args: [] };
}

export async function magick(
	image: Buffer,
	command: string,
	args: string[],
): Promise<Buffer> {
	const magick = await getMagickPath(command);
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
	const magick = await getMagickPath("identify");
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

	await execa(await ToolsManager.instance.getPath(ToolName.gifski), [
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

export async function rembg(
	file: Buffer,
	postProcessMask: boolean = false,
): Promise<Buffer> {
	const { stdout } = await execa(
		await ToolsManager.instance.getPath(ToolName.rembg),
		["i", ...(postProcessMask ? ["-ppm"] : []), "-", "-"],
		{
			input: file,
			encoding: null,
			maxBuffer: 1024 * 1024 * 32, // 32 MB
		},
	);

	return stdout as any;
}

export interface LayerImage {
	buffer: Buffer;
	width: number;
	height: number;
	x: number;
	y: number;
}

export async function layerImages(
	width: number,
	height: number,
	layers: LayerImage[],
): Promise<Buffer> {
	const magick = await getMagickPath("convert");

	// magick -size 100x100 xc:skyblue \
	// balloon.gif  -geometry  +5+10  -composite \
	// medical.gif  -geometry +35+30  -composite \
	// present.gif  -geometry +62+50  -composite \
	// shading.gif  -geometry +10+55  -composite \
	// compose.gif

	// pipe index starts at 3

	const subprocess = execa(
		magick.path,
		[
			...magick.args,
			// define size
			"-size",
			width + "x" + height,
			"xc:none",
			// images
			...layers
				.map((layer, i) => [
					"fd:" + (i + 3),
					"-geometry",
					layer.width +
						"x" +
						layer.height +
						"+" +
						layer.x +
						"+" +
						layer.y,
					"-composite",
				])
				.flat(),
			// output to png
			"png:-",
		],
		{
			stdio: [
				"pipe", // stdin
				"pipe", // stdout
				"pipe", // stderr
				...new Array(layers.length).fill(null).map(() => "pipe"),
			] as "pipe"[],
			encoding: null,
		},
	);

	for (let i = 0; i < layers.length; i++) {
		(subprocess.stdio[i + 3] as Writable).write(layers[i].buffer);
	}

	for (let i = 0; i < layers.length; i++) {
		(subprocess.stdio[i + 3] as Writable).end();
	}

	return (await subprocess.finally()).stdout as any;
}
