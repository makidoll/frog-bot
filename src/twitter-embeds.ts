import axios from "axios";
import { Message } from "discord.js";
import { Categories, ServerExclusiveCategories } from "./command";
import {
	getUploadLimitForGuild,
	thousandsSeparators as thousandsSeparator,
} from "./utils";

export const TwitterEmbedsServers = [
	...ServerExclusiveCategories[Categories.mechanyx],
	...ServerExclusiveCategories[Categories.makisHome],
];

export async function twitterEmbedOnMessage(message: Message<boolean>) {
	if (!TwitterEmbedsServers.includes(message.guildId)) return;

	const matches = Array.from(
		message.content.matchAll(
			/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([^]+?)\/status\/([0-9]+?)(?:(?:\/)|(?:\s|$))/gi,
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

	const video = tweet.media_extended.find(m => m.type == "video");

	const images =
		video == null
			? tweet.media_extended.filter(m => m.type == "image")
			: [];

	const combinedImageUrl =
		images.length == 0
			? ""
			: images.length == 1
			? images[0].url
			: "https://convert.vxtwitter.com/rendercombined.jpg?imgs=" +
			  encodeURIComponent(images.map(i => i.url).join(","));

	let videoBuffer: Buffer = null;
	let videoFilename = "";

	try {
		if (video != null) {
			const videoRes = await fetch(video.url);
			const videoBytes = Number(videoRes.headers.get("content-length"));

			if (videoBytes < getUploadLimitForGuild(message.guild)) {
				videoBuffer = Buffer.from(await videoRes.arrayBuffer());
				videoFilename = new URL(video.url).pathname.split("/").pop();
			}
		}
	} catch (error) {}

	message.reply({
		files: videoBuffer
			? [
					{
						attachment: videoBuffer,
						name: videoFilename,
					},
			  ]
			: [],
		embeds: [
			...(video != null && videoBuffer == null
				? [
						{
							title: "Click here to see video",
							description:
								"Discord won't let me show you :<\n*(upload size limit and can't embed)*",
							url: video.url,
						},
				  ]
				: []),
			{
				author: {
					name: `${tweet.user_name} (@${tweet.user_screen_name})`,
					url: "https://twitter.com/" + tweet.user_screen_name,
				},
				title: tweet.text,
				url: tweet.tweetURL,
				fields: [
					{
						name: "❤️ Likes",
						value: thousandsSeparator(tweet.likes),
						inline: true,
					},
					{
						name: "🔁 Retweets",
						value: thousandsSeparator(tweet.retweets),
						inline: true,
					},
					{
						name: "💬 Replies",
						value: thousandsSeparator(tweet.replies),
						inline: true,
					},
				],
				...(video != null
					? {
							// bots cant do this :<
							// video: {
							// 	url: video.url,
							// },
							thumbnail: {
								url: video.thumbnail_url,
							},
					  }
					: combinedImageUrl != ""
					? {
							image: {
								url: combinedImageUrl,
							},
					  }
					: {}),
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
