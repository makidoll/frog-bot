import "dotenv/config"; // loads .env file to process.env

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
	ActivityType,
	ChatInputCommandInteraction,
	Client,
	Partials,
} from "discord.js";
import { Command, ServerExclusiveCategories } from "./command";
import { CouchCommand } from "./commands/frends/couch-command";
import { FrugCommand } from "./commands/frends/frug-command";
import { VapourHoldCommand } from "./commands/mechanyx/vapour-hold";
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
import { froglog } from "./froglog";
import { initReactionRoles } from "./reaction-roles";
import { initReminders } from "./reminders";
import { HtmlRenderer } from "./services/html-renderer";
import { MusicQueue } from "./services/music-queue";
import { TaskQueue } from "./services/task-queue";
import { ToolsManager } from "./tools-manager";

export interface Services {
	htmlRenderer: HtmlRenderer;
	stableDiffusionQueue: TaskQueue;
	// novelAiQueue: TaskQueue;
	musicQueue: MusicQueue;
}

// export const commandPrefix = "frog ";
export const availableCommands: Command[] = [
	// > other
	HelpCommand,
	// NovelAiCommand,
	RemoveBgCommand,
	// StableDiffusionCommand,
	// > frends
	CouchCommand,
	FrugCommand,
	// > memes
	ComfyCommand,
	DeepfryCommand,
	OmgHiCommand,
	// > memes gifs
	CasCommand,
	PetpetCommand,
	SquishyCommand,
	// > music
	PlayCommand,
	StopCommand,
	SkipCommand,
	// > mechanyx
	VapourHoldCommand,
];

(async () => {
	if (process.env.DEV != null) {
		froglog.debug("Found DEV env");
	}

	// TODO: proper dependency injection or singletons please???
	// TODO: also move ai services and commands to unused

	const services: Services = {
		htmlRenderer: new HtmlRenderer(),
		stableDiffusionQueue: new TaskQueue(),
		// novelAiQueue: new TaskQueue(),
		musicQueue: new MusicQueue(),
	};

	await ToolsManager.instance.checkForTools();

	services.htmlRenderer.launch();

	const client = new Client({
		intents: [
			"Guilds",
			"GuildMessages",
			"GuildMessageReactions",
			"GuildVoiceStates",
		],
		partials: [Partials.Message, Partials.Channel, Partials.Reaction],
	});

	client.on("ready", async () => {
		froglog.info(`Logged in as: ${client.user.tag}`);

		client.user.setPresence({
			activities: [
				{
					name: "you hoppy ribbit",
					type: ActivityType.Watching,
					url: "https://maki.cafe",
				},
			],
		});

		initReactionRoles(client);

		initReminders(client);

		const rest = new REST({ version: "9" }).setToken(process.env.BOT_TOKEN);

		if (process.env.DEV != null) {
			froglog.info(
				"DEV env set to true, ignoring server exclusive categories",
			);

			// if dev just do all
			rest.put(Routes.applicationCommands(client.user.id), {
				body: availableCommands.map(command =>
					command.command.toJSON(),
				),
			});
		} else {
			// all non server exclusive categories

			rest.put(Routes.applicationCommands(client.user.id), {
				body: availableCommands
					.filter(
						command =>
							ServerExclusiveCategories[command.category] == null,
					)
					.map(command => command.command.toJSON()),
			});

			// all server exclusive categories

			for (const [category, guildIds] of Object.entries(
				ServerExclusiveCategories,
			)) {
				const body = availableCommands
					.filter(command => command.category == category)
					.map(command => command.command.toJSON());

				for (const guildId of guildIds) {
					rest.put(
						Routes.applicationGuildCommands(
							client.user.id,
							guildId,
						),
						{
							body,
						},
					).catch(error => {
						if (error.code == 50001) {
							froglog.error(
								"Missing access to server for exclusive category: \n> Category: " +
									category +
									"\n> Server ID: " +
									guildId,
							);
						}
					});
				}
			}
		}
	});

	client.on("interactionCreate", interaction => {
		if (!interaction.isCommand()) return;

		const command = availableCommands.find(
			command => command.command.name == interaction.commandName,
		);

		if (command) {
			// we're not using MessageContextMenu or UserContextMenu interactions
			try {
				command.onInteraction(
					interaction as ChatInputCommandInteraction,
					services,
				);
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
		froglog.error(error);
		process.exit(1);
	});

	client.login(process.env.BOT_TOKEN).catch(error => {
		froglog.error(error);
		process.exit(1);
	});
})();
