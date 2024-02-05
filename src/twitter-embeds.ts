import axios, { all } from "axios";
import { Message } from "discord.js";
import { Categories, ServerExclusiveCategories } from "./command";
import {
	getUploadLimitForGuild,
	thousandsSeparators as thousandsSeparator,
} from "./utils";

export const TwitterEmbedsServers = [
	...ServerExclusiveCategories[Categories.mechanyx],
	...ServerExclusiveCategories[Categories.dollhouse],
];

export async function twitterEmbedOnMessage(message: Message<boolean>) {
	if (!TwitterEmbedsServers.includes(message.guildId)) return;

	const matches = Array.from(
		message.content.matchAll(
			/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([^]+?)\/status\/([0-9]+?)(?:\s|$|[/?])/gi,
		),
	);

	if (matches.length == 0) return;

	try {
		await message.suppressEmbeds(true);
	} catch (error) {
		console.log(error);
	}

	for (const match of matches) {
		try {
			await handleMessage(
				message,
				"/" + match[1] + "/status/" + match[2],
			);
		} catch (error) {
			console.log(error);
		}
	}
}

async function downloadFileToUpload(
	url: string,
	message: Message<boolean>,
): Promise<{ attachment: Buffer; name: string }> {
	try {
		const fileRes = await fetch(url);
		const fileBytes = Number(fileRes.headers.get("content-length"));

		if (fileBytes < getUploadLimitForGuild(message.guild)) {
			return {
				attachment: Buffer.from(await fileRes.arrayBuffer()),
				name: new URL(url).pathname.split("/").pop(),
			};
		}
	} catch (error) {}
}

async function handleMessage(message: Message<boolean>, twitterPath: string) {
	await message.channel.sendTyping();

	const res = await axios<{
		conversationID: string;
		date: string;
		date_epoch: number;
		hashtags: string[];
		likes: number;
		mediaURLs: string[];
		media_extended: {
			altText: null;
			duration_millis: number;
			size: { width: number; height: number };
			thumbnail_url: string;
			type: "video" | "image";
			url: string;
		}[];
		possibly_sensitive: boolean;
		qrtURL: null;
		replies: number;
		retweets: number;
		text: string;
		tweetID: string;
		tweetURL: string;
		user_name: string;
		user_screen_name: string;
	}>("https://api.vxtwitter.com" + twitterPath);

	const tweet = res.data;

	const videoUrl = (tweet.media_extended.find(m => m.type == "video") ?? {})
		.url;

	const allFileUrls =
		videoUrl == null
			? tweet.media_extended
					.filter(m => m.type == "image")
					.map(m => m.url)
			: [videoUrl];

	// download all buffers

	let filesToUpload: { attachment: Buffer; name: string }[] = [];
	let failedUploads: string[] = [];

	for (const fileUrl of allFileUrls) {
		const file = await downloadFileToUpload(fileUrl, message);
		if (file == null) {
			failedUploads.push(fileUrl);
		} else {
			filesToUpload.push(file);
		}
	}

	// TODO: migrate old messages on dollhouse to new format?

	message.reply({
		files: filesToUpload,
		embeds: [
			...failedUploads.map(url => ({
				title: "Click here to see content",
				description:
					"Discord won't let me show you :<\n*(upload size limit and can't embed)*",
				url: url,
			})),
			{
				// author: {
				// 	name: `${tweet.user_name} (@${tweet.user_screen_name})`,
				// 	url: "https://twitter.com/" + tweet.user_screen_name,
				// },
				title: `${tweet.user_name} (@${tweet.user_screen_name})`,
				url: tweet.tweetURL,
				description: tweet.text,
				fields: [
					{
						name: `❤️ ${thousandsSeparator(tweet.likes)}`,
						value: "",
						inline: true,
					},
					{
						name: `🔁 ${thousandsSeparator(tweet.retweets)}`,
						value: "",
						inline: true,
					},
					{
						name: `💬 ${thousandsSeparator(tweet.replies)}`,
						value: "",
						inline: true,
					},
				],
				color: 1942002, // twitter blue
				footer: {
					text: "Twitter",
					// icon_url: ""
				},
				timestamp: new Date(tweet.date).toISOString(),
			},
		],
	});
}
