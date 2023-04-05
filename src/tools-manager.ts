import axios from "axios";
import * as decompress from "decompress";
import * as decompressTarxz from "decompress-tarxz";
import * as execa from "execa";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { froglog } from "./froglog";
import { Database } from "./services/database";

interface ToolInfo {
	getLatestVersion?: () => Promise<string>;
	getToolBuffer?: (version: string) => Promise<Buffer>;
	overrideInstalledPath?: () => Promise<string>;
	available?: boolean;
}

export enum ToolName {
	yt_dlp = "yt_dlp",
	gifski = "gifski",
	rembg = "rembg",
	magick = "magick",
}

const osPlatform = os.platform();
const osExt = osPlatform == "win32" ? ".exe" : "";

const osSwitch = (dict: { linux: string; windows: string; macos: string }) =>
	dict[
		osPlatform == "win32"
			? "windows"
			: osPlatform == "darwin"
			? "macos"
			: "linux"
	];

async function githubGetLatestVersion(repo: string): Promise<string> {
	const releases = await axios(
		"https://api.github.com/repos/" + repo + "/releases/latest",
	);

	const latestVersion = releases.data.tag_name;

	return latestVersion;
}

async function downloadBuffer(url: string) {
	const request = await axios({
		url,
		responseType: "arraybuffer",
	});

	return request.data;
}

function githubGetToolBuffer(
	repo: string,
	filename: string,
	version: string,
): Promise<Buffer> {
	return downloadBuffer(
		"https://github.com/" +
			repo +
			"/releases/download/" +
			version +
			"/" +
			filename,
	);
}

export async function which(name: string) {
	try {
		const { stdout } = await execa(
			osPlatform == "win32" ? "where" : "which",
			[name],
		);
		return stdout.split("\n")[0].trim();
	} catch (error) {
		return null;
	}
}

export class ToolsManager {
	// so we dont rate limit ourselves when developing
	apiCooldownTime = 1000 * 60 * 5; // 5 minutes

	tools: { [key in ToolName]: ToolInfo } = {
		[ToolName.yt_dlp]: {
			getLatestVersion: () => githubGetLatestVersion("yt-dlp/yt-dlp"),
			getToolBuffer: version =>
				githubGetToolBuffer(
					"yt-dlp/yt-dlp",
					osSwitch({
						linux: "yt-dlp",
						windows: "yt-dlp.exe",
						macos: "yt-dlp_macos",
					}),
					version,
				),
		},
		[ToolName.gifski]: {
			getLatestVersion: () => githubGetLatestVersion("ImageOptim/gifski"),
			getToolBuffer: async version => {
				const downloadUrl = `https://github.com/ImageOptim/gifski/releases/download/${version}/gifski-${version}.tar.xz`;

				const request = await axios({
					url: downloadUrl,
					responseType: "arraybuffer",
				});

				const files = await decompress(request.data, {
					plugins: [decompressTarxz()],
				});

				const filePath = osSwitch({
					linux: "linux/gifski",
					windows: "win/gifski.exe",
					macos: "mac/gifski",
				});

				for (const file of files) {
					if (file.path == filePath) {
						return file.data;
					}
				}

				throw new Error("Failed to extract gifski");
			},
		},

		[ToolName.magick]: {
			// async getLatestVersion() {
			// 	const request = await axios(
			// 		"https://download.imagemagick.org/archive/binaries/digest.rdf",
			// 	);

			// 	const xml = await xml2js.parseStringPromise(request.data, {});
			// 	const filenames: string[] = xml["rdf:RDF"][
			// 		"digest:Content"
			// 	].map(release => release["$"]["rdf:about"]);

			// 	let majors = [];
			// 	let versions = filenames
			// 		.map(filename => {
			// 			const matches = filename.match(
			// 				/^ImageMagick-(([0-9]+)\.[0-9]+\.[0-9]+(?:-[0-9]+)?)/,
			// 			);
			// 			if (matches == null) return null;
			// 			return {
			// 				major: parseInt(matches[2]),
			// 				version: matches[1],
			// 			};
			// 		})
			// 		.filter(version => version != null)
			// 		.filter(version => {
			// 			if (!majors.includes(version.major)) {
			// 				majors.push(version.major);
			// 				return true;
			// 			}
			// 			return false;
			// 		})
			// 		.sort((a, b) => b.major - a.major);

			// 	// sorted so major is first
			// 	return versions[0].version;
			// },
			// getToolBuffer: version =>
			// 	downloadBuffer(
			// 		"https://download.imagemagick.org/archive/binaries/ImageMagick-" +
			// 			version +
			// 			osSwitch({
			// 				linux: "",
			// 				windows: "-Q16-x64-static.exe",
			// 				macos: "",
			// 			}),
			// 	),

			// bleh
			overrideInstalledPath: async () =>
				osSwitch({
					linux: await which("convert"),
					windows: await which("magick"),
					macos: await which("convert"),
				}),
		},
		[ToolName.rembg]: {
			// python blelelele
			overrideInstalledPath: async () => which("rembg"),
		},
	};

