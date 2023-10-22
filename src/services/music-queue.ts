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
import {
	Client,
	GuildTextBasedChannel,
	Message,
	VoiceBasedChannel,
} from "discord.js";
import { execa } from "execa";
import * as path from "path";
import { FFmpeg } from "prism-media";
import { Categories, ServerExclusiveCategories } from "../command";
import { getPlayInteractionComponents } from "../commands/music/play-command";
import { froglog } from "../froglog";
import { ToolName, ToolsManager, which } from "../tools-manager";
import { tryShortenYoutubeLink } from "../utils";
import { Database, MusicAudioQueueDocument } from "./database";

export interface AudioQueueMetadata {
	title: string;
	url: string;
	seconds: number;
	videoUrl: string;
	playlistUrl: string;
	goodbye: boolean;
	isFile: boolean;
	// for updating loop button and knowing where to leave message
	followUpMessage?: Message<boolean>;
	textChannel?: GuildTextBasedChannel;
	// for database
	followUpMessageId?: string;
	textChannelId?: string;
}

// should reflect in database.ts
export interface AudioQueue {
	channel: VoiceBasedChannel;
	current: AudioResource<AudioQueueMetadata>;
	currentStarted: number; // Date.now()
	resourcesMetadatas: AudioQueueMetadata[];
	looping: boolean;
	// ephemeral
	skipping: boolean;
}

interface YtDlpFormat {
	resolution: string;
	abr: number;
	vbr: number;
	url: string;
	protocol: string;
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

