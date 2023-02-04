import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";
import { Categories, Command } from "../command";

export const PlayCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("play")
		.setDescription("▶️ add song to queue in vc")
		.addStringOption(option =>
			option
				.setName("search")
				.setDescription("search term or url")
				.setRequired(true),
		),
	onInteraction: async (interaction, { musicQueue }) => {
		const search = interaction.options.getString("search", true);

		const member = interaction.member as GuildMember;
		const channel = member.voice.channel;

		if (channel == null) {
			interaction.reply("aw ribbit... you need to be in a voice channel");
			return;
		}

		await interaction.reply("ribbit, searching for: **" + search + "**");

		let title: string, url: string;

		try {
			const info = await musicQueue.getYoutubeInfo(search);
			title = info.title;
			url = info.url;
		} catch (error) {
			interaction.followUp("aw ribbit... something went wrong :(");
			return;
		}

		await interaction.followUp(
			"ribbit, found: **" + title + "**\nfroggy adding to queue...",
		);

		musicQueue.addToQueue(channel, url, title);
	},
};
