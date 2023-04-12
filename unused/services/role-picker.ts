// 🟢 - they/them
// 🔴 - she/her
// 🔵 - he/him
// ⚪ - it/its
// 🟣 - xe/xir
// 🧚 - fae/faer
// 🟡 - any pronouns

import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	Client,
	GuildTextBasedChannel,
	Message,
} from "discord.js";
import { froglog } from "../../src/froglog";
import { splitArrayInto } from "../../src/utils";

const channelsToMessagesToButtonRoleNameMap: {
	[channelId: string]: {
		[messageId: string]: { [roleLabel: string]: string };
	};
} = {
	// channel id -> message id -> role labels -> role names
	// frog couch
	// "976645075142594561": {
	// 	"976645626437718016": {
	// 		"🟢 they/them": "they/them",
	// 		"🔴 she/her": "she/her",
	// 		"🔵 he/him": "he/him",
	// 		"⚪ it/its": "it/its",
	// 		"🟣 xe/xir": "xe/xir",
	// 		"🧚‍♀️ fae/faer": "fae/faer",
	// 		"🟡 any/all": "any/all",
	// 	},
	// },
	// maki's home
	"1086714710788952138": {
		"1095703246191988736": {
			"🟢 they/them": "they/them",
			"🔴 she/her": "she/her",
			"🔵 he/him": "he/him",
			"⚪ it/its": "it/its",
			"🟣 xe/xir": "xe/xir",
			"🧚‍♀️ fae/faer": "fae/faer",
			"🟡 any/all": "any/all",
		},
	},
};

export class RolePicker {
	private static _instance: RolePicker;

	public static get instance(): RolePicker {
		if (!RolePicker._instance) {
			RolePicker._instance = new RolePicker();
		}
		return RolePicker._instance;
	}

	private constructor() {}

	private client: Client;

	async updateMessages(client: Client) {
		this.client = client;

		for (const [channelId, messagesToButtonRoleNameMap] of Object.entries(
			channelsToMessagesToButtonRoleNameMap,
		)) {
			// get channel!

			let channel: GuildTextBasedChannel;
			try {
				channel = (await client.channels.fetch(channelId)) as any;
			} catch (error) {}

			if (channel == null) {
				froglog.error(
					"Role picker failed to find channel: " + channelId,
				);
				continue;
			}

			for (const [messageId, buttonRoleNameMap] of Object.entries(
				messagesToButtonRoleNameMap,
			)) {
				// get message!

				let message: Message;
				try {
					message = await channel.messages.fetch(messageId);
				} catch (error) {}

				if (message == null) {
					froglog.error(
						"Role picker failed to find message: " + messageId,
					);
					continue;
				}

				// make buttons

				const buttons: ButtonBuilder[] = [];

				for (const [label, roleName] of Object.entries(
					buttonRoleNameMap,
				)) {
					buttons.push(
						new ButtonBuilder()
							.setCustomId(
								"role-picker-" +
									channelId +
									"-" +
									messageId +
									"-" +
									roleName,
							)
							.setLabel(label)
							.setStyle(ButtonStyle.Secondary),
					);
				}

				const splitRowsInto = 4;

				const components = splitArrayInto(buttons, splitRowsInto).map(
					buttons =>
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							buttons,
						),
				);

				// update message!

				// uh, it needs to be a message the bot wrote... aw

				try {
					await message.edit({
						components,
					});
				} catch (error) {
					froglog.error(
						"Role picker failed to update (not find) message: " +
							messageId,
					);
					continue;
				}
			}
		}
	}

	onButtonInteraction(interaction: ButtonInteraction) {
		console.log(interaction.customId);
	}
}
