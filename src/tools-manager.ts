import axios from "axios";
import * as execa from "execa";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { froglog } from "./froglog";

interface ToolInfo {
	getLatestVersionAndDownloadUrl?: () => Promise<{
		latestVersion: string;
		latestDownloadUrl: string;
	}>;
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

async function githubGetLatestVersionAndDownloadUrl(
	repo: string,
	filename: string,
) {
	const releases = await axios(
		"https://api.github.com/repos/" + repo + "/releases/latest",
	);

	const latestVersion = releases.data.tag_name;

	const latestDownloadUrl =
		"https://github.com/" +
		repo +
		"/releases/download/" +
		latestVersion +
		"/" +
		filename;

	return { latestVersion, latestDownloadUrl };
}

export async function which(name: string) {
	try {
		const { stdout } = await execa(
			osPlatform == "win32" ? "where" : "which",
			[name],
		);
		return stdout;
	} catch (error) {
		return null;
	}
}

export class ToolsManager {
	tools: { [key in ToolName]: ToolInfo } = {
		[ToolName.yt_dlp]: {
			getLatestVersionAndDownloadUrl: () =>
				githubGetLatestVersionAndDownloadUrl(
					"yt-dlp/yt-dlp",
					osSwitch({
						linux: "yt-dlp",
						windows: "yt-dlp.exe",
						macos: "yt-dlp_macos",
					}),
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
						linux: "debian/gifski.exe",
						windows: "windows/gifski.exe",
						macos: "macos/gifski.exe",
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

	private getInstalledVersionPath(name: ToolName) {
		return path.resolve(this.getToolsPath(), name + ".txt");
	}

	private async getInstalledVersion(name: ToolName) {
		try {
			const version = await fs.readFile(
				this.getInstalledVersionPath(name),
				{ encoding: "utf-8" },
			);
			return version;
		} catch (error) {
			return null;
		}
	}

	private getPathToInstallTo(name: ToolName) {
		return path.resolve(this.getToolsPath(), name + osExt);
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
			if (toolInfo.getLatestVersionAndDownloadUrl == null) {
				froglog.error(
					`Tool "${name}" missing download function for installation`,
				);
				continue;
			}

			const installedVersion = await this.getInstalledVersion(name);

			const { latestVersion, latestDownloadUrl } =
				await toolInfo.getLatestVersionAndDownloadUrl();

			if (latestVersion != installedVersion) {
				froglog.info(
					`Updating "${name}" to latest "${latestVersion}"...`,
				);

				const toolRequest = await axios({
					url: latestDownloadUrl,
					responseType: "arraybuffer",
				});

				const installPath = this.getPathToInstallTo(name);
				await fs.writeFile(installPath, toolRequest.data);

				await fs.writeFile(
					this.getInstalledVersionPath(name),
					latestVersion,
				);

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
