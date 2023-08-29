import { SlashCommandBuilder } from "@discordjs/builders";
import { ClientUser } from "discord.js";
import * as path from "path";
import { Categories, Command } from "../../command";
import { HtmlRenderer } from "../../services/html-renderer";
import { downloadToDataUri, getDisplayNameAndAvatarURL } from "../../utils";

export const ComfyCommand: Command = {
	category: Categories.memes,
	command: new SlashCommandBuilder()
		.setName("comfy") // fromfy
		.setDescription("🧶 put you or frend in comfy frog")
		.addUserOption(option =>
			option
				.setName("friend")
				.setDescription("need frog fren")
				.setRequired(false),
		),
	onInteraction: async interaction => {
		const user: ClientUser = interaction.options.getUser(
			"friend",
			false,
		) as any;

		const { avatarURL } = await getDisplayNameAndAvatarURL(
			user ? user : interaction.user,
			interaction.guild,
		);

		const buffer = await HtmlRenderer.instance.renderHtml(
			"file://" +
				path.resolve(
					__dirname,
					"../../../assets/frog-comfy/frog-comfy.html",
				),
			async page => {
				await page.$eval(
					"#avatar",
					(el, avatar) => {
						(el as any).src = avatar;
					},
					await downloadToDataUri(avatarURL),
				);
				await page.setViewportSize({
					width: 128,
					height: 127,
				});
			},
		);

		interaction.reply({ files: [buffer] });
	},
};
