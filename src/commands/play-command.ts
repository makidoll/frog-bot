import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord-api-types/v10";
import { GuildMember } from "discord.js";
import { Categories, Command } from "../command";

export const PlayCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("play")
		.setDescription("▶️ add youtube (and many more) songs to queue in vc")
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

		await interaction.reply({
			content: "🔍 ribbit, searching for: **" + search + "**",
			flags: MessageFlags.SuppressEmbeds,
		});

		try {
			const info = await musicQueue.getInfo(search);

			// await interaction.followUp(
			// 	"🎶 ribbit, found: **" +
			// 		title +
			// 		"**\nit's **" +
			// 		duration_string +
			// 		"** long, froggy adding to queue...",
			// );

			// const embed = new EmbedBuilder()
			// 	.setColor(0x0099ff)
			// 	.setTitle(info.title)
			// 	.setURL(info.webpage_url)
			// 	.setAuthor({
			// 		name: info.uploader,
			// 		// iconURL: "",
			// 		url: info.uploader_url,
			// 	})
			// 	.setImage(info.thumbnail)
			// 	.setFields({
			// 		name: "Duration",
			// 		value: info.duration_string,
			// 		inline: true,
			// 	});

			// await interaction.followUp({
			// 	content: "🎶 ribbit found song! froggy adding to queue...",
			// 	embeds: [embed.data],
			// });

			// await interaction.followUp(
			// 	"🎶 ribbit, found: **" +
			// 		title +
			// 		"**\nit's **" +
			// 		duration_string +
			// 		"** long, froggy adding to queue...",
			// );

			await interaction.followUp(
				"🎶 ribbit, found song!\nit's **" +
					info.duration_string +
					"** long, froggy adding to queue...\n" +
					info.webpage_url,
			);

			musicQueue.addToQueue(channel, info.url, info.title);
		} catch (error) {
			interaction.followUp("aw ribbit... something went wrong :(");
		}
	},
};
