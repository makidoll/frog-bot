import {
	Client,
	MessageReaction,
	PartialMessageReaction,
	PartialUser,
	TextChannel,
	User,
} from "discord.js";
import { froglog } from "./froglog";

const channelMessageEmojiRoleMap: {
	[channelId: string]: { [messageId: string]: { [emoji: string]: string } };
} = {
	// frog couch: very-important-rules
	"988555389635268629": {
		"1181293365640298496": {
			// "<:frogchamp:980305678071660544>": "friendly frog",
			"any-fallback": "friendly frog",
		},
	},
	// frog couch: pronouns-and-roles
	"976645075142594561": {
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
			"<:5021biblicalangel:1064639190010175579>": "😇",
		},
		"988551997298978836": {
			"🎮": "🎮 gaymer",
			"🎧": "🎧 vc friends",
			"🦋": "🦋 moths",
		},
	},
};

let allMessageEmojiRoleMap: {
	[messageId: string]: { [emoji: string]: string };
} = {};

for (const messageEmojiRoleMap of Object.values(
	channelMessageEmojiRoleMap,
).flat()) {
	for (const [messageId, emojiRoleMap] of Object.entries(
		messageEmojiRoleMap,
	)) {
		allMessageEmojiRoleMap[messageId] = emojiRoleMap;
	}
}

function manageRoleFromMessageReaction(
	client: Client,
	reaction: MessageReaction | PartialMessageReaction,
	user: User | PartialUser,
	method: "ADD" | "REMOVE",
) {
	if (user.id == client.user.id) return;

	const emojiToRoleName = allMessageEmojiRoleMap[reaction.message.id];
	if (emojiToRoleName == null) return;

	// froglog.debug(reaction.emoji.id); // 01928309123
	// froglog.debug(reaction.emoji.identifier); // name:01928309123
	// froglog.debug(reaction.emoji.name); // name

	let roleName = emojiToRoleName[reaction.emoji.name];

	if (roleName == null) {
		roleName = (Object.entries(emojiToRoleName).find(entry =>
			entry[0].includes(reaction.emoji.identifier),
		) ?? [null, null])[1];
	}

	if (roleName == null) {
		roleName = (Object.entries(emojiToRoleName).find(
			entry => entry[0] == "any-fallback",
		) ?? [null, null])[1];
	}

	if (roleName == null) return;

	const role = reaction.message.guild.roles.cache.find(
		role => role.name.toLowerCase() == roleName.toLowerCase(),
	);
	if (role == null) return;

	const member = reaction.message.guild.members.cache.get(user.id);
	if (member == null) return;

	froglog.info(member.displayName + " " + method + " " + role.name);

	if (method == "ADD") {
		member.roles.add(role).catch(error => {
			froglog.error(error);
		});
	} else if (method == "REMOVE") {
		member.roles.remove(role).catch(error => {
			froglog.error(error);
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
		for (const [channelId, messageEmojiRoleMap] of Object.entries(
			channelMessageEmojiRoleMap,
		)) {
			const rolesChannel = (await client.channels.fetch(
				channelId,
			)) as TextChannel;

			for (const [roleMessageId, emojiToRole] of Object.entries(
				messageEmojiRoleMap,
			)) {
				const message = await rolesChannel.messages.fetch(
					roleMessageId,
				);

				if (!message) continue;

				for (const emoji of Object.keys(emojiToRole)) {
					message.react(emoji);
				}
			}

			froglog.info("Initialized reaction roles");
		}
	} catch (error) {
		if (error.code == 50001) {
			if (process.env.DEV) {
				froglog.debug(
					"Failed to initialize reaction roles, missing access. Intended when developing",
				);
			} else {
				froglog.error(
					"Failed to initialize reaction roles, missing access",
				);
			}
		} else {
			froglog.error(error);
		}
	}
}
