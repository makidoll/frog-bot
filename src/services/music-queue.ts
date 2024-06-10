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
	odemonGoodbye: boolean;
	isLocalStream: boolean;
	froggyHangOut: boolean;
	livestream: boolean;
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

// interface YtDlpFormat {
// 	resolution: string;
// 	abr: number;
// 	vbr: number;
// 	url: string;
// 	protocol: string;
// }

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
	// private ffmpegExtensions: string[] = [];

	async init() {
		this.pathToFfmpeg = await which("ffmpeg");

		// await this.getFfmpegExtensions();

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
					seekSeconds, // livestreams will ignore this
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
				console.log(error);
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

	/*
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
	*/

	private async ffmpegGetInfo(input: string) {
		// start ffmpeg but don't output. this will error but
		// it'll print the duration. it doesn't come with ffprobe

		const output = {
			found: false,
			totalSeconds: 0,
			streamName: "",
		};

		const tryFindDuration = (stdOutput: string) => {
			// if no duration, then its unreachable
			const durationMatches = stdOutput.match(
				/Duration: (?:([0-9]+):([0-9]+):([0-9]+)\.([0-9]+))|(N\/A)/,
			);

			if (durationMatches == null) return false;

			output.found = true;

			if (durationMatches[5] == "N/A") {
				// probably a livestream

				const icyNameMatches = stdOutput.match(
					/icy-name\s+:\s+([^]+?)\n/,
				);

				if (icyNameMatches != null) {
					output.streamName = icyNameMatches[1];
				}

				return true;
			} else {
				const h = parseInt(durationMatches[1]) * 60 * 60;
				const m = parseInt(durationMatches[2]) * 60;
				const s = parseInt(durationMatches[3]);
				const ms = parseFloat("0." + durationMatches[4]);

				output.totalSeconds = h + m + s + ms;

				return true;
			}
		};

		try {
			const { stderr } = await execa(this.pathToFfmpeg, [
				"-hide_banner",
				"-i",
				input,
				"-f",
				"null",
			]);

			if (tryFindDuration(stderr)) return output;
		} catch (error) {
			if (tryFindDuration(error.stderr)) return output;
		}

		return output;
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

	async getInfoFromSearch(search: string): Promise<AudioQueueMetadata[]> {
		const isUrl = /^https?:\/\//i.test(search);

		if (isUrl) {
			const { found, streamName, totalSeconds } =
				await this.ffmpegGetInfo(search);

			if (found) {
				return [
					{
						title: streamName ?? search,
						url: search,
						seconds: totalSeconds,
						videoUrl: search,
						playlistUrl: null,
						odemonGoodbye: false,
						isLocalStream: false,
						froggyHangOut: false,
						livestream: totalSeconds == 0,
					},
				];
			}
		}

		// TODO: livestream support maybe?
		// getBestFormat function helps with this but ffmpeg wont keep playing

		const isUrlWithoutHttp =
			/^youtube\.com/i.test(search) || /^youtu\.be/i.test(search);

		let ytDlpSearch = "";

		if (isUrl || isUrlWithoutHttp) {
			ytDlpSearch = isUrlWithoutHttp ? "https://" + search : search;
		} else {
			ytDlpSearch = "ytsearch1:" + search;
		}

		const args = [
			"--no-warnings",
			"--ignore-errors",
			"-J", // single json, -j is multi line json
			// we're doing this ourselves
			// ok we're not. todo above related
			"-f",
			"bestaudio",
			ytDlpSearch,
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
					odemonGoodbye: false,
					isLocalStream: false,
					froggyHangOut: false,
					livestream: false, // TODO: potentially could be a livestream??
				});
			} catch (error) {
				// ignore i guess
				console.log(error);
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

		let args: string[] = [];

		if (!metadata.isLocalStream) {
			// fixes youtube links from stopping
			args.push(
				"-reconnect",
				"1",
				"-reconnect_streamed",
				"1",
				"-reconnect_delay_max",
				"5",
			);
		}

		if (!metadata.livestream && seekSeconds > 0) {
			// seek seconds. needs to be placed before -i or will take a long time
			args.push("-ss", String(seekSeconds));
		}

		if (metadata.froggyHangOut) {
			// just silence
			args.push("-f", "lavfi", "-i", "anullsrc=cl=mono");
		} else {
			args.push(
				// input
				"-i",
				metadata.url,
				// normalize audio https://superuser.com/a/323127
				// https://ffmpeg.org/ffmpeg-filters.html#dynaudnorm
				// https://ffmpeg.org/ffmpeg-filters.html#loudnorm
				// loudnorm sounds better than dynaudnorm=p=0.9:s=5
				"-filter:a",
				// "loudnorm,volume=" + (metadata.odemonGoodbye ? 0.5 : 0.25),
				"loudnorm,volume=" + (metadata.odemonGoodbye ? 0.8 : 0.5),
			);
		}

		args.push(
			// https://github.com/discordjs/discord.js/blob/main/packages/voice/src/audio/TransformerGraph.ts
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
		);

		// TODO: livestream skip when starting until they eventually dont. its really weird

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
			seconds: (await this.ffmpegGetInfo(filePath)).totalSeconds,
			videoUrl: null,
			playlistUrl: null,
			odemonGoodbye: true,
			isLocalStream: true,
			froggyHangOut: false,
			livestream: false,
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

			const playNow = (metadata: AudioQueueMetadata) => {
				const resource = this.createAudioResource(metadata);
				queue.current = resource;
				queue.currentStarted = Date.now();
				player.play(resource);
				this.syncToDatabase();
			};

			const continuePlaying =
				queue.looping || queue.current?.metadata?.livestream;

			if (
				continuePlaying &&
				queue.skipping == false &&
				// dont loop goodbye
				!queue.current?.metadata?.odemonGoodbye
			) {
				// adding timeout might help?
				setTimeout(() => {
					playNow(queue.current.metadata);
				}, 500);
				return;
			}

			// if we're looping this'll make sure we dont skip again
			queue.skipping = false;

			// disconnect if empty
			if (queue.resourcesMetadatas.length == 0) {
				// wait half a second just incase its still streaming
				setTimeout(() => {
					// will sync to database
					this.disconnectAndCleanup(channel);
				}, 500);
			} else {
				// shift song to play next
				playNow(queue.resourcesMetadatas.shift());
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
				resource => resource.odemonGoodbye,
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
			console.log(error);
		}

		// try all future interactions
		for (const metadata of queue.resourcesMetadatas) {
			try {
				if (metadata.followUpMessage == null) continue;
				metadata.followUpMessage.edit({
					components: getPlayInteractionComponents(metadata, queue),
				});
			} catch (error) {
				console.log(error);
			}
		}

		return queue.looping;
	}

	getAudioQueue(channel: VoiceBasedChannel): AudioQueue | null {
		const queue = this.audioQueue.get(channel.id);
		return queue;
	}
}
