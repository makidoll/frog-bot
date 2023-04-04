import { SlashCommandBuilder } from "@discordjs/builders";
import { Categories, Command, ServerExclusiveCategories } from "../../command";
import { availableCommands } from "../../main";
import { plural } from "../../utils";

export const HelpCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("help")
		.setDescription("📚 shows frog bot help!"),
	onInteraction: interaction => {
		let out = "ribbit! here are my commands! 🐸🌺\n\n";

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
			out += "> *" + category + "*\n" + help + "\n";
		}

		const totalServers = interaction.client.guilds.cache.size;

		out +=
			"oh also i'm part of **" +
			plural(totalServers, "server") +
			"**, yay!\n\n";

		out += "see me hoppy! 🐛 https://github.com/makifoxgirl/frog-bot";

		interaction.reply(out);
	},
};
