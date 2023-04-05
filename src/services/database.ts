import Datastore = require("nedb-promises");
import * as path from "path";
import { froglog } from "../froglog";

interface FfmpegExts {
	_id: string; // path to ffmpeg
	exts: string[];
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

	private _ffmpegExts: Datastore<FfmpegExts>;
	public get ffmpegExts(): Datastore<FfmpegExts> {
		return this._ffmpegExts;
	}

	async init() {
		const dbDir = path.resolve(__dirname, "../../db");

		this._ffmpegExts = Datastore.create({
			filename: path.resolve(dbDir, "ffmpeg-exts.db"),
		});
		await this._ffmpegExts.load();

		froglog.info('Initializated databases in folder\n  "' + dbDir + '"');
	}
}
