import {
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { Services } from "./main";

export enum Categories {
	other = "🎀 other",
	frends = "🤗 frends",
	memes = "😂 memes",
	memesGifs = "🎞️ memes but gifs",
	music = "🎵 music",
}

export interface Command {
	category: Categories;
	command:
		| Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
		| SlashCommandSubcommandsOnlyBuilder;
	onInteraction: (interaction: CommandInteraction, services: Services) => any;
}
