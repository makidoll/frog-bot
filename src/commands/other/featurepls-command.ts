import { SlashCommandBuilder } from "@discordjs/builders";
import { Categories, Command } from "../../command";

export const FeatureplsCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("featurepls")
		.setDescription("👩‍💻 request a feature for maki to add to me!")
		.addStringOption(option =>
			option
				.setName("feature")
				.setDescription("what do you want!")
				.setRequired(true),
		),
	onInteraction: async interaction => {
		const feature = interaction.options.getString("feature", true);

		const makiId = "72139729285427200";

		interaction.reply(
			`📩 ribbit! ok i sent it, i let <@${makiId}> know, wahoo`,
		);

		const makiUsers = await interaction.client.users.fetch(makiId);

		makiUsers.send(
			`feature request from <@${interaction.user.id}>, they said:\n` +
				feature
					.split("\n")
					.map(line => "> " + line)
					.join("\n"),
		);
	},
};
