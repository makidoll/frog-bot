import { CommandInteraction, Interaction, Message } from "discord.js";
import { Services } from "./services/services";
import {
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";

export interface Command {
	command:
		| Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
		| SlashCommandSubcommandsOnlyBuilder;
	onInteraction: (interaction: CommandInteraction, services: Services) => any;
}
