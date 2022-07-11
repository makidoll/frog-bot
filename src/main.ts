import "dotenv/config"; // loads .env file to process.env

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client, Intents } from "discord.js";
import { Command } from "./command";
import { CasCommand } from "./commands/cas-command";
import { ComfyCommand } from "./commands/comfy-command";
import { CouchCommand } from "./commands/couch-command";
import { DalleCommand } from "./commands/dalle-command";
import { DeepfryCommand } from "./commands/deepfry-command";
import { FrugCommand } from "./commands/frug-command";
import { HelpCommand } from "./commands/help-command";
import { OmgHiCommand } from "./commands/omg-hi-command";
import { PetpetCommand } from "./commands/petpet-command";
import { SquishyCommand } from "./commands/squishy-command";
import { initReactionRoles } from "./reaction-roles";
import { DalleQueue } from "./services/dalle-queue";
import { HtmlRenderer } from "./services/html-renderer";
import { RemoveBg } from "./services/remove-bg";
import { Services } from "./services/services";

const services: Services = {
	htmlRenderer: new HtmlRenderer(),
	dalleQueue: new DalleQueue(),
	removeBg: new RemoveBg(),
};

services.htmlRenderer.launch();

// export const commandPrefix = "frog ";
export const availableCommands: Command[] = [
	HelpCommand,
	CouchCommand,
	FrugCommand,
	ComfyCommand,
	DalleCommand,
	CasCommand,
	DeepfryCommand,
	SquishyCommand,
	OmgHiCommand,
	PetpetCommand,
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
				name: "you hoppy ribbit",
				type: "WATCHING",
				url: "https://maki.cafe",
			},
		],
	});

	initReactionRoles(client);

	const rest = new REST({ version: "9" }).setToken(process.env.BOT_TOKEN);

	rest.put(Routes.applicationCommands(client.user.id), {
		body: availableCommands.map(command => command.command.toJSON()),
	});
});

client.on("interactionCreate", interaction => {
	if (!interaction.isCommand()) return;

	const command = availableCommands.find(
		command => command.command.name == interaction.commandName,
	);

	if (command) {
		try {
			command.onInteraction(interaction, services);
		} catch (error) {}
	}
});

/*
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

		const argument = message.content.substring(command.length + 1).trim();
		onMessage(argument, message, services);
		break; // dont run other commands
	}
});
*/

client.on("error", error => {
	console.error(error);
	process.exit(1);
});

client.login(process.env.BOT_TOKEN).catch(error => {
	console.error(error);
	process.exit(1);
});
