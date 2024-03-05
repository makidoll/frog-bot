import axios from "axios";
import { APIEmbed, Client, TextChannel } from "discord.js";
import ImgurClient from "imgur";
import Mitt, { Emitter } from "mitt";
import { error } from "ololog";
import WebSocket from "ws";
import { froglog } from "../froglog";
import { Database } from "../services/database";
import { generateRandomId, wait } from "../utils";

let discordChannelTwitchChannelMap: { [key: string]: string[] };

if (process.env.DEV) {
	discordChannelTwitchChannelMap = {
		// dollhouse bot testing
		"1086714710788952138": ["maki_doll_testing"],
	};
} else {
	discordChannelTwitchChannelMap = {
		// steamshell armoury, captains-are-live
		"1214318507546771466": [
			"blender_fox",
			"lofi_juno",
			"odemon",
			"serah_cross",
			"steamshellkidd",
			"kimpleclone",
			"maki_doll",
			"melodytranquil",
		],
	};
}

// twitch dev api is terrible. using code from:
// https://www.npmjs.com/package/twitch-ws

interface TwitchNielsenContentMetadata {
	user: {
		id: string;
		broadcastSettings: {
			id: string;
			title: string;
		};
		stream: {
			id: string;
			createdAt: string;
			game: {
				id: string;
				displayName: string;
			};
		};
	};
}

interface TwitchChannelShell {
	userOrError: {
		id: string;
		login: string;
		displayName: string;
		primaryColorHex: string; // without #
		profileImageURL: string;
		stream: {
			id: string;
			viewersCount: number;
		};
		bannerImageURL: string;
		channel: {
			id: string;
			self: {
				isAuthorized: boolean;
				restrictionType: null;
			};
			trailer: {
				video: null;
			};
			home: {
				preferences: {
					heroPreset: string;
				};
			};
		};
	};
}

type TwitchMetadata = [
	{ data: TwitchNielsenContentMetadata },
	{ data: TwitchChannelShell },
];

class TwitchStream {
	public readonly channelName: string;

	public readonly events: Emitter<{
		connect: TwitchMetadata;
		"stream-up": { server_time: number; play_delay: 0 };
		"stream-down": { server_time: number };
		"ws-open": null;
		"ws-close": null;
		"ws-error": Error;
	}>;

	private ws: WebSocket;
	private pingInterval: NodeJS.Timeout;

	constructor(channelName: string) {
		this.channelName = channelName;
		this.events = Mitt();
	}

	public async getMetadata() {
		const gql = (
			operationName: string,
			variables: any,
			sha256Hash: string,
		) => ({
			operationName,
			variables,
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash,
				},
			},
		});

		const res = await axios.post<TwitchMetadata>(
			"https://gql.twitch.tv/gql",
			[
				gql(
					"NielsenContentMetadata",
					{
						collectionID: "",
						isCollectionContent: false,
						isLiveContent: true,
						isVODContent: false,
						login: this.channelName,
						vodID: "",
					},
					"2dbf505ee929438369e68e72319d1106bb3c142e295332fac157c90638968586",
				),
				gql(
					"ChannelShell",
					{ login: this.channelName },
					"580ab410bcd0c1ad194224957ae2241e5d252b2c5173d8e0cce9d32d5bb14efe",
				),
			],
			// not logged in to twitch
			{ headers: { "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko" } },
		);

		return res.data;
	}

	private sendVideoPlaybackRequest(channelId: string) {
		if (this.ws.readyState != this.ws.OPEN) return;
		this.ws.send(
			JSON.stringify({
				data: { topics: ["video-playback-by-id." + channelId] },
				none: generateRandomId(30), // a-zA-Z0-9
				type: "LISTEN",
			}),
		);
	}

	public disconnect() {
		if (this.pingInterval != null) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}

		if (this.ws == null) return;

		this.ws.removeAllListeners();
		this.ws.close();

		this.ws = null;
	}

	public connect() {
		if (this.ws != null) {
			if (
				this.ws.readyState == this.ws.CONNECTING ||
				this.ws.readyState == this.ws.OPEN
			) {
				return; // already open
			}
			// ws socket exists but its disconnected
			this.disconnect(); // cleanup first
		}

		this.ws = new WebSocket("wss://pubsub-edge.twitch.tv/v1");

		this.ws.on("open", async () => {
			this.events.emit("ws-open", null);

			const ping = () => {
				if (this.ws.readyState != this.ws.OPEN) return;
				this.ws.send(JSON.stringify({ type: "PING" }));
			};

			ping();

			// happens every 4 minutes
			if (this.pingInterval != null) clearInterval(this.pingInterval);
			this.pingInterval = setInterval(ping, 1_000 * 60 * 4);

			const data = await this.getMetadata();

			this.sendVideoPlaybackRequest(data[1].data.userOrError.id);

			this.events.emit("connect", data);
		});

		this.ws.on("error", e => {
			this.events.emit("ws-error", e);
			this.reconnect();
		});

		// only if host closes websocket, so this.ws.close() wont trigger this
		this.ws.on("close", () => {
			this.events.emit("ws-close", null);
			this.reconnect();
		});

		// this.ws.on("close")

		this.ws.on("message", msg => {
			const json = JSON.parse(msg.toString().trim());

			if (json.type != "MESSAGE") return;

			const message = JSON.parse(json.data.message);
			if (message.type == null) return;

			this.events.emit(message.type, message);
		});
	}

	private async reconnect() {
		this.disconnect();
		await wait(5_000);
		this.connect();
	}
}

