import {
	Client,
	MessageReaction,
	PartialMessageReaction,
	PartialUser,
	TextChannel,
	User,
} from "discord.js";
import { froglog } from "../froglog";
import { generateRandomId } from "../utils";

interface ReactionInfo {
	mode: "specific" | "any";
	specificRoleMap?: { [emoji: string]: string };
	anyRole?: string;
}

const channelMessageReactionInfo: {
	[channelId: string]: {
		[messageId: string]: ReactionInfo;
	};
} = {
	// frog couch: very-important-rules
	"988555389635268629": {
		"1181293365640298496": {
			mode: "any",
			anyRole: "friendly frog",
		},
	},
	// frog couch: froggy-announcements
	"1214652900714876998": {
		"1264671092472021074": {
			mode: "any",
			anyRole: "politics discussion",
		},
	},
	// frog couch: pronouns-and-roles
	"976645075142594561": {
		"976645626437718016": {
			mode: "specific",
			specificRoleMap: {
				"🟢": "they/them",
				"🔴": "she/her",
				"🔵": "he/him",
				"⚪": "it/its",
				"🟣": "xe/xir",
				"🧚‍♀️": "fae/faer",
				"🟡": "any/all",
			},
		},
		"976647010730004480": {
			mode: "specific",
			specificRoleMap: {
				"🏡": "local peeps",
			},
		},
		"987133656151760966": {
			mode: "specific",
			specificRoleMap: {
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
		},
		"988551997298978836": {
			mode: "specific",
			specificRoleMap: {
				"🎮": "🎮 gaymer",
				"🎧": "🎧 vc friends",
				"🦋": "🦋 moths",
				"📚": "📚 froggy academics",
			},
		},
	},
	// maki's home: bot-testing
	// "1086714710788952138": {
	// 	"1181322145742204928": {
	// 		mode: "any",
	// 		// specificRoleMap: {
	// 		// 	"🎀": "she/her",
	// 		// },
	// 		anyRole: "she/her",
	// 	},
	// },
};

let allMessageEmojiRoleMap: {
	[messageId: string]: ReactionInfo;
} = {};

for (const messageEmojiRoleMap of Object.values(
	channelMessageReactionInfo,
).flat()) {
	for (const [messageId, reactionInfo] of Object.entries(
		messageEmojiRoleMap,
	)) {
		allMessageEmojiRoleMap[messageId] = reactionInfo;
	}
}

let usersCheckingIfAllUnreacted: Map<string, string> = new Map();

async function manageRoleFromMessageReaction(
	client: Client,
	reaction: MessageReaction | PartialMessageReaction,
	user: User | PartialUser,
	method: "ADD" | "REMOVE",
) {
	if (user.id == client.user.id) return;

	const reactionInfo = allMessageEmojiRoleMap[reaction.message.id];
	if (reactionInfo == null) return;

	if (reactionInfo.mode == "specific") {
		// froglog.debug(reaction.emoji.id); // 01928309123
		// froglog.debug(reaction.emoji.identifier); // name:01928309123
		// froglog.debug(reaction.emoji.name); // name

		let roleName = reactionInfo.specificRoleMap[reaction.emoji.name];

		if (roleName == null) {
			for (const [emoji, queryRoleName] of Object.entries(
				reactionInfo.specificRoleMap,
			)) {
				if (emoji.includes(reaction.emoji.identifier)) {
					roleName = queryRoleName;
				}
			}
		}

		if (roleName == null) return;

		const role = reaction.message.guild.roles.cache.find(
			role => role.name.toLowerCase() == roleName.toLowerCase(),
		);

		if (role == null) return;

		const member = reaction.message.guild.members.cache.get(user.id);
		if (member == null) return;

		froglog.info(
			`"${member.displayName}" ${(method == "ADD"
				? 'reacted "~" adding'
				: 'unreacted "~" removing'
			).replace("~", reaction.emoji.name)} "${role.name}"`,
		);

		if (method == "ADD") {
			member.roles.add(role).catch(error => {
				froglog.error(error);
			});
		} else if (method == "REMOVE") {
			member.roles.remove(role).catch(error => {
				froglog.error(error);
			});
		}
	} else if (reactionInfo.mode == "any") {
		const role = reaction.message.guild.roles.cache.find(
			role =>
				role.name.toLowerCase() == reactionInfo.anyRole.toLowerCase(),
		);
		if (role == null) return;

		const member = reaction.message.guild.members.cache.get(user.id);
		if (member == null) return;

		if (method == "ADD") {
			// just give role

			froglog.info(
				`"${member.displayName}" ${
					method == "ADD"
						? 'reacted "any" adding'
						: 'unreacted "any" removing'
				} "${reactionInfo.anyRole}"`,
			);

			member.roles.add(role).catch(error => {
				froglog.error(error);
			});

			// incase we're still checking for all unreacted
			usersCheckingIfAllUnreacted.delete(user.id);

			return;
		}

		// need to fetch channel and message to get all current reactions

		const channel = (await client.channels
			.fetch(reaction.message.channelId)
			.catch(error => {
				froglog.error(
					`"${member.displayName}" unreacted "any" removing "${reactionInfo.anyRole}" but failed to find channel "${reaction.message.channelId}"`,
				);
			})) as TextChannel;

		if (!channel) return;

		const message = await channel.messages
			.fetch(reaction.message.id)
			.catch(error => {
				froglog.error(
					`"${member.displayName}" unreacted "any" removing "${reactionInfo.anyRole}" but failed to find message "${reaction.message.id}" in channel "${reaction.message.channelId}"`,
				);
			});

		if (!message) return;

		const reactions = message.reactions.cache.values();

		// now we just count reactions
		// if we have more than 1 reaction for our user, then just return

		// reaction.users.fetch() takes a long time for some reason
		// it can cause the code to lag behind and make things confusing
		// so we'll generate a random request id and store in a map
		// which will take handle which request should continue

		const requestId = generateRandomId(16);

		usersCheckingIfAllUnreacted.set(user.id, requestId);

		for (const reaction of reactions) {
			// other function already took control
			if (usersCheckingIfAllUnreacted.get(user.id) != requestId) return;

			const users = await reaction.users.fetch();
			if (users.has(user.id)) return;
		}

		// no reactions so lets remove role

		froglog.info(
			`"${member.displayName}" unreacted "all" removing "${reactionInfo.anyRole}"`,
		);

		member.roles.remove(role).catch(error => {
			froglog.error(error);
		});

		usersCheckingIfAllUnreacted.delete(user.id);
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

	for (const [channelId, messageReactionInfo] of Object.entries(
		channelMessageReactionInfo,
	)) {
		const channel = (await client.channels.fetch(channelId).catch(error => {
			froglog.error(`Failed to find role channel "${channelId}"`);
		})) as TextChannel;

		if (!channel) continue;

		for (const [messageId, reactionInfo] of Object.entries(
			messageReactionInfo,
		)) {
			if (reactionInfo.mode != "specific") continue;

			const message = await channel.messages
				.fetch(messageId)
				.catch(error => {
					froglog.error(
						`Failed to find role message "${messageId}" in channel "${channel.name}"`,
					);
				});

			if (!message) continue;

			for (const emoji of Object.keys(reactionInfo.specificRoleMap)) {
				message.react(emoji).catch(error => {
					froglog.error(
						`Failed to react to message "${messageId}" in channel "${channel.name}"`,
					);
				});
			}
		}

		froglog.info(`Reacted emojis to messages in channel "${channel.name}"`);
	}
}
