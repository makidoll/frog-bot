import { Message } from "discord.js";
import { Services } from "./services/services";

export interface Command {
	command: string;
	shortCommand?: string;
	help: {
		arguments: string;
		description: string;
	};
	onMessage: (argument: string, message: Message, services: Services) => any;
}
