import { MessageFlags, SlashCommandBuilder } from "discord.js";
import execa from "execa";
import { Categories, Command } from "../../command";
import { froglog } from "../../froglog";
import { ToolName, ToolsManager } from "../../tools-manager";
import { formatBytes } from "../../utils";

export const YtDlpCommand: Command = {
	category: Categories.other,
	command: new SlashCommandBuilder()
		.setName("yt-dlp")
		.setDescription(
			"🎥 download videos using yt-dlp and upload them back here",
		)
		.addStringOption(option =>
			option
				.setName("url")
				.setDescription("url to search")
				.setRequired(true),
		),
	onInteraction: async interaction => {
		const inputUrl = interaction.options.getString("url", true);

		await interaction.deferReply();

		try {
			const metadata = await execa(
				await ToolsManager.instance.getPath(ToolName.yt_dlp),
				[
					"-J", //single line json
					"-f",
					"best",
					inputUrl,
				],
				{
					timeout: 0,
					maxBuffer: 100_000_000, // 100 MB
				},
			);

			const data = await execa(
				await ToolsManager.instance.getPath(ToolName.yt_dlp),
				["-f", "best", inputUrl, "--output", "-"],
				{
					timeout: 0,
					maxBuffer: 100_000_000, // 100 MB
					encoding: null, // stdout will be buffer
					buffer: true,
				},
			);

			const { url, ext, title, id } = JSON.parse(metadata.stdout);

			const filename = `${title} [${id}].${ext}`;
			const buffer = data.stdout;

			const maxUploadBytes = 8_000_000; // 8 MB

			if (buffer.length > maxUploadBytes) {
				await interaction.editReply({
					content: `aw ribbit... video is too big for me to upload **(${formatBytes(
						buffer.length,
					)})**\nhere is a temporary url that *might* work:\n${url}`,
					options: {
						flags: MessageFlags.SuppressEmbeds,
					},
				});
				return;
			}

			await interaction.editReply({
				files: [
					{
						attachment: buffer,
						name: filename,
					},
				],
			});
		} catch (error) {
			await interaction.editReply("aw ribbit... it failed sorry :(");
			froglog.error(error);
		}
	},
};
