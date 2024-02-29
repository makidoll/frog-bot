import { SlashCommandBuilder } from "discord.js";
import { Categories, Command } from "../../command";
import { froglog } from "../../froglog";

export const DmSomeoneCommand: Command = {
	category: Categories.dollhouse,
	command: new SlashCommandBuilder()
		.setName("dm-someone")
		.setDescription("💬 send a message to someone if i can")
		.addStringOption(option =>
			option
				.setName("user-id")
				.setDescription("person to send a message to")
				.setRequired(true),
		)
		.addStringOption(option =>
			option
				.setName("message")
				.setDescription("the message to send")
				.setRequired(true),
		),

	onInteraction: async interaction => {
		const userId = interaction.options.getString("user-id");
		const message = interaction.options.getString("message");

		try {
			const user = await interaction.client.users.fetch(userId);

			user.send(message);

			interaction.reply({
				content: `📩 ribbit! ok i sent a message to <@${userId}>, wahoo`,
			});
		} catch (error) {
			froglog.error(error);

			interaction.reply({
				content: `📩 aw ribbit. i failed to send a message to <@${userId}>`,
			});
		}
	},
};
