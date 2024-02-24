import "dotenv/config"; // loads .env file to process.env

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import {
	ActivityType,
	ButtonInteraction,
	ChatInputCommandInteraction,
	Client,
	ModalSubmitInteraction,
	Partials,
} from "discord.js";
import { availableCommands } from "./available-commands";
import { ServerExclusiveCategories } from "./command";
import { externalEmbedOnMessage } from "./external-embeds";
import { froglog } from "./froglog";
import { initReactionRoles } from "./reaction-roles";
import { Database } from "./services/database";
import { HtmlRenderer } from "./services/html-renderer";
import { MusicQueue } from "./services/music-queue";
import { ToolsManager } from "./tools-manager";
import { initTwitchLiveNotifications } from "./twitch-live-notifications";
import { customIdMatch, plural, shuffleArray } from "./utils";

(async () => {
	if (process.env.DEV != null) {
		froglog.debug("Found DEV env");
	}

	await Database.instance.init();
	await ToolsManager.instance.init();
	await HtmlRenderer.instance.init();
	await MusicQueue.instance.init();

	const client = new Client({
		intents: [
			"Guilds",
			"GuildMessages",
			"GuildMessageReactions",
			"GuildVoiceStates",
			"MessageContent",
		],
		partials: [Partials.Message, Partials.Channel, Partials.Reaction],
	});

	let currentActivityIndex = -1;
	let activities = [
		"hoppy 🌺",
		"ribbit 🐸",
		"squirrel 🐿️",
		"winton 🦍",
		"foxy 🦊",
		"meow 🐱",
		"mooo 🐮",
		"remmy 🐭",
		"hampter 🐹",
		"hedgie 🦔",
		"rouge 🦇",
		"baloo 🐻",
		"slothtje 🦥",
		"otterbox 🦦",
		"chiken 🐔",
		"pengi 🐧",
		"duckusu 🦆",
		"gay raptor 🦖",
		"moby dick 🐋",
		"dolfin 🐬",
		"blahaj 🦈",
		"octopie 🐙",
		"gary 🐌",
		"fairy 🦋",
		"like bug 🐛",
		"bee movie 🐝",
		"wormclub 🪱",
		"do shrooms 🍄",
		"crab rave 🦀",
		"lobster cop 🦞",
		"shrimptje 🦐",
		"squidkid 🦑",
	];

	shuffleArray(activities);

	const setActivity = () => {
		currentActivityIndex++;
		if (currentActivityIndex > activities.length - 1) {
			shuffleArray(activities);
			currentActivityIndex = 0;
		}

		client.user.setActivity({
			name: "you " + activities[currentActivityIndex],
			type: ActivityType.Watching,
			url: "https://makidoll.io",
		});
	};

	client.on("ready", async () => {
		froglog.info(`Logged in as: ${client.user.tag}`);

		// cycle activity every 5 minutes
		setActivity();
		setInterval(setActivity, 1000 * 60 * 5);

		initReactionRoles(client);

		// initReminders(client);

		initTwitchLiveNotifications(client);

		// load music from database if bot restarted
		await MusicQueue.instance.loadFromDatabase(client);

		const rest = new REST({ version: "10" }).setToken(
			process.env.BOT_TOKEN,
		);

		// i think this only worked on api v9, now its in developer applications
		// https://discord.com/developers/applications
		/*
		const bio = `
ribbit! im froggy bot! hoppy 🐸 🌺
• **maki doll made me, i love her so much 💕**
• i was born one day before her birthday wahoo
• **do feature request, do it do it! /featurepls**
https://github.com/makidoll/frog-bot
https://makidoll.io/`.trim();

		rest.patch(Routes.user("@me"), { body: { bio } });
		*/

		froglog.info(
			`Invite link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot+applications.commands`,
		);

		const joinedGuilds = Array.from(client.guilds.cache.values());
		froglog.info(
			`Joined ${plural(joinedGuilds.length, "server")}: ${joinedGuilds
				.map(guild => `"${guild.name}"`)
				.join(", ")}`,
		);

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
		if (interaction.isCommand()) {
			const command = availableCommands.find(
				command => command.command.name == interaction.commandName,
			);

			if (command) {
				try {
					command.onInteraction(
						interaction as ChatInputCommandInteraction,
					);
				} catch (error) {}
			}
		} else if (interaction.isModalSubmit()) {
			const command = availableCommands.find(command =>
				customIdMatch(
					command.modalSubmitCustomIds,
					interaction.customId,
				),
			);

			if (command && command.onModalSubmit) {
				try {
					command.onModalSubmit(
						interaction as ModalSubmitInteraction,
					);
				} catch (error) {}
			}
		} else if (interaction.isButton()) {
			const command = availableCommands.find(command =>
				customIdMatch(command.buttonCustomIds, interaction.customId),
			);

			if (command && command.onButton) {
				try {
					command.onButton(interaction as ButtonInteraction);
				} catch (error) {}
			}
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

	client.on("messageCreate", message => {
		if (message.author.bot) return;

		externalEmbedOnMessage(message);
	});

	client.on("error", error => {
		froglog.error(error);
		process.exit(1);
	});

	client.login(process.env.BOT_TOKEN).catch(error => {
		froglog.error(error);
		process.exit(1);
	});
})();
