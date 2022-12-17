import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import * as path from "path";
import { Categories, Command } from "../command";
import { Services } from "../main";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";

export const CouchCommand: Command = {
	category: Categories.frends,
	command: new SlashCommandBuilder()
		.setName("couch")
		.setDescription("🛋️ puts the last 4 messages on the frog couch"),
	onInteraction: async (
		interaction: CommandInteraction,

		{ htmlRenderer }: Services,
	) => {
		interaction.deferReply();

		const messages = Array.from(
			(await interaction.channel.messages.fetch({ limit: 5 })).values(),
		)
			.reverse()
			.slice(0, 4);

		const buffer = await htmlRenderer.renderHtml(
			"file://" +
				path.resolve(
					__dirname,
					"../../assets/frog-couch/frog-couch.html",
				),
			async page => {
				for (let i = 0; i < 4; i++) {
					const { username, avatarURL } =
						await getUsernameAndAvatarURL(
							messages[i].author,
							interaction.guild,
						);
					await page.$eval(
						"#username-" + i,
						(e, username) => {
							(e.textContent as any) = username;
						},
						username,
					);
					await page.$eval(
						"#message-" + i,
						(e, message) => {
							(e.textContent as any) = message;
						},
						messages[i].content,
					);
					await page.$eval(
						"#avatar-" + i,
						(e, avatar) => {
							(e as any).style.backgroundImage = `url(${avatar})`;
						},
						await downloadToDataUri(avatarURL),
					);
				}
				await page.setViewportSize({
					width: 600,
					height: 500,
				});
				// await page.waitForNetworkIdle();
			},
		);

		interaction.editReply({ files: [buffer] });
	},
};
