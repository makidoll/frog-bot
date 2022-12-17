import { SlashCommandBuilder } from "@discordjs/builders";
import { ClientUser } from "discord.js";
import * as path from "path";
import { Categories, Command } from "../command";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";

export const OmgHiCommand: Command = {
	category: Categories.memes,
	command: new SlashCommandBuilder()
		.setName("omghi")
		.setDescription("😔 im so depressed, but omg hi!! a frend!")
		.addUserOption(option =>
			option
				.setName("friend")
				.setDescription("need fren")
				.setRequired(true),
		),
	onInteraction: async (interaction, { htmlRenderer }) => {
		const user: ClientUser = interaction.options.getUser(
			"friend",
			false,
		) as any;

		const { username, avatarURL } = await getUsernameAndAvatarURL(
			user ? user : interaction.user,
			interaction.guild,
		);

		const buffer = await htmlRenderer.renderHtml(
			"file://" +
				path.resolve(__dirname, "../../assets/omg-hi/omg-hi.html"),
			async page => {
				await page.setViewportSize({
					width: 493,
					height: 579,
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
