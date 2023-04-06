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
import { Client, GuildTextBasedChannel, VoiceBasedChannel } from "discord.js";
import * as execa from "execa";
import * as path from "path";
import { FFmpeg } from "prism-media";
import { froglog } from "../froglog";
import { ToolName, ToolsManager, which } from "../tools-manager";
import { tryShortenYoutubeLink } from "../utils";
import { Database, MusicAudioQueueDocument } from "./database";

export interface AudioQueueMetadata {
	title: string;
	url: string;
	seconds: number;
	videoUrl: string;
	goodbye: boolean;
	isFile: boolean;
}

// should reflect in database.ts
interface AudioQueue {
	channel: VoiceBasedChannel;
	current: AudioResource<AudioQueueMetadata>;
	currentStarted: number; // Date.now()
	resources: AudioResource<AudioQueueMetadata>[];
	looping: boolean;
	lastTextChannel: GuildTextBasedChannel;
	// ephemeral
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

	private voiceConnections = new Map<string, VoiceConnection>();
	private audioPlayers = new Map<string, AudioPlayer>();

	private audioQueue = new Map<string, AudioQueue>();

	private pathToFfmpeg = "";
	private ffmpegExtensions: string[] = [];

	async init() {
		this.pathToFfmpeg = await which("ffmpeg");

		await this.getFfmpegExtensions();

		const reaperInterval = 1000 * 60; // every minute
		setInterval(this.reaperCallback.bind(this), reaperInterval);
	}

	private async syncToDatabase() {
		froglog.debug("Music audio queue syncing to database");

		// remove all from db that doesnt exist anymore

		const dbAllAudioQueue = await Database.instance.musicAudioQueue.find(
			{},
		);

		for (const dbAudioQueue of dbAllAudioQueue) {
			// if current audio queue doesnt have id from db, just delete from db
			if (!this.audioQueue.has(dbAudioQueue._id)) {
				await Database.instance.musicAudioQueue.removeOne(
					{ _id: dbAudioQueue._id },
					{},
				);
			}
		}

		// then either create or update current to database

		for (const [channelId, audioQueue] of this.audioQueue.entries()) {
			const document: MusicAudioQueueDocument = {
				_id: channelId,
				current: audioQueue.current.metadata,
				currentStarted: audioQueue.currentStarted,
				resources: audioQueue.resources.map(
					resource => resource.metadata as any,
				),
				looping: audioQueue.looping,
				lastTextChannel: audioQueue.lastTextChannel.id,
			};

			// doesnt error if not found
			const updated = await Database.instance.musicAudioQueue.updateOne(
				{
					_id: channelId,
				},
				document,
			);

			if (updated == 0) {
				await Database.instance.musicAudioQueue.insertOne(document);
			}
		}
	}

	async loadFromDatabase(client: Client) {
		const dbAllAudioQueue = await Database.instance.musicAudioQueue.find(
			{},
		);

		for (const dbAudioQueue of dbAllAudioQueue) {
			// if we cant find the voice channel, continue
			let channel: VoiceBasedChannel;
			try {
				channel = (await client.channels.fetch(
					dbAudioQueue._id,
				)) as VoiceBasedChannel;
			} catch (error) {}
			if (channel == null) continue;

			// for letting people know bot disconnected due to inactivity
			let textChannel: GuildTextBasedChannel; // can be null
			try {
				textChannel = (await client.channels.fetch(
					dbAudioQueue.lastTextChannel,
				)) as GuildTextBasedChannel;
			} catch (error) {}

			// TODO: will skip a bit, is this bad?
			const seekMs = Date.now() - dbAudioQueue.currentStarted;
			const seekSeconds = seekMs / 1000;

			await this.addToQueue(
				channel,
				textChannel,
				dbAudioQueue.current,
				false, // will be stored in resources
				seekSeconds,
			);

			// update queue
			const audioQueue = this.audioQueue.get(channel.id);
			audioQueue.current.metadata = dbAudioQueue.current;
			audioQueue.resources = dbAudioQueue.resources.map(metadata =>
				this.createAudioResource(metadata),
			);
			audioQueue.looping = dbAudioQueue.looping;

			froglog.info(
				"Loaded music queue from db for channel: " + channel.id,
			);
		}
	}

	private reaperCallback() {
		for (const queue of this.audioQueue.values()) {
			if (queue == null) continue;

			// check if there's anyone connected, excluding bots

			let anyoneConnected = false;

			for (const [_, member] of queue.channel.members) {
				if (member.user.bot) continue;
				anyoneConnected = true;
				break;
			}

			if (!anyoneConnected) {
				this.disconnectAndCleanup(queue.channel);

				if (queue.lastTextChannel != null) {
					queue.lastTextChannel.send(
						"🪫 ribbit, i left because nobody was listening. *sad frog noises*",
					);
				}
			}
		}
	}

