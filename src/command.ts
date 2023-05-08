import {
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";
import {
	ButtonInteraction,
	ChatInputCommandInteraction,
	ModalSubmitInteraction,
} from "discord.js";

export enum Categories {
	other = "🎀 other",
	frends = "🤗 frends",
	memes = "😂 memes",
	memesGifs = "🎞️ memes but gifs",
	music = "🎶 music",
	games = "🎮 games",
	mechanyx = "<:SteamHeart:472359081693413379> mechanyx",
	makisHome = "😇 maki's home",
}

export const ServerExclusiveCategories = {
	[Categories.mechanyx]: [
		"421658983414366210", // steamshell armoury
		"976245585956978688", // vapour chamber
		"699048789377417326", // workshop
	],
	[Categories.makisHome]: ["1086714710008791121"],
};

export interface Command {
	category: Categories;
	command:
		| Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
		| SlashCommandSubcommandsOnlyBuilder;
	onInteraction: (interaction: ChatInputCommandInteraction) => any;

	modalSubmitCustomIds?: string[];
	onModalSubmit?: (interaction: ModalSubmitInteraction) => any;

	buttonCustomIds?: string[];
	onButton?: (interaction: ButtonInteraction) => any;
}
