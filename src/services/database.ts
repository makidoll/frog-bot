import Datastore = require("nedb-promises");
import * as path from "path";
import { froglog } from "../froglog";

export interface FfmpegExtsDocument {
	_id: string; // path to ffmpeg
	exts: string[];
}

export interface MusicAudioQueueDocument {
	_id: string; // channel id
	current: any; // metadata with url and filename
	currentStarted: number; // used for continuing playback
	resources: any[]; // metadata like above
	looping: boolean;
}

export interface InstalledToolsDocument {
	_id: string; // tool name
	version: string;
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

	public ffmpegExts: Datastore<FfmpegExtsDocument>;
	public musicAudioQueue: Datastore<MusicAudioQueueDocument>;
	public installedTools: Datastore<InstalledToolsDocument>;

	private dbDir = path.resolve(__dirname, "../../db");

	private async initDb(filename: string) {
		const db = Datastore.create({
			filename: path.resolve(this.dbDir, filename),
		});
		await db.load();
		return db;
	}

	async init() {
		this.ffmpegExts = await this.initDb("ffmpeg-exts.db");
		this.musicAudioQueue = await this.initDb("music-audio-queue.db");
		this.installedTools = await this.initDb("installed-tools.db");

		froglog.info(
			'Initializated databases in folder\n  "' + this.dbDir + '"',
		);
	}
}
