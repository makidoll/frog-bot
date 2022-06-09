import { Message } from "discord.js";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";
import { Command } from "../command";
import { Services } from "../services/services";

export const CouchCommand: Command = {
	command: "couch",
	shortCommand: "frouch",
	help: {
		arguments: "",
		description: "🛋️ puts the last 4 messages on the frog couch",
	},
	onMessage: async (
		argument: string,
		message: Message,
		{ htmlRenderer }: Services,
	) => {
		const messages = Array.from(
			(await message.channel.messages.fetch({ limit: 5 })).values(),
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
							message.guild,
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
				await page.setViewport({
					width: 600,
					height: 500,
				});
				// await page.waitForNetworkIdle();
			},
		);

		message.reply({ files: [buffer] });
	},
};
