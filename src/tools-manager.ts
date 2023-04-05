import axios from "axios";
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

async function githubGetToolBuffer(
	repo: string,
	filename: string,
	version: string,
): Promise<Buffer> {
	const downloadUrl =
		"https://github.com/" +
		repo +
		"/releases/download/" +
		version +
		"/" +
		filename;

	const request = await axios({
		url: downloadUrl,
		responseType: "arraybuffer",
	});

	return request.data;
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
			// TODO: could use github https://github.com/ImageOptim/gifski
			// but need to add function to unpack tar.xz file
			// which contains binaries for all platforms
			overrideInstalledPath: async () =>
				path.resolve(
					__dirname,
					"../node_modules/gifski/bin/",
					osSwitch({
						linux: "debian/gifski",
						windows: "windows/gifski.exe",
						macos: "macos/gifski",
					}),
				),
		},
		[ToolName.rembg]: {
			// python blelelele
			overrideInstalledPath: async () => which("rembg"),
		},
		[ToolName.magick]: {
			// TODO: could do the same as gifski
			// version url https://download.imagemagick.org/archive/binaries/digest.rdf
			overrideInstalledPath: async () =>
				osSwitch({
					linux: await which("convert"),
					windows: await which("magick"),
					macos: await which("convert"),
				}),
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

			const latestVersion = await toolInfo.getLatestVersion();

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

		froglog.info("Finished checking installed tools!");
	}
}
