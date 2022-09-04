import {
	Client,
	MessageReaction,
	PartialMessageReaction,
	PartialUser,
	TextChannel,
	User,
} from "discord.js";

const ROLES_CHANNEL = "976645075142594561";
const MESSAGES_TO_ROLES = {
	"976645626437718016": {
		"🟢": "they/them",
		"🔴": "she/her",
		"🔵": "he/him",
		"⚪": "it/its",
		"🟣": "xe/xir",
		"🧚‍♀️": "fae/faer",
		"🟡": "any/all",
	},
	"976647010730004480": {
		"1️⃣": "north america",
		"2️⃣": "south america",
		"3️⃣": "europe",
		"4️⃣": "africa",
		"5️⃣": "asia",
		"6️⃣": "oceania",
		"7️⃣": "outer space",
	},
	"987133656151760966": {
		"🤓": "🤓",
		"😎": "😎",
		"🤠": "🤠",
		"👹": "👹",
		"🤡": "🤡",
		"👽": "👽",
		"🤖": "🤖",
		"🧚": "🧚",
	},
	"988551997298978836": {
		"🎮": "🎮 gaymer",
		"🎧": "🎧 vc friends",
	},
};

function manageRoleFromMessageReaction(
	client: Client,
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

export async function initReactionRoles(client: Client) {
	client.on("messageReactionAdd", (reaction, user) => {
		try {
			manageRoleFromMessageReaction(client, reaction, user, "ADD");
		} catch (error) {}
	});

	client.on("messageReactionRemove", (reaction, user) => {
		try {
			manageRoleFromMessageReaction(client, reaction, user, "REMOVE");
		} catch (error) {}
	});

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
}
