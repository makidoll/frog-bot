import { SlashCommandBuilder } from "@discordjs/builders";
import { ClientUser } from "discord.js";
import * as path from "path";
import { Categories, Command } from "../../command";
import { HtmlRenderer } from "../../services/html-renderer";
import { downloadToDataUri, getDisplayNameAndAvatarURL } from "../../utils";

export const VapourHoldCommand: Command = {
	category: Categories.mechanyx,
	command: new SlashCommandBuilder()
		.setName("vapourhold")
		.setDescription("😥 beware")
		.addUserOption(option =>
			option.setName("foe").setDescription("need foe").setRequired(true),
		),
	onInteraction: async interaction => {
		const user: ClientUser = interaction.options.getUser(
			"foe",
			false,
		) as any;

		const { avatarURL } = await getDisplayNameAndAvatarURL(
			user,
			interaction.guild,
		);

		const buffer = await HtmlRenderer.instance.renderHtml(
			"file://" +
				path.resolve(
					__dirname,
					"../../../assets/vapour-hold/vapour-hold.html",
				),
			async page => {
				await page.setViewportSize({
					width: 990,
					height: 645,
				});
				await page.evaluate(
					"setAvatar(" +
						JSON.stringify(await downloadToDataUri(avatarURL)) +
						")",
				);
				await new Promise(resolve => {
					setTimeout(resolve, 200);
				});
			},
		);

		interaction.reply({
			content: `<@${user.id}>`,
			files: [buffer],
		});
	},
};
