import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { availableCommands } from "../../available-commands";
import { Categories, Command, ServerExclusiveCategories } from "../../command";
import { plural } from "../../utils";

export const HelpCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("help")
		.setDescription("📚 shows frog bot help!"),
	onInteraction: interaction => {
		let content = "ribbit! here are my commands! 🐸🌺\n\n";

		const perCategoryHelp = {};

		for (const { command, category } of availableCommands) {
			if (
				ServerExclusiveCategories[category] != null &&
				!ServerExclusiveCategories[category].includes(
					interaction.guildId,
				)
			) {
				continue;
			}

			if (perCategoryHelp[category] == null) {
				perCategoryHelp[category] = "";
			}

			perCategoryHelp[category] +=
				"> **/" + command.name + "** - " + command.description + "\n";
		}

		for (const [category, help] of Object.entries(perCategoryHelp)) {
			content += "> *" + category + "*\n" + help + "\n";
		}

		const totalServers = interaction.client.guilds.cache.size;

		const facts = [
			"suggest new commands with **/featurepls** and i'll try my best~",
			"see me hoppy! 🐛 https://github.com/makidoll/frog-bot",
			"oh also i'm part of **" +
				plural(totalServers, "server") +
				"**, yay!",
		];

		content += facts.map(line => "• " + line).join("\n");

		interaction.reply({
			content,
			flags: MessageFlags.SuppressEmbeds,
		});
	},
};
