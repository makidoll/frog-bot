import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";
import { Categories, Command } from "../../command";
import { MusicQueue } from "../../services/music-queue";

export const StopCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("stop")
		.setDescription("⏹️ stop playing all songs in vc"),
	onInteraction: async interaction => {
		const member = interaction.member as GuildMember;
		const channel = member.voice.channel;

		if (channel == null) {
			interaction.reply("aw ribbit... you need to be in a voice channel");
			return;
		}

		await MusicQueue.instance.disconnectAndCleanup(channel);

		await interaction.reply("⏹️ ribbit, tried stopped playing");
	},
};
