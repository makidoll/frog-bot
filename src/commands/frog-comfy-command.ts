import { Message } from "discord.js";
import { HtmlRenderer } from "../html-renderer";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";
import { Command } from "../command";

export const FrogComfyCommand: Command = {
	commands: ["fromfy", "frog comfy"],
	onMessage: async (
		argument: string,
		message: Message,
		htmlRenderer: HtmlRenderer,
	) => {
		const { avatarURL } = await getUsernameAndAvatarURL(
			message.mentions.users.first() ?? message.author,
			message.guild,
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

		message.channel.send({ files: [buffer] });
	},
};
