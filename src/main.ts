import "dotenv/config"; // loads .env file to process.env

import { Client, Intents } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import { frogCouchCommand } from "./frog-couch-command";
import { initReactionRoles } from "./reaction-roles";
import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { frogHugCommand } from "./frog-hug-command";

const htmlRenderer = new HtmlRenderer();
htmlRenderer.launch();

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

	const content = message.content.toLowerCase().trim();

	if (content == "frog couch") {
		frogCouchCommand(message, htmlRenderer);
	} else if (content.startsWith("frog hug") || content.startsWith("frug")) {
		frogHugCommand(message, htmlRenderer);
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
