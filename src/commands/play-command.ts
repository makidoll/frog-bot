import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";
import { Categories, Command } from "../command";

export const PlayCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("play")
		.setDescription("▶️ add youtube search/url to queue in vc")
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

		await interaction.reply("🔍 ribbit, searching for: **" + search + "**");

		try {
			const { title, url, duration_string } =
				await musicQueue.getYoutubeInfo(search);

			await interaction.followUp(
				"🎶 ribbit, found: **" +
					title +
					"**\nit's **" +
					duration_string +
					"** long, froggy adding to queue...",
			);

			musicQueue.addToQueue(channel, url, title);
		} catch (error) {
			interaction.followUp("aw ribbit... something went wrong :(");
		}
	},
};
