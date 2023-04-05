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

export class Database {
	private static _instance: Database;

	public static get instance(): Database {
		if (!Database._instance) {
			Database._instance = new Database();
		}
		return Database._instance;
	}

	private constructor() {}

	private _ffmpegExts: Datastore<FfmpegExtsDocument>;
	public get ffmpegExts(): Datastore<FfmpegExtsDocument> {
		return this._ffmpegExts;
	}

	private _musicAudioQueue: Datastore<MusicAudioQueueDocument>;
	public get musicAudioQueue(): Datastore<MusicAudioQueueDocument> {
		return this._musicAudioQueue;
	}

	async init() {
		const dbDir = path.resolve(__dirname, "../../db");

		this._ffmpegExts = Datastore.create({
			filename: path.resolve(dbDir, "ffmpeg-exts.db"),
		});
		await this._ffmpegExts.load();

		this._musicAudioQueue = Datastore.create({
			filename: path.resolve(dbDir, "music-audio-queue.db"),
		});
		await this._musicAudioQueue.load();

		froglog.info('Initializated databases in folder\n  "' + dbDir + '"');
	}
}
