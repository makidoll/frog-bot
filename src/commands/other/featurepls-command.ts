import { ModalBuilder, TextInputBuilder } from "@discordjs/builders";
import {
	ActionRowBuilder,
	SlashCommandBuilder,
	TextInputStyle,
} from "discord.js";
import { Categories, Command } from "../../command";

export const FeatureplsCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("featurepls")
		.setDescription("👩‍💻 request a feature for maki to add to me!"),
	// .addStringOption(option =>
	// 	option
	// 		.setName("feature")
	// 		.setDescription("what do you want!")
	// 		.setRequired(true),
	// ),
	onInteraction: async interaction => {
		const modal = new ModalBuilder()
			.setCustomId("featurepls")
			.setTitle("froggy feature request")
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId("feature")
						.setLabel("what feature would you like?")
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true),
				),
			);

		interaction.showModal(modal);
	},
	modalSubmitCustomIds: ["featurepls"],
	onModalSubmit: async interaction => {
		const feature = interaction.fields.getTextInputValue("feature").trim();

		const makiId = "72139729285427200";

		interaction.reply({
			content: `📩 ribbit! ok i sent it, i let <@${makiId}> know, wahoo`,
		});

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