	private static _instance: ToolsManager;

	public static get instance(): ToolsManager {
		if (!ToolsManager._instance) {
			ToolsManager._instance = new ToolsManager();
		}
		return ToolsManager._instance;
	}

	private constructor() {}

	private getToolsPath() {
		return path.resolve(__dirname, "../tools/");
	}

	private getPathToInstallTo(name: ToolName) {
		return path.resolve(this.getToolsPath(), name + osExt);
	}

	private async getInstalledVersion(name: ToolName) {
		// if file not present, no version is installed

		const installedPath = this.getPathToInstallTo(name);
		try {
			await fs.stat(installedPath);
		} catch (error) {
			return null;
		}

		// fetch from database instead

		const installedTool = await Database.instance.installedTools.findOne({
			_id: name,
		});
		if (installedTool == null) return null;
		return installedTool.version;
	}

	private async setInstalledVersion(name: ToolName, version: string) {
		const updated = await Database.instance.installedTools.updateOne(
			{ _id: name },
			{ version },
		);

		if (updated == 0) {
			await Database.instance.installedTools.insertOne({
				_id: name,
				version,
			});
		}
	}

	async init() {
		// ensure tools folder exists
		fs.mkdir(this.getToolsPath(), { recursive: true });

		for (const [name, toolInfo] of Object.entries(this.tools) as [
			ToolName,
			ToolInfo,
		][]) {
			toolInfo.available = false;

			if (toolInfo.overrideInstalledPath != null) {
				const installedPath = await toolInfo.overrideInstalledPath();

				// fail if not found
				if (installedPath == null) {
					froglog.error(
						`Failed to find "${name}", perhaps it's not installed?`,
					);
					continue;
				}

				froglog.info(`Tool "${name}" was found\n  "${installedPath}"`);
				toolInfo.available = true;

				continue;
			}

			// fail if functions not found
			if (toolInfo.getLatestVersion == null) {
				froglog.error(
					`Tool "${name}" missing download function for installation`,
				);
				continue;
			}

			const installedVersion = await this.getInstalledVersion(name);

			let latestVersion = "";

			if (installedVersion == null) {
				// not installed so get latest version
				latestVersion = await toolInfo.getLatestVersion();
			} else {
				// installed but respect cooldown first so we dont api rate limit

				const lastInstalledTools =
					await Database.instance.getKeyValue<number>(
						"last-installed-tools",
					);

				if (
					lastInstalledTools == null ||
					Date.now() > lastInstalledTools + this.apiCooldownTime
				) {
					latestVersion = await toolInfo.getLatestVersion();
				} else {
					froglog.info(`Skipping "${name}" to avoid rate limit`);
					toolInfo.available = true;
					continue;
				}
			}

			if (latestVersion != installedVersion) {
				froglog.info(
					`Updating "${name}" to latest "${latestVersion}"...`,
				);

				const toolBuffer = await toolInfo.getToolBuffer(latestVersion);

				const installPath = this.getPathToInstallTo(name);
				await fs.writeFile(installPath, toolBuffer);

				await this.setInstalledVersion(name, latestVersion);

				if (osPlatform != "win32") {
					await execa("chmod", ["+x", installPath]);
				}

				froglog.info(`Successfully updated "${name}"!`);
			} else {
				froglog.info(`Tool "${name}" is latest "${latestVersion}"`);
			}

			toolInfo.available = true;
		}

		await Database.instance.setKeyValue("last-installed-tools", Date.now());

		froglog.info("Finished checking installed tools!");
	}

	getPath(name: ToolName) {
		const toolInfo = this.tools[name];

		if (toolInfo.available == false) {
			return null;
		}

		if (toolInfo.overrideInstalledPath != null) {
			return toolInfo.overrideInstalledPath();
		}

		return this.getPathToInstallTo(name);
	}
}
