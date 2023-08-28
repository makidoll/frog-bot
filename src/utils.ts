import axios from "axios";
import { ClientUser, Guild, ImageURLOptions, User } from "discord.js";
import * as fs from "fs/promises";

export async function downloadToBuffer(url: string) {
	try {
		const req = await axios({ url, responseType: "arraybuffer" });
		return req.data;
	} catch (error) {
		return "";
	}
}

export async function downloadToDataUri(url: string) {
	try {
		const req = await axios({ url, responseType: "arraybuffer" });
		const contentType = req.headers["content-type"].split(" ")[0];
		const base64Data = req.data.toString("base64");
		return "data:" + contentType + ";base64," + base64Data;
	} catch (error) {
		return "";
	}
}

export function bufferToDataUri(buffer: Buffer, contentType: string) {
	const base64Data = buffer.toString("base64");
	return "data:" + contentType + ";base64," + base64Data;
}

export async function getUsernameAndAvatarURL(
	user: User | ClientUser,
	guild: Guild,
) {
	const member = await guild.members.fetch({ user });
	const options: ImageURLOptions = {
		extension: "png",
		size: 1024,
		forceStatic: true,
	};
	return {
		username: member?.displayName ?? user.username,
		avatarURL: member?.displayAvatarURL(options) ?? user.avatarURL(options),
	};
}

export function stNdRdTh(n: number) {
	const mod = n % 10;
	if (mod == 1) return n + "st";
	else if (mod == 2) return n + "nd";
	else if (mod == 3) return n + "rd";
	else return n + "th";
}

export function plural(n: number, single: string, plural: string = null) {
	if (plural == null) plural = single + "s";
	if (n == 1 || n == -1) return n + " " + single;
	else return n + " " + plural;
}

export function possessiveEnding(name: string) {
	if (name.endsWith("s")) return "'";
	return "'s";
}

export function possessive(name: string) {
	return name + possessiveEnding(name);
}

export function formatDuration(s: number) {
	if (s < 0) return "unknown";

	const seconds = Math.floor(s % 60);
	const minutes = Math.floor((s / 60) % 60);
	const hours = Math.floor((s / 60 / 60) % 24);
	const days = Math.floor(s / 60 / 60 / 24);

	return (
		(days > 0 ? String(days).padStart(2, "0") + ":" : "") +
		(hours > 0 ? String(hours).padStart(2, "0") + ":" : "") +
		String(minutes).padStart(2, "0") +
		":" +
		String(seconds).padStart(2, "0")
	).replace(/^0/, "");
}

export function shuffleArray(array: any[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

export function customIdMatch(
	customIds: string[] | null,
	queryCustomId: string,
) {
	// matches if equal but if it ends with *, will do starts with

	if (customIds == null) {
		customIds = [];
	}

	for (const customId of customIds) {
		if (
			customId == queryCustomId ||
			(customId.endsWith("*") &&
				queryCustomId.startsWith(customId.slice(0, -1)))
		) {
			return true;
		}
	}

	return false;
}

export function tryShortenYoutubeLink(youtubeLink: string) {
	const url = new URL(youtubeLink);
	if (!url.hostname.endsWith("youtube.com")) return youtubeLink;
	const id = url.searchParams.get("v");
	return "https://youtu.be/" + id;
}

export function generateRandomId(length: number) {
	const dict =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	let output = "";
	for (let i = 0; i < length; i++) {
		output += dict[Math.floor(Math.random() * dict.length)];
	}

	return output;
}

export function splitArrayInto<T>(array: T[], size: number): T[][] {
	size = Math.floor(size);

	// 10 into sizes of 2 is 5 arrays

	const totalArrays = Math.ceil(array.length / size);
	const outputArrays: T[][] = [];

	for (let i = 0; i < totalArrays; i++) {
		outputArrays.push(
			array.slice(i * size, Math.min(i * size + size, array.length)),
		);
	}

	return outputArrays;
}

export function formatBytes(bytes: number) {
	if (bytes < 1000) return Math.floor(bytes) + " B";
	bytes /= 1000;
	if (bytes < 1000) return Math.floor(bytes) + " kB";
	bytes /= 1000;
	if (bytes < 1000) return bytes.toFixed(2) + " MB";
	bytes /= 1000;
	if (bytes < 1000) return bytes.toFixed(2) + " GB";
	bytes /= 1000;
	return bytes.toFixed(2) + " TB";
}

export async function fileExists(filePath: string) {
	try {
		const stat = await fs.stat(filePath);
		return stat.isFile();
	} catch (error) {}
	return false;
}

export async function wait(ms: number) {
	await new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}
