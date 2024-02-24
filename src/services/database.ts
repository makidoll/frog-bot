import Datastore = require("nedb-promises");
import * as path from "path";
import { froglog } from "../froglog";
import { AudioQueueMetadata } from "./music-queue";

interface KeyValueDocument {
	_id: string;
	value: any;
}

// should reflect in music-queue.ts
export interface MusicAudioQueueDocument {
	_id: string; // channel id
	current: AudioQueueMetadata;
	currentStarted: number; // used for continuing playback
	resourcesMetadatas: AudioQueueMetadata[];
	looping: boolean;
}

export interface InstalledToolsDocument {
	_id: string; // tool name
	version: string;
}

export interface TwitchLastOfflineDocument {
	_id: string; // username
	lastOffline: number; // date
}

export class Database {
	private static _instance: Database;

	public static get instance(): Database {
		if (!Database._instance) {
			Database._instance = new Database();
		}
		return Database._instance;
	}

	private constructor() {}

	private keyValue: Datastore<KeyValueDocument>;

	public musicAudioQueue: Datastore<MusicAudioQueueDocument>;
	public installedTools: Datastore<InstalledToolsDocument>;
	public twitchLastOffline: Datastore<TwitchLastOfflineDocument>;

	private dbDir = path.resolve(__dirname, "../../db");

	private async initDb(filename: string) {
		const db = Datastore.create({
			filename: path.resolve(this.dbDir, filename),
		});
		await db.load();
		return db;
	}

	async init() {
		this.musicAudioQueue = await this.initDb("music-audio-queue.db");
		this.installedTools = await this.initDb("installed-tools.db");
		this.twitchLastOffline = await this.initDb("twitch-last-offline.db");
		this.keyValue = await this.initDb("key-value.db");

		froglog.info(
			'Initializated databases in folder\n  "' + this.dbDir + '"',
		);
	}

	async getKeyValue<T>(key: string): Promise<T> {
		const doc = await this.keyValue.findOne({ _id: key });
		if (doc == null) return null;
		return doc.value;
	}

	async setKeyValue(key: string, value: any) {
		const updated = await this.keyValue.updateOne({ _id: key }, { value });
		if (updated == 0) {
			await this.keyValue.insertOne({ _id: key, value });
		}
	}
}