		// TODO: allow moving bot whilst playing
	}

	private metadataToDatabaseMetadata(
		metadata: AudioQueueMetadata,
	): AudioQueueMetadata {
		return {
			...metadata,
			followUpMessage: null,
			textChannel: null,
			followUpMessageId: metadata?.followUpMessage?.id,
			textChannelId: metadata?.textChannel?.id,
		};
	}

	private async databaseMetadataToMetadata(
		client: Client,
		metadata: AudioQueueMetadata,
	): Promise<AudioQueueMetadata> {
		const textChannelId = metadata.textChannelId;
		const followUpMessageId = metadata.followUpMessageId;

		if (textChannelId == null || followUpMessageId == null) return metadata;

		// try to get text channel
		let textChannel: GuildTextBasedChannel; // can be null
		try {
			textChannel = (await client.channels.fetch(
				textChannelId,
			)) as GuildTextBasedChannel;
		} catch (error) {}
		if (textChannel == null) return metadata;

		metadata.textChannel = textChannel;

		// try to get message
		let followUpMessage: Message<boolean>; // can be null
		try {
			followUpMessage = await textChannel.messages.fetch(
				followUpMessageId,
			);
		} catch (error) {}
		if (followUpMessage == null) return metadata;

		metadata.followUpMessage = followUpMessage;

		return metadata;
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
				current: this.metadataToDatabaseMetadata(
					audioQueue.current.metadata,
				),
				currentStarted: audioQueue.currentStarted,
				resourcesMetadatas: audioQueue.resourcesMetadatas.map(
					metadata => this.metadataToDatabaseMetadata(metadata),
				),
				looping: audioQueue.looping,
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
			try {
				// get voice channel. error will get caught
				const channel = (await client.channels.fetch(
					dbAudioQueue._id,
				)) as VoiceBasedChannel;

				// convert metadata from database so channels are fetch for
				// loop buttons on follow ups
				try {
					dbAudioQueue.current =
						await this.databaseMetadataToMetadata(
							client,
							dbAudioQueue.current,
						);
				} catch (error) {}
				for (
					let i = 0;
					i < dbAudioQueue.resourcesMetadatas.length;
					i++
				) {
					try {
						dbAudioQueue.resourcesMetadatas[i] =
							await this.databaseMetadataToMetadata(
								client,
								dbAudioQueue.resourcesMetadatas[i],
							);
					} catch (error) {}
				}

				// TODO: will skip a bit, is this bad?
				const seekMs = Date.now() - dbAudioQueue.currentStarted;
				const seekSeconds = seekMs / 1000;

				await this.addToQueue(
					channel,
					[dbAudioQueue.current],
					seekSeconds,
				);

				// update queue
				const audioQueue = this.audioQueue.get(channel.id);
				audioQueue.current.metadata = dbAudioQueue.current;
				audioQueue.resourcesMetadatas = dbAudioQueue.resourcesMetadatas;
				audioQueue.looping = dbAudioQueue.looping;

				froglog.info(
					"Loaded music queue from db for channel: " + channel.id,
				);
			} catch (error) {
				console.error(error);
				froglog.error(
					"Failed to load music queue from db for channel: " +
						dbAudioQueue._id,
				);
			}
		}

		await this.syncToDatabase();
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

				const textChannel = queue.current?.metadata?.textChannel;

				if (textChannel != null) {
					textChannel.send(
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

	/*
	private getBestFormat(
		formats: YtDlpFormat[],
		type: "audioThenVideo" | "video" = "audioThenVideo",
	) {
		if (formats.length == 0) {
			throw new Error("No formats available");
		}

		let highestFormats: YtDlpFormat[] = [];

		if (type == "audioThenVideo") {
			const audioFormats: any[] = formats
				.filter(f => f.resolution == "audio only" && f.abr)
				.sort((a, b) => b.abr - a.abr); // sort by highest first

			if (audioFormats.length == 0) {
				// only video formats available, livestreams for example
				return this.getBestFormat(formats, "video");
			}

			const highestAbr = audioFormats[0].abr;
			highestFormats = audioFormats.filter(f => f.abr == highestAbr);
		} else {
			// get highest for video

			const videoFormats: any[] = formats
				.filter(f => f.resolution != "audio only" && f.vbr)
				.sort((a, b) => b.vbr - a.vbr); // sort by highest first

			const highestVbr = videoFormats[0].vbr;
			highestFormats = videoFormats.filter(f => f.vbr == highestVbr);
		}

		if (highestFormats.length == 1) {
			// only one format available
			return highestFormats[0].url;
		}

		for (let format of highestFormats) {
			if (format.protocol == "https") return format.url;
			if (format.protocol == "http") return format.url;
		}

		// just return first i guess
		return highestFormats[0].url;
	}
	*/

	async getYtDlpInfo(search: string): Promise<AudioQueueMetadata[]> {
		const isUrl = /^https?:\/\//i.test(search);

		if (isUrl) {
			const url = new URL(search);
			const ext = url.pathname.split(".").pop();

			if (this.ffmpegExtensions.includes(ext)) {
				const seconds = await this.fetchLengthInSeconds(search);

				return [
					{
						title: search,
						url: search,
						seconds,
						videoUrl: search,
						playlistUrl: null,
						goodbye: false,
						isFile: false,
					},
				];
			}
		}

		// TODO: livestream support maybe?
		// getBestFormat function helps with this but ffmpeg wont keep playing

		const isUrlWithoutHttp =
			/^youtube\.com/i.test(search) || /^youtu\.be/i.test(search);

		const args = [
			"--no-warnings",
			"--ignore-errors",
			"-J", // single json, -j is multi line json
			// we're doing this ourselves
			// ok we're not. todo above related
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
			{
				timeout: 0,
				maxBuffer: 100_000_000, // 100 MB
				reject: false, // dont error, can happen when video deleted in playlist
			},
		);

		const results: AudioQueueMetadata[] = [];

		const ytDlpResult = JSON.parse(stdout);
		let ytDlpEntries: any[] = [];
		let playlistUrl = null;

		if (ytDlpResult._type == "video") {
			ytDlpEntries.push(ytDlpResult);
		} else if (ytDlpResult._type == "playlist") {
			ytDlpEntries = ytDlpResult.entries;

			// only set playlist url if there's more than one song
			if (ytDlpResult.entries.length > 1) {
				playlistUrl = ytDlpResult.webpage_url;
			}
		}

		for (const ytDlpEntry of ytDlpEntries) {
			try {
				const { title, url, formats, duration, webpage_url } =
					ytDlpEntry;

				// const url = this.getBestFormat(formats);
				// console.log(url);

				results.push({
					title,
					url,
					seconds: duration,
					videoUrl: tryShortenYoutubeLink(webpage_url),
					playlistUrl,
					goodbye: false,
					isFile: false,
				});
			} catch (error) {
				// ignore i guess
				console.error(error);
			}
		}

		return results;
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

		// TODO: will queue.current linger ffmpeg process?

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

	private async getOdemonGoodbyeMetadata(): Promise<AudioQueueMetadata> {
		// thank you odemon <3

		const cursedChance = 0.05; // %
		let filename = "bybye_ribbit.mp3";

		if (Math.random() >= 1 - cursedChance) {
			filename = "bybye_ribbit_cursed.mp3";
		}

		const filePath = path.resolve(__dirname, "../../assets/", filename);

		return {
			title: "frog bot says goodbye",
			url: filePath,
			seconds: await this.fetchLengthInSeconds(filePath), // should i be concerned
			videoUrl: null,
			playlistUrl: null,
			goodbye: true,
			isFile: true,
		};
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
				!queue.current?.metadata?.goodbye
			) {
				// adding timeout might help?
				setTimeout(() => {
					const metadata = queue.current.metadata;
					const resource = this.createAudioResource(metadata);
					queue.current = resource;
					queue.currentStarted = Date.now();
					player.play(queue.current);

					this.syncToDatabase();
				}, 500);
			} else {
				// if we're looping this'll make sure we dont skip again
				queue.skipping = false;

				if (queue.resourcesMetadatas.length == 0) {
					// disconnect if empty
					// wait half a second just incase its still streaming
					setTimeout(() => {
						// will sync to database
						this.disconnectAndCleanup(channel);
					}, 500);
				} else {
					// shift song and play
					const metadata = queue.resourcesMetadatas.shift();
					const resource = this.createAudioResource(metadata);
					queue.current = resource;
					queue.currentStarted = Date.now();
					player.play(resource);

					this.syncToDatabase();
				}
			}
		};
	}

	async addToQueue(
		channel: VoiceBasedChannel,
		metadatas: AudioQueueMetadata[],
		seekSecondsForFirst = 0,
	) {
		const foundQueue = this.audioQueue.get(channel.id);
		if (foundQueue != null) {
			// already a queue available, so add song
			// but we should add it before a found goodbye resource

			const goodbyeIndex = foundQueue.resourcesMetadatas.findIndex(
				resource => resource.goodbye,
			);

			for (const metadata of metadatas) {
				if (goodbyeIndex == -1) {
					foundQueue.resourcesMetadatas.push(metadata);
				} else {
					// add right before last resource
					foundQueue.resourcesMetadatas.splice(
						foundQueue.resourcesMetadatas.length - 1,
						0,
						metadata,
					);
				}
			}

			this.syncToDatabase();

			return;
		}

		// no queue found so lets make one and immediately play

		const resourcesMetadatas = metadatas;

		const currentMetadata = resourcesMetadatas.shift();
		const current = this.createAudioResource(
			currentMetadata,
			seekSecondsForFirst,
		);

		const playOdemonGoodbyeAfter = process.env.DEV
			? true
			: ServerExclusiveCategories[Categories.mechanyx].includes(
					channel.guildId,
			  );

		if (playOdemonGoodbyeAfter) {
			resourcesMetadatas.push(await this.getOdemonGoodbyeMetadata());
		}

		this.audioQueue.set(channel.id, {
			channel,
			current,
			currentStarted: Date.now() - seekSecondsForFirst * 1000,
			resourcesMetadatas,
			looping: false,
			skipping: false,
		});

		const connection = await this.ensureConnection(channel);
		const player = await this.ensurePlayer(channel, connection);

		// when audio resource fails, throw so command can follow up nicely
		if (current.ended) {
			this.disconnectAndCleanup(channel);
			throw new Error("Audio resource ended early");
		}

		player.play(current);

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
			queue.resourcesMetadatas.length > 0
				? queue.resourcesMetadatas[0].title
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

		// try edit current interactions
		try {
			if (queue.current.metadata.followUpMessage != null) {
				queue.current.metadata.followUpMessage.edit({
					components: getPlayInteractionComponents(
						queue.current.metadata,
						queue,
					),
				});
			}
		} catch (error) {
			console.error(error);
		}

		// try all future interactions
		for (const metadata of queue.resourcesMetadatas) {
			try {
				if (metadata.followUpMessage == null) continue;
				metadata.followUpMessage.edit({
					components: getPlayInteractionComponents(metadata, queue),
				});
			} catch (error) {
				console.error(error);
			}
		}

		return queue.looping;
	}

	getAudioQueue(channel: VoiceBasedChannel): AudioQueue | null {
		const queue = this.audioQueue.get(channel.id);
		return queue;
	}
}
