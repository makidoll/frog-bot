import "dotenv/config"; // loads .env file to process.env

import { Client, Intents } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import { initReactionRoles } from "./reaction-roles";
import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Command } from "./command";
import { DalleCommand } from "./commands/dalle-command";
import { FrogComfyCommand } from "./commands/frog-comfy-command";
import { FrogCouchCommand } from "./commands/frog-couch-command";
import { FrogHugCommand } from "./commands/frog-hug-command";
import { CasCommand } from "./commands/cas-command";

const htmlRenderer = new HtmlRenderer();
htmlRenderer.launch();

const allCommands: Command[] = [
	CasCommand,
	DalleCommand,
	FrogComfyCommand,
	FrogCouchCommand,
	FrogHugCommand,
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

	for (let { commands, onMessage } of allCommands) {
		let foundCommand = null;
		for (let command of commands) {
			if (lowerContent.startsWith(command.toLowerCase())) {
				foundCommand = command;
				break;
			}
		}

		if (foundCommand != null) {
			const argument = message.content.substring(foundCommand.length);
			onMessage(argument, message, htmlRenderer);
			break; // dont run other commands
		}
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
