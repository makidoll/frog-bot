import { SlashCommandBuilder } from "@discordjs/builders";
import axios from "axios";
import axiosRetry from "axios-retry";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	GuildTextBasedChannel,
	Message,
} from "discord.js";
import * as fs from "fs/promises";
import * as path from "path";
import slugify from "slugify";
import { Categories, Command } from "../../command";
import { froglog } from "../../froglog";
import { fileExists, plural } from "../../utils";

axiosRetry(axios, { retries: 3 });

interface SaveImagesResult {
	alreadySaved: number;
	imagesAdded: number;
	saveDir: string;
}

async function saveImages(
	channel: GuildTextBasedChannel,
): Promise<SaveImagesResult> {
	let allMessages: Message<true>[] = [];

	let allFetched = false;
	let lastMessageId = null;

	while (!allFetched) {
		const collection = await channel.messages.fetch({
			limit: 100,
			before: lastMessageId,
		});

		const messages = Array.from(collection.values());
		if (messages.length == 0) {
			allFetched = true;
			break;
		}

		allMessages = [...allMessages, ...messages];
		lastMessageId = messages[messages.length - 1].id;
	}

	const images: { id: string; urls: string[] }[] = [];

	for (const message of allMessages) {
		const attachments = Array.from(message.attachments.values());
		if (attachments.length == 0) continue;

		images.push({ id: message.id, urls: attachments.map(a => a.url) });
	}

	let downloads: { filename: string; url: string }[] = [];

	for (const image of images) {
		if (image.urls.length == 1) {
			const ext = path.extname(new URL(image.urls[0]).pathname);
			downloads.push({
				filename: image.id + ext,
				url: image.urls[0],
			});
		} else {
			downloads = [
				...downloads,
				...image.urls.map((url, i) => {
					const ext = path.extname(new URL(url).pathname);
					return {
						filename: image.id + "-" + (i + 1) + ext,
						url,
					};
				}),
			];
		}
	}

	const slugifyOptions = {
		lower: true,
		strict: true,
	};

	const saveDir = path.resolve(
		__dirname,
		"../../../images/",
		slugify(channel.guild.name, slugifyOptions),
		slugify(channel.name, slugifyOptions),
	);

	fs.mkdir(saveDir, { recursive: true });

	let alreadySaved = 0;
	let imagesAdded = 0;

	for (const { url, filename } of downloads) {
		const savePath = path.resolve(saveDir, filename);

		if (await fileExists(savePath)) {
			alreadySaved++;
			continue;
		}

		const response = await axios(url, {
			method: "GET",
			responseType: "arraybuffer",
		});

		await fs.writeFile(savePath, response.data);

		imagesAdded++;
	}

	return {
		alreadySaved,
		imagesAdded,
		saveDir,
	};
}

async function runCommand(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
	const channelIds = [
		"1089890698926510120", // cute characters
		"1089891680586563665", // cute clothes
		"1089642397450903662", // uwaa whats this
		"1095731990831059074", // mercy and friends
		"1100935621289185380", // samus aran
		"1107284614894071838", // jester flamboyancy
	];

	const channelsAndResults: {
		channel: GuildTextBasedChannel;
		output: string;
	}[] = [];

	for (const channelId of channelIds) {
		const channel = await interaction.guild.channels.fetch(channelId);

		channelsAndResults.push({
			channel: channel as GuildTextBasedChannel,
			output: "*fetching...*",
		});
	}

	let done = false;

	const updateReply = async () => {
		const content = channelsAndResults
			.map(({ channel, output }) => `**${channel.name}:** ${output}`)
			.join("\n\n");

		const components = done
			? [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId("save-images-run-again")
							.setLabel("run save images again")
							.setEmoji("🔄")
							.setStyle(ButtonStyle.Secondary),
					),
			  ]
			: [];

		await interaction.editReply({
			content,
			components,
		});
	};

	await updateReply();

	for (let i = 0; i < channelsAndResults.length; i++) {
		try {
			const { alreadySaved, imagesAdded, saveDir } = await saveImages(
				channelsAndResults[i].channel,
			);

			channelsAndResults[i].output = `ribbit! already saved **${plural(
				alreadySaved,
				"image",
			)}** and added **${imagesAdded} more**\n\`${saveDir}\``;
		} catch (error) {
			froglog.error(error);

			channelsAndResults[i].output = `aw ribbit... something went wrong`;
		}

		if (i >= channelsAndResults.length - 1) {
			done = true;
		}

		await updateReply();
	}
}

export const SaveImagesCommand: Command = {
	category: Categories.makisHome,
	command: new SlashCommandBuilder()
		.setName("save-images")
		.setDescription("🖼️ save images from certain channels to folders"),
	onInteraction: async interaction => {
		await interaction.deferReply();
		await runCommand(interaction);
	},
	buttonCustomIds: ["save-images-run-again"],
	async onButton(interaction) {
		await interaction.deferUpdate();
		await runCommand(interaction);
	},
};
