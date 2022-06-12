import { ClientUser } from "discord.js";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";
import { Command } from "../command";
import { SlashCommandBuilder } from "@discordjs/builders";

export const ComfyCommand: Command = {
	command: new SlashCommandBuilder()
		.setName("comfy") // fromfy
		.setDescription("🧶 put you or frend in comfy frog")
		.addUserOption(option =>
			option
				.setName("friend")
				.setDescription("need frog fren")
				.setRequired(false),
		),
	onInteraction: async (interaction, { htmlRenderer }) => {
		const user: ClientUser = interaction.options.getUser(
			"friend",
			false,
		) as any;

		const { avatarURL } = await getUsernameAndAvatarURL(
			user ? user : interaction.user,
			interaction.guild,
		);

		const buffer = await htmlRenderer.renderHtml(
			"file://" +
				path.resolve(
					__dirname,
					"../../assets/frog-comfy/frog-comfy.html",
				),
			async page => {
				await page.$eval(
					"#avatar",
					(el, avatar) => {
						(el as any).src = avatar;
					},
					await downloadToDataUri(avatarURL),
				);
				await page.setViewport({
					width: 128,
					height: 127,
				});
			},
		);

		interaction.reply({ files: [buffer] });
	},
};
