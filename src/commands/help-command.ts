import { Command } from "../command";
import { availableCommands } from "../main";
import { SlashCommandBuilder } from "@discordjs/builders";

export const HelpCommand: Command = {
	command: new SlashCommandBuilder()
		.setName("help")
		.setDescription("📚 shows frog bot help!"),
	onInteraction: interaction => {
		let out = "ribbit! here are my commands!\n";

		for (const { command } of availableCommands) {
			out += "**/" + command.name + "** - " + command.description + "\n";
		}

		out += "see me hoppy! https://github.com/makifoxgirl/frog-bot";

		interaction.reply(out);
	},
};