export async function initTwitchLiveNotifications(client: Client<boolean>) {
	const imgur = new ImgurClient({
		clientId: process.env.IMGUR_CLIENT_ID,
		clientSecret: process.env.IMGUR_CLIENT_SECRET,
	});

	// flip map the other way around

	const twitchChannelDiscordChannelMap: { [key: string]: string[] } = {};

	for (let [discordChannelId, twitchChannelNames] of Object.entries(
		discordChannelTwitchChannelMap,
	)) {
		for (const twitchChannelName of twitchChannelNames) {
			if (twitchChannelDiscordChannelMap[twitchChannelName] == null) {
				twitchChannelDiscordChannelMap[twitchChannelName] = [];
			}

			twitchChannelDiscordChannelMap[twitchChannelName].push(
				discordChannelId,
			);
		}
	}

	// initialize for each twitch channel

	for (let [username, discordChannelIds] of Object.entries(
		twitchChannelDiscordChannelMap,
	)) {
		username = username.toLowerCase();

		// get discord channels

		let discordChannels: TextChannel[] = [];

		for (const discordChannelId of discordChannelIds) {
			try {
				discordChannels.push(
					(await client.channels.fetch(
						discordChannelId,
					)) as TextChannel,
				);
			} catch (error) {
				froglog.error(
					"Failed to find Discord channel for Twitch live notifications: " +
						discordChannelIds,
				);
			}
		}

		// start twitch stream listener

		const twitchStream = new TwitchStream(username);

		twitchStream.events.on("ws-open", async () => {
			froglog.info("Twitch WebSocket opened for: " + username);
		});

		twitchStream.events.on("ws-close", async () => {
			froglog.error("Twitch WebSocket closed, reconnecting...");
		});

		twitchStream.events.on("ws-error", async () => {
			froglog.error("Twitch WebSocket error", error);
		});

		twitchStream.events.on("stream-up", async () => {
			if (!process.env.DEV) {
				const lastOfflineDoc =
					await Database.instance.twitchLastOffline.findOne({
						_id: username,
					});

				if (
					lastOfflineDoc != null &&
					// if last live less than 5 minutes ago, return
					Date.now() - lastOfflineDoc.lastOffline < 1_000 * 60 * 5
				) {
					return;
				}
			}

			froglog.info("Twitch stream went live: " + username);

			// 10s was sometimes just too short
			await wait(15_000);

			const data = await twitchStream.getMetadata();

			if (data[0].data.user.stream == null) {
				froglog.error(
					'Received "stream-up" from WS but stream is null in metadata: ' +
						username,
				);
				return;
			}

			const channelUrl = "https://www.twitch.tv/" + username;

			const title = data[0].data.user.broadcastSettings.title;
			const game = data[0].data.user.stream.game;

			const displayName = data[1].data.userOrError.displayName;
			const profileImageUrl = data[1].data.userOrError.profileImageURL;
			const primaryColorHex = data[1].data.userOrError.primaryColorHex;

			// url might 404 this early, but discord might load an updated version eventually, but maybe not because of caching
			// lmao maybe we just dont do a preview image

			const previewImageUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${username}-1920x1080.jpg?${Date.now()}`;

			const embed: APIEmbed = {
				description: displayName + " is now live on Twitch!",
				title,
				author: {
					name: displayName,
					url: channelUrl,
					icon_url: profileImageUrl,
				},
				// image: { url: previewImageUrl },
				url: channelUrl,
				color:
					primaryColorHex == null
						? 0x9146ff
						: parseInt(primaryColorHex, 16),
				footer: {
					text: "Twitch",
					icon_url: "https://i.imgur.com/AwUb7LE.png",
				},
				timestamp: new Date().toISOString(),
			};

			// or we just upload it to imgur

			try {
				const res = await fetch(previewImageUrl);
				const image = Buffer.from(await res.arrayBuffer());
				const upload = await imgur.upload({ image });
				if (upload.success) {
					embed.image = { url: upload.data.link };
				}
			} catch (error) {
				froglog.error(error);
				embed.image = { url: previewImageUrl };
			}

			// game can be null if not set
			// it can also be null if we fetch metadata too quickly

			if (game != null) {
				const gameImageUrl = `https://static-cdn.jtvnw.net/ttv-boxart/${
					game.id
				}.jpg?${Date.now()}`;

				embed.fields = [
					{
						name: "Playing",
						value: game.displayName,
						inline: true,
					},
				];

				embed.thumbnail = { url: gameImageUrl };
			}

			for (const discordChannel of discordChannels) {
				try {
					discordChannel.send({
						embeds: [embed],
					});
				} catch (error) {
					froglog.error(
						"Failed to send Discord message for Twitch live notification",
						error,
					);
				}
			}
		});

		twitchStream.events.on("stream-down", async () => {
			const docCount = await Database.instance.twitchLastOffline.count({
				_id: username,
			});

			if (docCount == 0) {
				await Database.instance.twitchLastOffline.insertOne({
					_id: username,
					lastOffline: Date.now(),
				});
			} else {
				await Database.instance.twitchLastOffline.updateOne(
					{ _id: username },
					{ _id: username, lastOffline: Date.now() },
				);
			}
		});

		twitchStream.connect(); // will return if already connected
	}
}
