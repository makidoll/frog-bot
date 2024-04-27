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
import { plural, removeDuplicates } from "../../utils";

axiosRetry(axios, { retries: 3 });

interface SaveAttachmentsResult {
	total: number;
	added: number;
	removed: number;
	saveDir: string;
}

async function saveAttachments(
	channel: GuildTextBasedChannel,
): Promise<SaveAttachmentsResult> {
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

	const attachments: { id: string; urls: string[] }[] = [];

	for (const message of allMessages) {
		const msgAttachments = Array.from(message.attachments.values()).map(
			a => a.url,
		);

		// can include video and thumbnail of video. dont know if i want that

		const msgEmbeds = Array.from(message.embeds)
			.map(e => [e?.video?.url, e?.image?.url, , e?.thumbnail?.url])
			.flat();

		const urls = removeDuplicates(
			[...msgAttachments, ...msgEmbeds]
				.filter(url => !(url == null || url == ""))
				// remove video urls that dont resolve to a file.
				// should we ever trust proxied video urls?
				// discord doesnt support that many external services i guess.
				// could also do a yt-dlp but already have `twitter-embeds.ts`
				//
				// oh also like the dumb empty reddit thumbnail.
				// ok there's no way of knowing.
				// TODO: there's also like blurred reddit thumbnails x.x
				.filter(
					url =>
						!(
							url.includes("twitter.com/i/videos/") ||
							url.includes("x.com/i/videos/")
						),
				),
		);

		// if (message.id == "1177889720131403876") {
		// 	console.log(urls);
		// }

		if (urls.length == 0) {
			continue;
		}

		attachments.push({
			id: message.id,
			urls,
		});
	}

	const downloads = attachments
		.map(({ id, urls }) =>
			urls.map((url, i) => {
				let ext = path.extname(new URL(url).pathname) ?? "";
				ext = ext.replace(/:[^]*$/, ""); // remove e.g. :large
				// some urls are proxy links that dont have an extension,
				// but i dont want to have to send a bunch of HEAD requests
				return {
					filename:
						(urls.length == 1 ? id : id + "-" + (i + 1)) + ext,
					url,
					ext,
				};
			}),
		)
		.flat();

	const slugifyOptions = {
		lower: true,
		strict: true,
	};

	const saveDir = path.resolve(
		__dirname,
		"../../../attachments/",
		slugify(channel.guild.name, slugifyOptions),
		slugify(channel.name, slugifyOptions),
	);

	await fs.mkdir(saveDir, { recursive: true });

	// remove attachments that dont need to exist anymore

	let removed = 0;

	const alreadyFilenames = await fs.readdir(saveDir);

	for (const alreadyFilename of alreadyFilenames) {
		if (!downloads.find(d => d.filename == alreadyFilename)) {
			await fs.rm(path.resolve(saveDir, alreadyFilename));
			removed++;
		}
	}

	// download and save

	let added = 0;

	for (const { url, filename } of downloads) {
		if (alreadyFilenames.includes(filename)) {
			continue;
		}

		const savePath = path.resolve(saveDir, filename);

		const response = await axios(url, {
			method: "GET",
			responseType: "arraybuffer",
		});

		await fs.writeFile(savePath, response.data);

		added++;
	}

	return {
		total: downloads.length,
		added,
		removed,
		saveDir,
	};
}

async function runCommand(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
	// media
	// "1089011638511878175", // memes i guess (has too many alternative links)
	const channelIds = [
		// art
		"1183492272130637834", // hatsune miku
		"1192954392199057448", // metroid art
		"1089890698926510120", // girls being cute
		"1089891680586563665", // cute clothes
		"1111560346717663292", // cute cybernetics
		"1116323130550530068", // cute environments
		// squishy squeak
		"1089642397450903662", // uwaa whats this
		"1233214473594994789", // cute ponies
		"1216960791165796535", // popen ponies
		"1095731990831059074", // mercy and friends
		"1144405188023689357", // shiny latex
		"1100935621289185380", // samus aran cute
		"1174591584474501210", // kigurimi dolls
		"1107284614894071838", // jester flamboyancy
		"1110386667791069184", // transformation
		"1132252572636434482", // league of leggings
		"1112773080251641867", // hexcorp drones
		// video games
		"1111793860302090311", // overwatch art
	];

	const categoryResults: {
		[categoryName: string]: {
			channel: GuildTextBasedChannel;
			output: string;
		}[];
	} = {};

	for (const channelId of channelIds) {
		const channel = await interaction.guild.channels.fetch(channelId);

		const categoryName = (channel.parent?.name ?? "").toLowerCase().trim();

		if (categoryResults[categoryName] == null) {
			categoryResults[categoryName] = [];
		}

		categoryResults[categoryName].push({
			channel: channel as GuildTextBasedChannel,
			output: "*fetching...*",
		});
	}

	let done = false;

	const updateReply = async () => {
		const content = Object.keys(categoryResults)
			.map(
				categoryName =>
					`### ${categoryName}\n` +
					categoryResults[categoryName]
						.map(
							({ channel, output }) =>
								`\`${channel.name}:\` ${output}`,
						)
						.join("\n"),
			)
			.join("\n");

		const components = done
			? [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId("save-attachments-run-again")
							.setLabel("run save attachments again")
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

	const categoryResultsValues = Object.values(categoryResults);

	for (
		let categoryIndex = 0;
		categoryIndex < categoryResultsValues.length;
		categoryIndex++
	) {
		const channelsAndResults = categoryResultsValues[categoryIndex];

		for (let i = 0; i < channelsAndResults.length; i++) {
			try {
				const { total, added, removed, saveDir } =
					await saveAttachments(channelsAndResults[i].channel);

				const addedText = added == 0 ? "+0" : `**+${added}**`;
				const removedText = removed == 0 ? "-0" : `**-${removed}**`;

				const output = `${addedText}, ${removedText}, total: ${plural(
					total,
					"attachment",
				)}`;

				channelsAndResults[i].output = output;
			} catch (error) {
				froglog.error(error);

				channelsAndResults[
					i
				].output = `aw ribbit... something went wrong`;
			}

			if (
				categoryIndex >= categoryResultsValues.length - 1 &&
				i >= channelsAndResults.length - 1
			) {
				done = true;
			}

			await updateReply();
		}
	}
}

export const SaveAttachmentsCommand: Command = {
	category: Categories.dollhouse,
	command: new SlashCommandBuilder()
		.setName("save-attachments")
		.setDescription("🖼️ save attachments from certain channels to folders"),
	onInteraction: async interaction => {
		await interaction.deferReply();
		await runCommand(interaction);
	},
	buttonCustomIds: ["save-attachments-run-again"],
	async onButton(interaction) {
		await interaction.deferUpdate();
		await runCommand(interaction);
	},
};
