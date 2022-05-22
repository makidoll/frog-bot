import { Client, Intents } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import { frogCouchCommand } from "./frog-couch-command";
import { initReactionRoles } from "./reaction-roles";
import { BOT_TOKEN } from "./conts";

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
});

client.on("messageCreate", async message => {
	if (message.author.bot) return;

	if (message.content.toLowerCase() == "frog couch") {
		frogCouchCommand(message, htmlRenderer);
	}
});

client.on("error", error => {
	console.error(error);
	process.exit(1);
});

client.login(BOT_TOKEN).catch(error => {
	console.error(error);
	process.exit(1);
});
