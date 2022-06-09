import { Command } from "../command";
import { availableCommands, commandPrefix } from "../main";

export const HelpCommand: Command = {
	command: "help",
	shortCommand: "frelp",
	help: {
		arguments: "",
		description: "📚 shows this!",
	},
	onMessage: (argument, message) => {
		let out = "ribbit! here are my commands\n";

		for (const command of availableCommands) {
			out +=
				"**" +
				commandPrefix +
				command.command +
				(command.shortCommand ? ", " + command.shortCommand : "") +
				(command.help.arguments ? " " + command.help.arguments : "") +
				"** - " +
				command.help.description +
				"\n";
		}

		message.reply(out);
	},
};
