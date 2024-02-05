import { ButtonStyle } from "discord-api-types/v10";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandBuilder,
} from "discord.js";
import { Categories, Command } from "../../command";
import { MusicQueue } from "../../services/music-queue";

function getReply(joining: boolean) {
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("hang-out-join")
			.setLabel("join")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("🦋"),
		new ButtonBuilder()
			.setCustomId("hang-out-leave")
			.setLabel("leave")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("🍃"),
	);

	return {
		content: joining
			? "🐸 ribbit! ill come hang out with you"
			: "🐸 aw ribbit, okay ill leave",
		components: [row],
	};
}

async function hangOutJoin(interaction: ChatInputCommandInteraction) {
	// start new music queue by leaving first

	const channel = await hangOutLeave(interaction);
	if (channel == null) return;

	await MusicQueue.instance.addToQueue(channel, [
		{
			title: "froggy hanging out silently",
			url: null,
			seconds: Infinity,
			videoUrl: null,
			playlistUrl: null,
			odemonGoodbye: false,
			isLocalStream: true,
			froggyHangOut: true,
		},
	]);
}

async function hangOutLeave(interaction: ChatInputCommandInteraction) {
	// just try leaving music queue

	const member = interaction.member as GuildMember;
	const channel = member.voice.channel;

	if (channel == null) {
		interaction.reply({
			content: "aw ribbit... you need to be in a voice channel",
			ephemeral: true,
		});
		return;
	}

	await MusicQueue.instance.disconnectAndCleanup(channel);

	return channel;
}

export const HangOutCommand: Command = {
	category: Categories.dollhouse,
	command: new SlashCommandBuilder()
		.setName("hang-out")
		.setDescription("🐸 quietly hang out with maki and friends")
		.addBooleanOption(option =>
			option.setName("leave").setDescription("leave instead of join"),
		),

	async onInteraction(interaction) {
		const leaving = interaction.options.getBoolean("leave", false);

		await interaction.reply(getReply(!leaving));

		if (leaving) {
			await hangOutLeave(interaction);
		} else {
			await hangOutJoin(interaction);
		}
	},

	buttonCustomIds: ["hang-out-join", "hang-out-leave"],

	async onButton(interaction) {
		if (interaction.customId == "hang-out-join") {
			await interaction.update(getReply(true));
			await hangOutJoin(interaction as any);
		} else if (interaction.customId == "hang-out-leave") {
			await interaction.update(getReply(false));
			await hangOutLeave(interaction as any);
		}
	},
};