	private async getFfmpegExtensions() {
		const dbKey = "exts-for-" + this.pathToFfmpeg;

		const dbExts = await Database.instance.getKeyValue<string[]>(dbKey);

		if (dbExts != null) {
			froglog.info("Found cached ffmpeg file extensions");
			this.ffmpegExtensions = dbExts;
			return;
		}

		froglog.info("Fetching ffmpeg file extensions...");

		const { stdout } = await execa(this.pathToFfmpeg, [
			"-hide_banner",
			"-demuxers",
		]);

		const demuxers = stdout
			.split("--")
			.slice(1)
			.join("--")
			.split("\n")
			.filter(line => line.trim() != "")
			.map(line => line.slice(4).split(" ")[0]);

		const exts = [];

		for (const demuxer of demuxers) {
			const { stdout } = await execa(this.pathToFfmpeg, [
				"-hide_banner",
				"-h",
				"demuxer=" + demuxer,
			]);

			const matches = stdout.match(/Common extensions: (.+)\./);

			if (matches) {
				const foundExts = matches[1].split(",").map(ext => ext.trim());
				for (const foundExt of foundExts) {
					if (!exts.includes(foundExt)) {
						exts.push(foundExt);
					}
				}
			}
		}

		this.ffmpegExtensions = exts;

		await Database.instance.setKeyValue(dbKey, exts);

		froglog.info("Done!");
	}

	private fetchLengthInSeconds(input: string) {
		// start ffmpeg but don't output. this will error but
		// it'll print the duration. it doesn't come with ffprobe

		return new Promise<number>(async resolve => {
			const tryFindDuration = (output: string) => {
				const matches = output.match(
					/Duration: ([0-9]+):([0-9]+):([0-9]+)\.([0-9]+)/,
				);
				if (matches == null) return false;

				const h = parseInt(matches[1]) * 60 * 60;
				const m = parseInt(matches[2]) * 60;
				const s = parseInt(matches[3]);
				const ms = parseFloat("0." + matches[4]);
				const totalSeconds = h + m + s + ms;

				resolve(totalSeconds);
				return true;
			};

			try {
				const { stdout, stderr } = await execa(this.pathToFfmpeg, [
					"-hide_banner",
					"-i",
					input,
					"-f",
					"null",
				]);
				if (tryFindDuration(stdout)) return;
				if (tryFindDuration(stderr)) return;
			} catch (error) {
				if (tryFindDuration(error.stderr)) return;
			}

			resolve(-1);
		});
	}

	async getInfo(search: string): Promise<AudioQueueMetadata> {
		const isUrl = /^https?:\/\//i.test(search);

		if (isUrl) {
			const url = new URL(search);
			const ext = url.pathname.split(".").pop();

			if (this.ffmpegExtensions.includes(ext)) {
				const seconds = await this.fetchLengthInSeconds(search);

				return {
					title: search,
					url: search,
					seconds,
					videoUrl: search,
					goodbye: false,
					isFile: false,
				};
			}
		}

		// TODO: livestream support maybe?

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

		const { title, url, duration, webpage_url } = JSON.parse(stdout);

		return {
			title,
			url,
			seconds: duration,
			videoUrl: tryShortenYoutubeLink(webpage_url),
			goodbye: false,
			isFile: false,
		};
	}

