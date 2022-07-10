import { CommandInteraction, Interaction, Message } from "discord.js";
import { Services } from "./services/services";
import {
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";

export enum Categories {
	other = "🎀 other",
	frends = "🤗 frends",
	memes = "😂 memes",
	memesGifs = "🎞️ memes but gifs",
}

export interface Command {
	category: Categories;
	command:
		| Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
		| SlashCommandSubcommandsOnlyBuilder;
	onInteraction: (interaction: CommandInteraction, services: Services) => any;
}
