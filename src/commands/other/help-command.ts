import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { Categories, Command, ServerExclusiveCategories } from "../../command";
import { availableCommands } from "../../main";
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

		content +=
			"oh also i'm part of **" +
			plural(totalServers, "server") +
			"**, yay!\n";

		content += "see me hoppy! 🐛 https://github.com/makifoxgirl/frog-bot";

		interaction.reply({
			content,
			flags: MessageFlags.SuppressEmbeds,
		});
	},
};
