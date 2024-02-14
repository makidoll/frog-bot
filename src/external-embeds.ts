import axios from "axios";
import { Message, MessageReplyOptions } from "discord.js";
import { Categories, ServerExclusiveCategories } from "./command";
import {
	getUploadLimitForGuild,
	thousandsSeparators as thousandsSeparator,
} from "./utils";

export const ExternalEmbedServers = [
	...ServerExclusiveCategories[Categories.mechanyx],
	...ServerExclusiveCategories[Categories.dollhouse],
];

// TODO: use regex to get all urls first, then do regex on those urls

// TODO: migrate old messages in dollhouse to new format?

const externalEmbeds = [
	{
		regex: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([^]+?)\/status\/([0-9]+?)(?:\s|$|[/?])/gi,
		regexToLink: (match: RegExpMatchArray): string =>
			"https://api.vxtwitter.com/" + match[1] + "/status/" + match[2],
		handler: handleTwitter,
	},
	// {
	// 	regex: /https?:\/\/(?:www\.)?reddit\.com\/(r\/[^]+)(?:\s|$)/gi,
	// 	regexToLink: (match: RegExpMatchArray): string =>
	// 		"https://rxddit.com/" + match[1],
	// 	handler: handleReddit,
	// },
];

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

async function handleTwitter(
	message: Message<boolean>,
	twitterUrl: string,
): Promise<MessageReplyOptions> {
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
			type: "video" | "image" | "gif";
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
	}>(twitterUrl);

	const tweet = res.data;

	const allFileUrls = tweet.media_extended.map(m => m.url);

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

	return {
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
				color: 0x1da1f2, // twitter blue
				footer: {
					text: "Twitter",
					// icon_url: ""
				},
				timestamp: new Date(tweet.date).toISOString(),
			},
		],
	};
}

// async function handleReddit(
// 	message: Message<boolean>,
// 	redditUrl: string,
// ): Promise<MessageReplyOptions> {
// 	await message.channel.sendTyping();

// 	const res = await axios(redditUrl, {
// 		headers: {
// 			"User-Agent": "DiscordBot",
// 		},
// 	});

// 	const dom = new JSDOM(res.data);

// 	const title = dom.window.document.querySelector("og:title").textContent;
// 	console.log(title);

// 	const video = dom.window.document.querySelector("og:video");
// 	console.log(video);

// 	const images = dom.window.document.querySelectorAll("og:image");
// 	console.log(images);

// 	/*
// 	<html>
// 		<head>
// 			<meta property="og:title" content="r/shitposting: Hot" />
// 			<meta property="twitter:title" content="Hot" />
// 			<meta
// 				property="og:url"
// 				content="https://www.reddit.com/r/shitposting/comments/1anr7iv/hot/"
// 			/>
// 			<meta property="og:site_name" content="rxddit.com" />
// 			<meta property="twitter:site" content="rxddit.com" />
// 			<meta property="theme-color" content="#ff581a" />
// 			<meta
// 				property="twitter:player"
// 				content="/v/r/shitposting/comments/1anr7iv/hot/"
// 			/>
// 			<meta
// 				property="og:video"
// 				content="/v/r/shitposting/comments/1anr7iv/hot/"
// 			/>
// 			<meta
// 				property="og:video:secure_url"
// 				content="/v/r/shitposting/comments/1anr7iv/hot/"
// 			/>
// 			<meta property="og:video:type" content="video/mp4" />
// 			<meta property="og:video:width" content="678" />
// 			<meta property="og:video:height" content="480" />
// 			<meta property="twitter:player:width" content="678" />
// 			<meta property="twitter:player:height" content="480" />
// 			<meta property="og:type" content="video.other" />
// 			<meta
// 				http-equiv="Refresh"
// 				content="0; URL=https://reddit.com/1anr7iv"
// 			/>
// 		</head>
// 	</html>
// 	*/

// 	return {
// 		content: title,
// 	};

// 	// const tweet = res.data;

// 	// const videoUrl = (tweet.media_extended.find(m => m.type == "video") ?? {})
// 	// 	.url;

// 	// const allFileUrls =
// 	// 	videoUrl == null
// 	// 		? tweet.media_extended
// 	// 				.filter(m => m.type == "image")
// 	// 				.map(m => m.url)
// 	// 		: [videoUrl];

// 	// // download all buffers

// 	// let filesToUpload: { attachment: Buffer; name: string }[] = [];
// 	// let failedUploads: string[] = [];

// 	// for (const fileUrl of allFileUrls) {
// 	// 	const file = await downloadFileToUpload(fileUrl, message);
// 	// 	if (file == null) {
// 	// 		failedUploads.push(fileUrl);
// 	// 	} else {
// 	// 		filesToUpload.push(file);
// 	// 	}
// 	// }

// 	// return {
// 	// 	files: filesToUpload,
// 	// 	embeds: [
// 	// 		...failedUploads.map(url => ({
// 	// 			title: "Click here to see content",
// 	// 			description:
// 	// 				"Discord won't let me show you :<\n*(upload size limit and can't embed)*",
// 	// 			url: url,
// 	// 		})),
// 	// 		{
// 	// 			// author: {
// 	// 			// 	name: `${tweet.user_name} (@${tweet.user_screen_name})`,
// 	// 			// 	url: "https://twitter.com/" + tweet.user_screen_name,
// 	// 			// },
// 	// 			title: `${tweet.user_name} (@${tweet.user_screen_name})`,
// 	// 			url: tweet.tweetURL,
// 	// 			description: tweet.text,
// 	// 			fields: [
// 	// 				{
// 	// 					name: `❤️ ${thousandsSeparator(tweet.likes)}`,
// 	// 					value: "",
// 	// 					inline: true,
// 	// 				},
// 	// 				{
// 	// 					name: `🔁 ${thousandsSeparator(tweet.retweets)}`,
// 	// 					value: "",
// 	// 					inline: true,
// 	// 				},
// 	// 				{
// 	// 					name: `💬 ${thousandsSeparator(tweet.replies)}`,
// 	// 					value: "",
// 	// 					inline: true,
// 	// 				},
// 	// 			],
// 	// 			color: 0x1da1f2, // twitter blue
// 	// 			footer: {
// 	// 				text: "Twitter",
// 	// 				// icon_url: ""
// 	// 			},
// 	// 			timestamp: new Date(tweet.date).toISOString(),
// 	// 		},
// 	// 	],
// 	// };
// }

export async function externalEmbedOnMessage(message: Message<boolean>) {
	if (!ExternalEmbedServers.includes(message.guildId)) return;

	for (const externalEmbed of externalEmbeds) {
		const matches = Array.from(
			message.content.matchAll(externalEmbed.regex),
		);

		if (matches.length == 0) continue;

		try {
			await message.suppressEmbeds(true);
		} catch (error) {
			console.log(error);
		}

		for (const match of matches) {
			try {
				const reply = await externalEmbed.handler(
					message,
					externalEmbed.regexToLink(match),
				);
				await message.reply(reply);
			} catch (error) {
				console.log(error);
			}
		}
	}
}
