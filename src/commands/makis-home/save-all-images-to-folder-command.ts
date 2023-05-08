import { SlashCommandBuilder } from "@discordjs/builders";
import { Categories, Command } from "../../command";
import { Message } from "discord.js";
import * as fs from "fs/promises";
import * as path from "path";
import { fileExists, plural } from "../../utils";
import slugify from "slugify";
import axios from "axios";

export const SaveAllImagesToFolderCommand: Command = {
	category: Categories.makisHome,
	command: new SlashCommandBuilder()
		.setName("save-all-images-to-folder")
		.setDescription("🖼️ save all images in channel to a folder"),
	onInteraction: async interaction => {
		await interaction.deferReply();

		const channel = interaction.channel;

		let allMessages: Message<true>[] = [];

		let allFetched = false;
		let lastMessageId = interaction.id;

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
			slugify(interaction.guild.name, slugifyOptions),
			slugify(interaction.channel.name, slugifyOptions),
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

		interaction.editReply(
			`ribbit! already saved **${plural(
				alreadySaved,
				"image",
			)}** and added **${imagesAdded} more**\n\`${saveDir}\``,
		);
	},
};
