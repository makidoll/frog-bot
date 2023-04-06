import { ButtonStyle, MessageFlags } from "discord-api-types/v10";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandBuilder,
} from "discord.js";
import { Categories, Command, ServerExclusiveCategories } from "../../command";
import { froglog } from "../../froglog";
import { MusicQueue } from "../../services/music-queue";
import { formatDuration } from "../../utils";
import { LoopCommand } from "./loop-command";
import { SkipCommand } from "./skip-command";
import { StopCommand } from "./stop-command";

async function playInteraction(
	search: string,
	interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
	const member = interaction.member as GuildMember;
	const channel = member.voice.channel;

	if (channel == null) {
		interaction.reply("aw ribbit... you need to be in a voice channel");
		return;
	}

	await interaction.reply({
		content: "🔍 ribbit, searching for: **" + search + "**",
		flags: MessageFlags.SuppressEmbeds,
	});

	try {
		const metadata = await MusicQueue.instance.getInfo(search);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("play-skip")
				.setLabel("skip")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("⏭️"),
			// TODO: make button turn red or green
			new ButtonBuilder()
				.setCustomId("play-loop")
				.setLabel("loop")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("🔁"),
			new ButtonBuilder()
				.setCustomId("play-stop")
				.setLabel("stop")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("⏹️"),
			new ButtonBuilder()
				.setCustomId("play-queue:" + metadata.videoUrl)
				.setLabel("add this to queue")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("▶️"),
		);

		await interaction.followUp({
			content:
				"🎶 ribbit, found song!\nit's **" +
				formatDuration(metadata.seconds) +
				"** long, froggy adding to queue...\n" +
				metadata.videoUrl,
			components: [row],
		});

		const playOdemonGoodbyeAfter = process.env.DEV
			? true
			: ServerExclusiveCategories[Categories.mechanyx].includes(
					interaction.guildId,
			  );

		await MusicQueue.instance.addToQueue(
			channel,
			interaction.channel,
			metadata,
			playOdemonGoodbyeAfter,
		);
	} catch (error) {
		froglog.error(error);
		interaction.followUp("aw ribbit... something went wrong :(");
	}
}

export const PlayCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("play")
		.setDescription("▶️ add youtube (and many more) songs to queue in vc")
		.addStringOption(option =>
			option
				.setName("search")
				.setDescription("search term or url")
				.setRequired(true),
		),
	onInteraction: async interaction => {
		const search = interaction.options.getString("search", true);
		await playInteraction(search, interaction);
	},

	buttonCustomIds: ["play-skip", "play-loop", "play-stop", "play-queue:*"],
	onButton(interaction) {
		if (interaction.customId == "play-skip") {
			SkipCommand.onInteraction(interaction as any);
		} else if (interaction.customId == "play-loop") {
			LoopCommand.onInteraction(interaction as any);
		} else if (interaction.customId == "play-stop") {
			StopCommand.onInteraction(interaction as any);
		} else if (interaction.customId.startsWith("play-queue:")) {
			playInteraction(
				interaction.customId.slice("play-queue:".length),
				interaction as any,
			);
		}
	},
};
