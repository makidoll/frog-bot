import axios from "axios";
import { ClientUser, Guild, User } from "discord.js";

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

export async function getUsernameAndAvatarURL(
	user: User | ClientUser,
	guild: Guild,
) {
	const member = await guild.members.fetch({ user });
	return {
		username: member?.displayName ?? user.username,
		avatarURL:
			member?.displayAvatarURL() ??
			user.avatarURL({ extension: "png", size: 1024, forceStatic: true }),
	};
}

export function stNdRdTh(n: number) {
	const mod = n % 10;
	if (mod == 1) return n + "st";
	else if (mod == 2) return n + "nd";
	else if (mod == 3) return n + "rd";
	else return n + "th";
}

export function plural(n: number, single: string, plural) {
	if (n == 1 || n == -1) return n + " " + single;
	else return n + " " + plural;
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
