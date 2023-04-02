import {
	AudioPlayer,
	AudioPlayerState,
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
import * as path from "path";
import { FFmpeg } from "prism-media";
import { ToolName, ToolsManager } from "../tools-manager";

interface Queue {
	current: AudioResource;
	resources: AudioResource[];
	looping: boolean;
	skipping: boolean;
}

export class MusicQueue {
	private static _instance: MusicQueue;

	public static get instance(): MusicQueue {
		if (!MusicQueue._instance) {
			MusicQueue._instance = new MusicQueue();
		}
		return MusicQueue._instance;
	}

	private constructor() {}

	private voiceConnections: { [channelId: string]: VoiceConnection } = {};
	private audioPlayers: { [channelId: string]: AudioPlayer } = {};

	private audioQueue: { [channelId: string]: Queue } = {};

	async init() {}

	async getInfo(search: string) {
		const isUrl = /^https?:\/\//i.test(search);

		// TODO: should probably add more extensions
		if (isUrl && /\.(?:mp4)|(?:mp3)|(?:ogg)|(?:wav)$/i.test(search)) {
			// TODO: use ffprobe for duration string?
			return {
				title: search,
				url: search,
				duration_string: "unknown",
				webpage_url: search,
			};
		}

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

	strInputToFfmpegStream(url: string, isFile: boolean) {
		// https://github.com/skick1234/DisTube/blob/stable/src/core/DisTubeStream.ts

		const args = [
			// fixes youtube links from stopping
			...(isFile
				? []
				: [
						"-reconnect",
						"1",
						"-reconnect_streamed",
						"1",
						"-reconnect_delay_max",
						"5",
				  ]),
			// input
			"-i",
			url,
			// normalize audio https://superuser.com/a/323127
			// https://ffmpeg.org/ffmpeg-filters.html#dynaudnorm
			// https://ffmpeg.org/ffmpeg-filters.html#loudnorm
			// loudnorm sounds better than dynaudnorm
			"-filter:a",
			"loudnorm", // =p=0.9:s=5
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

		if (player == null) {
			player = createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Play,
				},
			});

			this.audioPlayers[channel.id] = player;
		}

		// doesn't subscribe twice, checked with .listeners.length
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

	createAudioResource(url: string, isFile: boolean, metadata = {}) {
		return createAudioResource(this.strInputToFfmpegStream(url, isFile), {
			inputType: StreamType.OggOpus,
			inlineVolume: true, // still works with ffmpeg stream
			metadata: { ...metadata, url, isFile },
		});
	}

	recreateAudioResource(audioResource: AudioResource) {
		const metadata = audioResource.metadata as any;
		const { url, isFile } = metadata;
		return this.createAudioResource(url, isFile, metadata);
	}

	getOdemonGoodbyeResource() {
		// thank you odemon <3

		const cursedChance = 0.05; // %
		let filename = "bybye_ribbit.mp3";

		if (Math.random() >= 1 - cursedChance) {
			filename = "bybye_ribbit_cursed.mp3";
		}

		return this.createAudioResource(
			path.resolve(__dirname, "../../assets/", filename),
			true,
			{ title: "frog bot goodbye", goodbye: true },
		);
	}

	stateChangeCallback(channel: VoiceBasedChannel) {
		return async (
			oldState: AudioPlayerState,
			newState: AudioPlayerState,
		) => {
			// only when song finished
			if (newState.status != AudioPlayerStatus.Idle) return;

			// lets hope this never happens
			const queue = this.audioQueue[channel.id];
			if (queue == null) this.disconnectAndCleanup(channel);

			const connection = await this.ensureConnection(channel);
			const player = await this.ensurePlayer(channel, connection);

			if (
				queue.looping &&
				queue.skipping == false &&
				// dont loop goodbye
				(queue.current.metadata as any).goodbye == null
			) {
				queue.current = this.recreateAudioResource(queue.current);
				player.play(queue.current);
			} else {
				// if we're looping this'll make sure we dont skip again
				queue.skipping = false;

				if (queue.resources.length == 0) {
					// disconnect if empty
					this.disconnectAndCleanup(channel);
				} else {
					// shift song and play
					const audioResource = queue.resources.shift();
					queue.current = audioResource;
					player.play(audioResource);
				}
			}
		};
	}

	async addToQueue(
		channel: VoiceBasedChannel,
		url: string,
		title: string,
		playOdemonGoodbye = false,
	) {
		const audioResource = this.createAudioResource(url, false, { title });
		audioResource.volume.setVolume(0.25);

		const foundQueue = this.audioQueue[channel.id];
		if (foundQueue != null) {
			// already a queue available, so add song
			// but we should add it before a found goodbye resource

			const goodbyeIndex = foundQueue.resources.findIndex(
				resource => (resource.metadata as any).goodbye,
			);

			if (goodbyeIndex == -1) {
				foundQueue.resources.push(audioResource);
			} else {
				// add right before last resource
				foundQueue.resources.splice(
					foundQueue.resources.length - 1,
					0,
					audioResource,
				);
			}

			return;
		}

		// no queue found so lets make one and immediately play

		this.audioQueue[channel.id] = {
			current: audioResource,
			resources: playOdemonGoodbye
				? [this.getOdemonGoodbyeResource()]
				: [],
			looping: false,
			skipping: false,
		};

		const connection = await this.ensureConnection(channel);
		const player = await this.ensurePlayer(channel, connection);

		player.play(audioResource);

		// listen to state change when song finishes
		// outsourced because its best we dont reference anything from here except channel

		player.on("stateChange", this.stateChangeCallback(channel));
	}

	skipCurrentSong(channel: VoiceBasedChannel) {
		if (this.audioPlayers[channel.id] == null)
			throw new Error("Player not found");

		const queue = this.audioQueue[channel.id];
		if (queue == null) throw new Error("Queue not found");

		// if we're looping, it won't know if its an intentional skip or not
		// will be set to false right after state change
		queue.skipping = true;

		this.audioPlayers[channel.id].stop(); // should run state change
	}

	toggleLoop(channel: VoiceBasedChannel) {
		const queue = this.audioQueue[channel.id];
		if (queue == null) throw new Error("Queue not found");

		// when song ends, will check in state change
		queue.looping = !queue.looping;

		return queue.looping;
	}
}
