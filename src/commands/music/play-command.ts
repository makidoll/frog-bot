import { ButtonStyle, MessageFlags } from "discord-api-types/v10";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandBuilder,
} from "discord.js";
import { Categories, Command } from "../../command";
import { froglog } from "../../froglog";
import {
	AudioQueue,
	AudioQueueMetadata,
	MusicQueue,
} from "../../services/music-queue";
import { formatDuration } from "../../utils";
import { LoopCommand } from "./loop-command";
import { ShowQueueCommand } from "./show-queue-command";
import { SkipCommand } from "./skip-command";
import { StopCommand } from "./stop-command";

export function getPlayInteractionComponents(
	metadata: AudioQueueMetadata,
	queue?: AudioQueue,
) {
	let looping = false;
	if (queue != null) looping = queue.looping;

	const isPlaylist = !!metadata.playlistUrl;

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("play-skip")
			.setLabel("skip")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("⏭️"),
		new ButtonBuilder()
			.setCustomId("play-loop")
			.setLabel((looping ? "🟢" : "🔴") + " loop song")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("🔁"),
		new ButtonBuilder()
			.setCustomId("play-stop")
			.setLabel("stop")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("⏹️"),
	);

	try {
		// url could be too long and can throw exception
		const playButton = new ButtonBuilder()
			.setCustomId(
				"play-queue:" +
					(isPlaylist ? metadata.playlistUrl : metadata.videoUrl),
			)
			.setLabel(`add ${isPlaylist ? "playlist" : "song"} to queue`)
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("▶️");
		row.addComponents(playButton);
	} catch (error) {}

	row.addComponents(
		new ButtonBuilder()
			.setCustomId("play-show-queue")
			.setLabel("show queue")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji("🧾"),
	);

	return [row];
}

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
		content: [
			"🔍 ribbit, searching for: **" + search + "**",
			"if it's a playlist, it might take a while",
		].join("\n"),
		flags: MessageFlags.SuppressEmbeds,
	});

	try {
		const metadatas = await MusicQueue.instance.getInfoFromSearch(search);
		const queue = MusicQueue.instance.getAudioQueue(channel);

		if (metadatas.length == 0) {
			throw new Error("Nothing found");
		}

		const isPlaylist = metadatas.length > 1;
		const seconds = isPlaylist
			? metadatas.reduce((total, metadata) => total + metadata.seconds, 0)
			: metadatas[0].seconds;

		const components = getPlayInteractionComponents(metadatas[0], queue);

		const emptyText = " ‍ "; // https://iempty.tooliphone.net/copy-empty-text

		let content: string[] = [];

		if (isPlaylist) {
			content.push(
				`🎶 ribbit, found **${metadatas.length} songs** in a playlist!`,
				`it's **${formatDuration(
					seconds,
				)}** in total, froggy adding all to queue...`,
				metadatas[0].playlistUrl,
			);
		} else {
			if (metadatas[0].livestream) {
				content.push("🎶 ribbit, found livestream!");
			} else {
				content.push(
					"🎶 ribbit, found song!",
					`it's **${formatDuration(
						seconds,
					)}** long, froggy adding to queue...`,
				);
			}

			content.push(metadatas[0].videoUrl);
		}

		const followUpMessage = await interaction.followUp({
			content: [
				...content,
				">  ",
				"> ribbit! if the music is too loud, just turn me down! *right click me in vc*",
				">  " + emptyText,
			].join("\n"),
			components,
		});

		// so it can toggle loop button and send bot disconnected message
		for (const metadata of metadatas) {
			metadata.followUpMessage = followUpMessage;
			metadata.textChannel = interaction.channel;
		}

		await MusicQueue.instance.addToQueue(channel, metadatas);
	} catch (error) {
		froglog.error(error);
		interaction.followUp("aw ribbit... something went wrong :(");
	}
}

export const PlayCommand: Command = {
	category: Categories.music,
	command: new SlashCommandBuilder()
		.setName("play")
		.setDescription(
			"▶️ add youtube (and many more) songs (or playlist) to queue in vc",
		)
		.addStringOption(option =>
			option
				.setName("search-or-url")
				.setDescription("search term or url")
				.setRequired(true),
		),

	onInteraction: async interaction => {
		const search = interaction.options.getString("search-or-url", true);
		await playInteraction(search, interaction);
	},

	buttonCustomIds: [
		"play-skip",
		"play-loop",
		"play-stop",
		"play-queue:*",
		"play-show-queue",
	],
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
		} else if (interaction.customId == "play-show-queue") {
			ShowQueueCommand.onInteraction(interaction as any);
		}
	},
};
