import {
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { Services } from "./main";

export enum Categories {
	other = "🎀 other",
	frends = "🤗 frends",
	memes = "😂 memes",
	memesGifs = "🎞️ memes but gifs",
	music = "🎶 music",
	mechanyx = "<:SteamHeart:472359081693413379> mechanyx",
}

export const ServerExclusiveCategories = {
	[Categories.mechanyx]: [
		"421658983414366210", // steamshell armoury
		"976245585956978688", // vapour chamber
		"699048789377417326", // workshop
	],
};

export interface Command {
	category: Categories;
	command:
		| Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
		| SlashCommandSubcommandsOnlyBuilder;
	onInteraction: (
		interaction: ChatInputCommandInteraction,
		services: Services,
	) => any;
}
