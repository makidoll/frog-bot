import { SlashCommandBuilder } from "@discordjs/builders";
import * as path from "path";
import { Categories, Command } from "../../command";
import { HtmlRenderer } from "../../services/html-renderer";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../../utils";

export const ToastCommand: Command = {
	category: Categories.memes,
	command: new SlashCommandBuilder()
		.setName("toast")
		.setDescription("🍞 put fren on toast")
		.addUserOption(option =>
			option
				.setName("friend")
				.setDescription("need fren or it'll be self")
				.setRequired(false),
		),
	onInteraction: async interaction => {
		const user = interaction.options.getUser("friend", false);

		const { username, avatarURL } = await getUsernameAndAvatarURL(
			user ? user : interaction.user,
			interaction.guild,
		);

		const buffer = await HtmlRenderer.instance.renderHtml(
			"file://" +
				path.resolve(__dirname, "../../../assets/toast/toast.html"),
			async page => {
				await page.setViewportSize({
					width: 800,
					height: 600,
				});
				await page.evaluate(
					"setNameAndAvatar(" +
						JSON.stringify(username) +
						"," +
						JSON.stringify(await downloadToDataUri(avatarURL)) +
						")",
				);
				await new Promise(resolve => {
					setTimeout(resolve, 200);
				});
			},
		);

		interaction.reply({ files: [buffer] });
	},
};
