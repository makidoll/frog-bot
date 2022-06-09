import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";

export interface Command {
	command: string;
	shortCommand?: string;
	help: {
		arguments: string;
		description: string;
	};
	onMessage: (
		argument: string,
		message: Message,
		htmlRenderer: HtmlRenderer,
	) => any;
}
