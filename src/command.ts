import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";

export interface Command {
	commands: string[];
	onMessage: (
		argument: string,
		message: Message,
		htmlRenderer: HtmlRenderer,
	) => any;
}
