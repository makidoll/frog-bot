import * as child_process from "child_process";
import * as os from "os";
import * as stream from "stream";
import { froglog } from "../froglog";

export class Rembg {
	rembgPath = "";

	constructor() {
		this.getRembgPath()
			.then(rembgPath => {
				this.rembgPath = rembgPath;
				froglog.info("Found rembg, ready to use");
			})
			.catch(error => {
				froglog.error(error);
			});
	}

	private getRembgPath(): Promise<string> {
		return new Promise((resolve, reject) => {
			const which = os.platform() == "win32" ? "where" : "which";

			child_process.exec(
				`${which} rembg`,
				{},
				(error, stdout, stderr) => {
					if (error == null) {
						return resolve(stdout);
					}

					reject("Failed to find rembg, probably not installed");
				},
			);
		});
	}

	public rembg(
		file: Buffer,
		postProcessMask: boolean = false,
	): Promise<Buffer> {
		if (this.rembgPath == "") {
			throw new Error("Rembg not installed");
		}

		return new Promise((resolve, reject) => {
			const child = child_process.execFile(
				"rembg",
				["i", ...(postProcessMask ? ["-ppm"] : []), "-", "-"],
				{
					encoding: "buffer",
					maxBuffer: 1024 * 1024 * 32, // 32 MB
				},
				(error, stdout, stderr) => {
					if (error) {
						return reject(error);
					}

					resolve(stdout);
				},
			);

			const stdio = new stream.Readable();
			stdio.push(file);
			stdio.push(null);
			stdio.pipe(child.stdin);
		});
	}
}
