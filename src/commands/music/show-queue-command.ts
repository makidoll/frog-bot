import { GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Categories, Command } from "../../command";
import { MusicQueue } from "../../services/music-queue";
import { formatDuration } from "../../utils";

export const ShowQueueCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("show-queue")
		.setDescription("🧾 show current queue for music playing"),
	onInteraction: async interaction => {
		const member = interaction.member as GuildMember;
		const channel = member.voice.channel;

		if (channel == null) {
			interaction.reply("aw ribbit... you need to be in a voice channel");
			return;
		}

		const audioQueue = MusicQueue.instance.getAudioQueue(channel);

		const allMetadata = [
			audioQueue.current.metadata,
			...audioQueue.resourcesMetadatas,
		].filter(m => !m.goodbye);

		let content =
			"ribbit! here's the current queue:\n" +
			allMetadata
				.map(
					(m, i) =>
						`${i + 1}. **${m.title}** (${formatDuration(
							m.seconds,
						)}) - ${m.playlistUrl ?? m.videoUrl}`,
				)
				.join("\n");

		// cant be more than 2000 characters
		if (content.length > 2000) {
			content = content.slice(0, 2000 - 3) + "...";
		}

		await interaction.reply({
			content: content,
			flags: MessageFlags.SuppressEmbeds,
		});
	},
};
