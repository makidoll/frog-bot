import {
	Client,
	Intents,
	MessageReaction,
	PartialMessageReaction,
	PartialUser,
	TextChannel,
	User,
} from "discord.js";

import { BOT_TOKEN, ROLES_CHANNEL, MESSAGES_TO_ROLES } from "./conts";

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

	// emote emojis to messages

	try {
		const rolesChannel = (await client.channels.fetch(
			ROLES_CHANNEL,
		)) as TextChannel;

		for (const roleMessageId of Object.keys(MESSAGES_TO_ROLES)) {
			const message = await rolesChannel.messages.fetch(roleMessageId);
			if (!message) continue;

			for (const emoji of Object.keys(MESSAGES_TO_ROLES[roleMessageId])) {
				message.react(emoji);
			}
		}
	} catch (error) {
		console.error(error);
	}
});

function manageRoleFromMessageReaction(
	reaction: MessageReaction | PartialMessageReaction,
	user: User | PartialUser,
	method: "ADD" | "REMOVE",
) {
	if (user.id == client.user.id) return;

	const emojiToRoleName = MESSAGES_TO_ROLES[reaction.message.id];
	if (emojiToRoleName == null) return;

	const roleName = emojiToRoleName[reaction.emoji.name];
	if (roleName == null) return;

	const role = reaction.message.guild.roles.cache.find(
		role => role.name.toLowerCase() == roleName.toLowerCase(),
	);
	if (role == null) return;

	const member = reaction.message.guild.members.cache.get(user.id);
	if (member == null) return;

	console.log(member.displayName + " " + method + " " + role.name);

	if (method == "ADD") {
		member.roles.add(role).catch(error => {
			console.error(error);
		});
	} else if (method == "REMOVE") {
		member.roles.remove(role).catch(error => {
			console.error(error);
		});
	}
}

client.on("messageReactionAdd", (reaction, user) => {
	try {
		manageRoleFromMessageReaction(reaction, user, "ADD");
	} catch (error) {}
});

client.on("messageReactionRemove", (reaction, user) => {
	try {
		manageRoleFromMessageReaction(reaction, user, "REMOVE");
	} catch (error) {}
});

client.login(BOT_TOKEN);
