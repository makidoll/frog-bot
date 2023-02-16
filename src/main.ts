import "dotenv/config"; // loads .env file to process.env

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client, Intents } from "discord.js";
import { Rembg } from "rembg-node";
import { Command } from "./command";
import { CouchCommand } from "./commands/frends/couch-command";
import { FrugCommand } from "./commands/frends/frug-command";
import { CasCommand } from "./commands/memes-gifs/cas-command";
import { PetpetCommand } from "./commands/memes-gifs/petpet-command";
import { SquishyCommand } from "./commands/memes-gifs/squishy-command";
import { ComfyCommand } from "./commands/memes/comfy-command";
import { DeepfryCommand } from "./commands/memes/deepfry-command";
import { OmgHiCommand } from "./commands/memes/omg-hi-command";
import { PlayCommand } from "./commands/music/play-command";
import { SkipCommand } from "./commands/music/skip-command";
import { StopCommand } from "./commands/music/stop-command";
import { HelpCommand } from "./commands/other/help-command";
import { RemoveBgCommand } from "./commands/other/remove-bg-command";
import { initReactionRoles } from "./reaction-roles";
import { HtmlRenderer } from "./services/html-renderer";
import { MusicQueue } from "./services/music-queue";
import { TaskQueue } from "./services/task-queue";

export interface Services {
	htmlRenderer: HtmlRenderer;
	rembg: Rembg;
	stableDiffusionQueue: TaskQueue;
	// novelAiQueue: TaskQueue;
	musicQueue: MusicQueue;
}

const services: Services = {
	htmlRenderer: new HtmlRenderer(),
	rembg: new Rembg(),
	stableDiffusionQueue: new TaskQueue(),
	// novelAiQueue: new TaskQueue(),
	musicQueue: new MusicQueue(),
};

services.htmlRenderer.launch();
services.musicQueue.ensureToolsInstalled();

// export const commandPrefix = "frog ";
export const availableCommands: Command[] = [
	HelpCommand,
	CouchCommand,
	FrugCommand,
	ComfyCommand,
	// StableDiffusionCommand,
	// NovelAiCommand,
	CasCommand,
	DeepfryCommand,
	SquishyCommand,
	OmgHiCommand,
	PetpetCommand,
	RemoveBgCommand,
	PlayCommand,
	StopCommand,
	SkipCommand,
];

const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILD_VOICE_STATES,
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
