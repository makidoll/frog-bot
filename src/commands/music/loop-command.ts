import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";
import { Categories, Command } from "../../command";
import { froglog } from "../../froglog";
import { MusicQueue } from "../../services/music-queue";

export const LoopCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("loop")
		.setDescription("🔁 loops current song foreverrr in vc"),
	onInteraction: async interaction => {
		const member = interaction.member as GuildMember;
		const channel = member.voice.channel;

		if (channel == null) {
			interaction.reply("aw ribbit... you need to be in a voice channel");
			return;
		}

		try {
			const looping = MusicQueue.instance.toggleLoop(channel);
			if (looping) {
				await interaction.reply(
					"🔁 🟢 ribbit, **enabled looping** forever current song!",
				);
			} else {
				await interaction.reply(
					"🔁 🔴 ribbit, **disabled looping** not forever anymore",
				);
			}
		} catch (error) {
			froglog.error("Failed to loop current song", error);
			await interaction.reply("aw ribbit, couldn't loop current song");
		}
	},
};
