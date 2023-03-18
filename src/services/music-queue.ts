import {
	AudioPlayer,
	AudioPlayerStatus,
	AudioResource,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	NoSubscriberBehavior,
	StreamType,
	VoiceConnection,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import { VoiceBasedChannel } from "discord.js";
import * as execa from "execa";
import { FFmpeg } from "prism-media";
import { ToolName, ToolsManager } from "../tools-manager";

export class MusicQueue {
	voiceConnections: { [channelId: string]: VoiceConnection } = {};
	audioPlayers: { [channelId: string]: AudioPlayer } = {};
	audioQueue: { [channelId: string]: AudioResource[] } = {};

	constructor() {}

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

		const { stdout } = await execa(
			await ToolsManager.instance.getPath(ToolName.yt_dlp),
			args,
		);

		// fs.writeFile("info.json", stdout);

		const {
			title,
			url,
			duration_string,
			// thumbnail,
			// uploader,
			// uploader_url,
			webpage_url,
		} = JSON.parse(stdout);

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

	urlToFfmpegStream(url: string) {
		// https://github.com/skick1234/DisTube/blob/stable/src/core/DisTubeStream.ts

		const args = [
			// fixes youtube links from stopping
			"-reconnect",
			"1",
			"-reconnect_streamed",
			"1",
			"-reconnect_delay_max",
			"5",
			// input
			"-i",
			url,
			// https://github.com/discordjs/voice/blob/main/src/audio/TransformerGraph.ts
			"-analyzeduration",
			"0",
			"-loglevel",
			"0",
			"-ar",
			"48000",
			"-ac",
			"2",
			// format
			"-f",
			"opus",
			"-acodec",
			"libopus",
		];

		const stream = new FFmpeg({ args, shell: false });

		// potentially fixes buffer memory issues
		(stream as any)._readableState &&
			((stream as any)._readableState.highWaterMark = 1 << 25);

		return stream;
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
		if (this.voiceConnections[channel.id] != null) {
			this.voiceConnections[channel.id].removeAllListeners();
			this.voiceConnections[channel.id].disconnect();
			this.voiceConnections[channel.id] = null;
		}

		if (this.audioPlayers[channel.id] != null) {
			this.audioPlayers[channel.id].removeAllListeners();
			this.audioPlayers[channel.id].stop(); // not necessary
			this.audioPlayers[channel.id] = null;
		}

		this.audioQueue[channel.id] = null;
	}

	async addToQueue(channel: VoiceBasedChannel, url: string, title: string) {
		const connection = await this.ensureConnection(channel);
		const player = await this.ensurePlayer(channel, connection);

		const audioResource = createAudioResource(this.urlToFfmpegStream(url), {
			inputType: StreamType.OggOpus,
			inlineVolume: true, // still works with ffmpeg stream
			metadata: { title },
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
