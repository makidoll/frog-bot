import "dotenv/config"; // loads .env file to process.env

import { Client, Intents } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import { initReactionRoles } from "./reaction-roles";
import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Command } from "./command";
import { DalleCommand } from "./commands/dalle-command";
import { ComfyCommand } from "./commands/comfy-command";
import { CouchCommand } from "./commands/couch-command";
import { HugCommand } from "./commands/hug-command";
import { CasCommand } from "./commands/cas-command";
import { HelpCommand } from "./commands/help-command";

const htmlRenderer = new HtmlRenderer();
htmlRenderer.launch();

export const commandPrefix = "frog ";
export const availableCommands: Command[] = [
	HelpCommand,
	CouchCommand,
	HugCommand,
	ComfyCommand,
	DalleCommand,
	CasCommand,
];

const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
	],
	partials: ["MESSAGE", "CHANNEL", "REACTION"],
});

client.on("ready", async () => {
	console.log(`Logged in as: ${client.user.tag}!`);

	client.user.setPresence({
		activities: [
			{
				name: "you type: frog help",
				type: "WATCHING",
				url: "https://maki.cafe",
			},
		],
	});

	initReactionRoles(client);

	// const command = new SlashCommandBuilder()
	// 	.setName("gif")
	// 	.setDescription("Sends a random gif!")
	// 	.addStringOption(option =>
	// 		option
	// 			.setName("category")
	// 			.setDescription("The gif category")
	// 			.setRequired(true)
	// 			.addChoices({
	// 				name: "Funny",
	// 				value: "gif_funny",
	// 			})
	// 			.addChoices({
	// 				name: "Meme",
	// 				value: "gif_meme",
	// 			})
	// 			.addChoices({
	// 				name: "Movie",
	// 				value: "gif_movie",
	// 			}),
	// 	);

	const rest = new REST({ version: "9" }).setToken(process.env.BOT_TOKEN);

	rest.put(Routes.applicationCommands(client.user.id), {
		body: [],
	});
});

// client.on("interactionCreate", interaction => {
// 	if (!interaction.isCommand()) return;
// 	console.log(interaction);
// });

client.on("messageCreate", async message => {
	if (message.author.bot) return;

	const lowerContent = message.content.toLowerCase().trim();

	for (let { command, shortCommand, onMessage } of availableCommands) {
		let short = shortCommand;
		let long = commandPrefix + command;

		let commandLength = 0;
		if (lowerContent.startsWith(short)) commandLength = short.length;
		else if (lowerContent.startsWith(long)) commandLength = long.length;

		if (commandLength == 0) continue;

		const argument = message.content.substring(command.length + 1); // 1 for space in betwee
		onMessage(argument, message, htmlRenderer);
		break; // dont run other commands
	}
});

client.on("error", error => {
	console.error(error);
	process.exit(1);
});

client.login(process.env.BOT_TOKEN).catch(error => {
	console.error(error);
	process.exit(1);
});
