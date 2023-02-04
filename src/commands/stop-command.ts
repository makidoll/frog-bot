import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";
import { Categories, Command } from "../command";

export const StopCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("stop")
		.setDescription("⏹️ stop playing all songs in vc"),
	onInteraction: async (interaction, { musicQueue }) => {
		const member = interaction.member as GuildMember;
		const channel = member.voice.channel;

		if (channel == null) {
			interaction.reply("aw ribbit... you need to be in a voice channel");
			return;
		}

		await musicQueue.disconnectAndCleanup(channel);

		await interaction.reply("⏹️ ribbit, tried stopped playing");
	},
};