	private async ensureConnection(
		channel: VoiceBasedChannel,
	): Promise<VoiceConnection> {
		let connection = this.voiceConnections.get(channel.id);

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

			this.voiceConnections.set(channel.id, connection);

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
		let player = this.audioPlayers.get(channel.id);

		if (player == null) {
			player = createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Play,
				},
			});

			this.audioPlayers.set(channel.id, player);
		}

		// doesn't subscribe twice, checked with .listeners.length
		connection.subscribe(player);

		return player;
	}

	async disconnectAndCleanup(channel: VoiceBasedChannel) {
		const connection = this.voiceConnections.get(channel.id);

		if (connection != null) {
			connection.removeAllListeners();
			connection.disconnect();
			this.voiceConnections.delete(channel.id);
		}

		const player = this.audioPlayers.get(channel.id);

		if (player != null) {
			player.removeAllListeners();
			player.stop(); // not necessary
			this.audioPlayers.delete(channel.id);
		}

		this.audioQueue.delete(channel.id);

		this.syncToDatabase();
	}

	private createAudioResource(metadata: AudioQueueMetadata, seekSeconds = 0) {
		// https://github.com/skick1234/DisTube/blob/stable/src/core/DisTubeStream.ts

		const args = [
			// fixes youtube links from stopping
			...(metadata.isFile
				? []
				: [
						"-reconnect",
						"1",
						"-reconnect_streamed",
						"1",
						"-reconnect_delay_max",
						"5",
				  ]),
			// seek seconds. needs to be placed before -i or will take a long time
			...(seekSeconds > 0 ? ["-ss", String(seekSeconds)] : []),
			// input
			"-i",
			metadata.url,
			// normalize audio https://superuser.com/a/323127
			// https://ffmpeg.org/ffmpeg-filters.html#dynaudnorm
			// https://ffmpeg.org/ffmpeg-filters.html#loudnorm
			// loudnorm sounds better than dynaudnorm=p=0.9:s=5
			"-filter:a",
			"loudnorm,volume=" + (metadata.goodbye ? 0.5 : 0.25),
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

		// create resource
		return createAudioResource(stream, {
			inputType: StreamType.OggOpus,
			metadata,
		});
	}

	private recreateAudioResource(
		audioResource: AudioResource<AudioQueueMetadata>,
	) {
		return this.createAudioResource(audioResource.metadata);
	}

	private async getOdemonGoodbyeResource() {
		// thank you odemon <3

		const cursedChance = 0.05; // %
		let filename = "bybye_ribbit.mp3";

		if (Math.random() >= 1 - cursedChance) {
			filename = "bybye_ribbit_cursed.mp3";
		}

		const filePath = path.resolve(__dirname, "../../assets/", filename);

		return this.createAudioResource({
			title: "frog bot says goodbye",
			url: filePath,
			seconds: await this.fetchLengthInSeconds(filePath), // should i be concerned
			videoUrl: "",
			goodbye: true,
			isFile: true,
		});
	}

	private stateChangeCallback(channel: VoiceBasedChannel) {
		return async (
			oldState: AudioPlayerState,
			newState: AudioPlayerState,
		) => {
			// only when song finished
			if (newState.status != AudioPlayerStatus.Idle) return;

			// lets hope this never happens
			const queue = this.audioQueue.get(channel.id);
			if (queue == null) {
				this.disconnectAndCleanup(channel);
				return;
			}

			const connection = await this.ensureConnection(channel);
			const player = await this.ensurePlayer(channel, connection);

			if (
				queue.looping &&
				queue.skipping == false &&
				// dont loop goodbye
				!queue.current.metadata.goodbye
			) {
				queue.current = this.recreateAudioResource(queue.current);
				queue.currentStarted = Date.now();
				player.play(queue.current);

				this.syncToDatabase();
			} else {
				// if we're looping this'll make sure we dont skip again
				queue.skipping = false;

				if (queue.resources.length == 0) {
					// disconnect if empty
					// wait half a second just incase its still streaming
					setTimeout(() => {
						// will sync to database
						this.disconnectAndCleanup(channel);
					}, 500);
				} else {
					// shift song and play
					const audioResource = queue.resources.shift();
					queue.current = audioResource;
					queue.currentStarted = Date.now();
					player.play(audioResource);

					this.syncToDatabase();
				}
			}
		};
	}

	async addToQueue(
		channel: VoiceBasedChannel,
		textChannel: GuildTextBasedChannel,
		metadata: AudioQueueMetadata,
		playOdemonGoodbyeAfter = false,
		seekSeconds: number = 0,
	) {
		const audioResource = this.createAudioResource(metadata, seekSeconds);

		const foundQueue = this.audioQueue.get(channel.id);
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

			foundQueue.lastTextChannel = textChannel;

			this.syncToDatabase();

			return;
		}

		// no queue found so lets make one and immediately play

		this.audioQueue.set(channel.id, {
			channel,
			current: audioResource,
			currentStarted: Date.now() - seekSeconds * 1000,
			resources: playOdemonGoodbyeAfter
				? [await this.getOdemonGoodbyeResource()]
				: [],
			looping: false,
			skipping: false,
			lastTextChannel: textChannel,
		});

		const connection = await this.ensureConnection(channel);
		const player = await this.ensurePlayer(channel, connection);

		// when audio resource fails, throw so command can follow up nicely
		if (audioResource.ended) {
			this.disconnectAndCleanup(channel);
			throw new Error("Audio resource ended early");
		}

		player.play(audioResource);

		// listen to state change when song finishes
		// outsourced because its best we dont reference anything from here except channel

		player.on("stateChange", this.stateChangeCallback(channel));

		this.syncToDatabase();
	}

	skipCurrentSong(channel: VoiceBasedChannel) {
		const player = this.audioPlayers.get(channel.id);
		if (player == null) throw new Error("Player not found");

		const queue = this.audioQueue.get(channel.id);
		if (queue == null) throw new Error("Queue not found");

		const nextSongTitle =
			queue.resources.length > 0
				? queue.resources[0].metadata.title
				: null;

		// if we're looping, it won't know if its an intentional skip or not
		// will be set to false right after state change
		queue.skipping = true;

		player.stop(); // should run state change

		return nextSongTitle;
	}

	toggleLoop(channel: VoiceBasedChannel) {
		const queue = this.audioQueue.get(channel.id);
		if (queue == null) throw new Error("Queue not found");

		// when song ends, will check in state change
		queue.looping = !queue.looping;

		this.syncToDatabase();

		return queue.looping;
	}
}
