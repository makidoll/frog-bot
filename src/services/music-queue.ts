import {
	AudioPlayer,
	AudioPlayerStatus,
	AudioResource,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	NoSubscriberBehavior,
	VoiceConnection,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import axios from "axios";
import * as child_process from "child_process";
import { VoiceBasedChannel } from "discord.js";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

const ext = os.platform() == "win32" ? ".exe" : "";

export class MusicQueue {
	ytDlpPath = path.resolve(__dirname, "../../tools/yt-dlp") + ext;
	ytDlpVersion = path.resolve(__dirname, "../../tools/yt-dlp") + ".txt";

	voiceConnections: { [channelId: string]: VoiceConnection } = {};
	audioPlayers: { [channelId: string]: AudioPlayer } = {};
	audioQueue: { [channelId: string]: AudioResource[] } = {};

	constructor() {}

	private async getInstalledYtDlpVersion() {
		try {
			const version = await fs.readFile(this.ytDlpVersion, {
				encoding: "utf8",
			});
			return version;
		} catch (error) {
			return null;
		}
	}

	private async updateYtDlp(version: string) {
		console.log("Installing yt-dlp " + version + "...");

		const ytDlpUrl =
			"https://github.com/yt-dlp/yt-dlp/releases/download/" +
			version +
			"/yt-dlp" +
			ext;

		const ytDlpRequest = await axios({
			url: ytDlpUrl,
			responseType: "arraybuffer",
		});

		await fs.writeFile(this.ytDlpPath, ytDlpRequest.data);

		await fs.writeFile(this.ytDlpVersion, version);

		if (os.platform() != "win32") {
			child_process.execFile("chmod", ["+x", this.ytDlpPath]);
		}
	}

	async ensureToolsInstalled() {
		fs.mkdir(path.dirname(this.ytDlpPath), { recursive: true });

		const releases = await axios(
			"https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
		);

		const latestVersion = releases.data.tag_name;

		const installedVersion = await this.getInstalledYtDlpVersion();

		if (installedVersion != latestVersion) {
			await this.updateYtDlp(latestVersion);
			console.log("Installed latest yt-dlp!");
		} else {
			console.log("Latest yt-dlp already installed!");
		}
	}

	async getInfo(search: string) {
		const isUrl = /^https?:\/\//i.test(search);

		const isUrlWithoutHttp =
			/^youtube\.com/i.test(search) || /^youtu\.be/i.test(search);

		const args = [
			"-j",
			"-f",
			"bestaudio",
			isUrl || isUrlWithoutHttp
				? isUrlWithoutHttp
					? "https://" + search
					: search
				: "ytsearch1:" + search,
		];

		const json = await new Promise<string>((resolve, reject) => {
			child_process.execFile(
				this.ytDlpPath,
				args,
				(error, stdout, stderr) => {
					if (error) return reject(stderr);
					return resolve(stdout);
				},
			);
		});

		// fs.writeFile("info.json", json);

		const {
			title,
			url,
			duration_string,
			// thumbnail,
			// uploader,
			// uploader_url,
			webpage_url,
		} = JSON.parse(json);

		return {
			title,
			url,
			duration_string,
			// thumbnail,
			// uploader,
			// uploader_url,
			webpage_url,
		};
	}

	private async ensureConnection(
		channel: VoiceBasedChannel,
	): Promise<VoiceConnection> {
		let connection = this.voiceConnections[channel.id];

		if (
			connection == null ||
			connection.state.status == VoiceConnectionStatus.Disconnected ||
			connection.state.status == VoiceConnectionStatus.Destroyed
		) {
			connection = joinVoiceChannel({
				channelId: channel.id,
				guildId: channel.guild.id,
				adapterCreator: channel.guild.voiceAdapterCreator as any,
			});

			this.voiceConnections[channel.id] = connection;

			await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

			return connection;
		} else {
			return connection;
		}
	}

	private async ensurePlayer(
		channel: VoiceBasedChannel,
		connection: VoiceConnection,
	) {
		let player = this.audioPlayers[channel.id];

		if (player == null || !player.checkPlayable()) {
			player = createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Play,
				},
			});

			this.audioPlayers[channel.id] = player;
		}

		// hopefully won't subscribe twice?
		connection.subscribe(player);

		return player;
	}

	async disconnectAndCleanup(channel: VoiceBasedChannel) {
		if (this.voiceConnections[channel.id]) {
			this.voiceConnections[channel.id].disconnect();
			this.voiceConnections[channel.id] = null;
		}

		if (this.audioPlayers[channel.id]) {
			this.audioPlayers[channel.id].removeAllListeners();
			this.audioPlayers[channel.id].stop(); // not necessary
			this.audioPlayers[channel.id] = null;
		}

		this.audioQueue[channel.id] = null;
	}

	async addToQueue(channel: VoiceBasedChannel, url: string, title: string) {
		const connection = await this.ensureConnection(channel);
		const player = await this.ensurePlayer(channel, connection);

		const audioResource = createAudioResource(url, {
			metadata: { title },
			inlineVolume: true,
		});

		audioResource.volume.setVolume(0.25);

		if (this.audioQueue[channel.id] != null) {
			// already a queue available, so add song
			this.audioQueue[channel.id].push(audioResource);
			return;
		}

		// no queue available so lets make one and immediately play
		this.audioQueue[channel.id] = [];

		player.play(audioResource);

		player.on("stateChange", (oldState, newState) => {
			// only when song finished
			if (newState.status != AudioPlayerStatus.Idle) return;

			if (this.audioQueue[channel.id].length == 0) {
				// disconnect if empty
				this.disconnectAndCleanup(channel);
			} else {
				// shift song and play
				const audioResource = this.audioQueue[channel.id].shift();
				player.play(audioResource);
			}
		});
	}

	async skipCurrentSong(channel: VoiceBasedChannel) {
		if (this.audioPlayers[channel.id] == null) return false;
		this.audioPlayers[channel.id].stop(); // should run state change
		return true;
	}
}
