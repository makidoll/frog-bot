import { InferenceSession, Tensor } from "onnxruntime-node";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import * as sharp from "sharp";
import * as util from "util";
import * as stream from "stream";
import axios from "axios";

const pipeline = util.promisify(stream.pipeline);

function getMax(buffer: Buffer): number {
	let max = 0;
	for (let i = 0; i < buffer.length; i++) {
		if (buffer[i] > max) max = buffer[i];
	}
	return max;
}

function concatFloat32Array(arrays: Float32Array[]): Float32Array {
	let length = 0;
	for (const array of arrays) length += array.length;

	const output = new Float32Array(length);

	let outputIndex = 0;
	for (const array of arrays) {
		for (let n of array) {
			output[outputIndex] = n;
			outputIndex++;
		}
	}

	return output;
}

async function removeBg(pathToModel: string, sharpInput: sharp.Sharp) {
	// https://github.com/danielgatis/rembg/blob/9839adca961369e18f52e655d8a475acf07e7741/rembg/session_simple.py#L15
	// https://github.com/danielgatis/rembg/blob/9839adca961369e18f52e655d8a475acf07e7741/rembg/session_base.py#L14

	const imageSize = 320;
	const { width, height } = await sharpInput.metadata();

	// 0 to 255
	let inputPixels = await sharpInput
		.clone()
		.resize(imageSize, imageSize, { kernel: "lanczos3", fit: "fill" })
		.removeAlpha()
		.raw()
		.toBuffer();

	const inputChannels = [
		new Float32Array(imageSize * imageSize),
		new Float32Array(imageSize * imageSize),
		new Float32Array(imageSize * imageSize),
	];

	const max = getMax(inputPixels);
	const mean = [0.485, 0.456, 0.406];
	const std = [0.229, 0.224, 0.225];

	for (let i = 0; i < inputPixels.length; i++) {
		const channel = i % 3;
		const channelIndex = Math.floor(i / 3);
		inputChannels[channel][channelIndex] =
			(inputPixels[i] / max - mean[channel]) / std[channel];
	}

	const input = concatFloat32Array([
		inputChannels[2],
		inputChannels[0],
		inputChannels[1],
	]);

	const session = await InferenceSession.create(pathToModel);

	const results = await session.run({
		"input.1": new Tensor("float32", input, [1, 3, 320, 320]),
	});

	const mostPreciseOutputName = String(
		Math.min(...session.outputNames.map(name => +name)),
	);

	const maskData = results[mostPreciseOutputName].data as Float32Array;

	for (let i = 0; i < maskData.length; i++) {
		maskData[i] = maskData[i] * 255;
	}

	// will make [rgb rgb rgb] unfortunately
	const sharpMask = await sharp(maskData, {
		raw: { channels: 1, width: imageSize, height: imageSize },
	})
		.resize(width, height, { fit: "fill" })
		.raw()
		.toBuffer();

	// https://github.com/danielgatis/rembg/blob/main/rembg/bg.py#L43
	// my implementation isn't correct but it will do for now

	// const foregroundThreshold = 240;
	// const backgroundThreshold = 10;
	const foregroundThreshold = 196;

	const finalPixels = await sharpInput
		.clone()
		.ensureAlpha()
		.raw({})
		.toBuffer();

	for (let i = 0; i < finalPixels.length / 4; i++) {
		let alpha = sharpMask[i * 3];
		if (alpha < foregroundThreshold) alpha = 0;
		finalPixels[i * 4 + 3] = alpha;
	}

	return sharp(finalPixels, {
		raw: { channels: 4, width, height },
	});
}

function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
	return new Promise((resolve, reject) => {
		const data = [];
		stream.on("data", chunk => {
			data.push(chunk);
		});
		stream.on("end", () => {
			resolve(Buffer.concat(data).toString("utf8"));
		});
		stream.on("error", error => {
			reject(error);
		});
	});
}

// super primitive lol but works (for now)
async function gdown(id: string, savePath: string) {
	const url = "https://drive.google.com/uc?id=" + id;

	const res = await axios({ url, responseType: "stream" });

	const downloadable = res.headers["content-disposition"] != null;

	let fh: fs.FileHandle;
	try {
		if (downloadable) {
			fh = await fs.open(savePath, "w+");
			await pipeline(res.data, fh.createWriteStream());
		} else {
			// aa fuck intermediary page
			const html = await streamToString(res.data);

			const urlMatches = html.match(/action="([^]+?\/uc\?id=[^]+?)"/i);
			if (urlMatches == null)
				throw new Error("Failed to download gdrive link");

			const actualRes = await axios({
				method: "post",
				url: urlMatches[1].replace(/&amp;/g, "&"),
				responseType: "stream",
			});

			const actualDownloadable =
				actualRes.headers["content-disposition"] != null;

			if (!actualDownloadable)
				throw new Error("Failed to download gdrive link");

			fh = await fs.open(savePath, "w+");
			await pipeline(actualRes.data, fh.createWriteStream());
		}
	} finally {
		if (fh) fh.close();
	}
}

const exists = async (path: string) =>
	(await fs.stat(path).catch(() => {})) != null;

export class RemoveBg {
	private readonly u2netHome =
		process.env["U2NET_HOME"] ?? path.resolve(os.homedir(), ".u2net");

	readonly modelPath = path.resolve(this.u2netHome, "u2net.onnx");

	modelDownloaded = false;

	constructor() {
		this.ensureModelDownloaded();
	}

	private async ensureModelDownloaded() {
		// https://github.com/danielgatis/rembg/blob/9839adca961369e18f52e655d8a475acf07e7741/rembg/session_factory.py#L23

		if (await exists(this.modelPath)) {
			console.log("U2-Net model found!");
			this.modelDownloaded = true;
		} else {
			console.log("U2-Net model downloading...");
			if (!(await exists(this.u2netHome))) await fs.mkdir(this.u2netHome);
			await gdown("1tCU5MM1LhRgGou5OpmpjBQbSrYIUoYab", this.modelPath);
			console.log("U2-Net model downloaded!");
			this.modelDownloaded = true;
		}
	}

	removeBg(sharpInput: sharp.Sharp) {
		if (this.modelDownloaded == false) {
			throw new Error("Model not downloaded yet");
		}
		return removeBg(this.modelPath, sharpInput);
	}
}
