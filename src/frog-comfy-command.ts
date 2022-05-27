import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "./utils";

export async function frogComfyCommand(
	message: Message,
	htmlRenderer: HtmlRenderer,
) {
	const { avatarURL } = await getUsernameAndAvatarURL(
		message.mentions.users.first() ?? message.author,
		message.guild,
	);

	const buffer = await htmlRenderer.renderHtml(
		"file://" +
			path.resolve(__dirname, "../assets/frog-comfy/frog-comfy.html"),
		128,
		127,
		async page => {
			await page.$eval(
				"#avatar",
				(el, avatar) => {
					(el as any).src = avatar;
				},
				await downloadToDataUri(avatarURL),
			);
		},
	);

	message.channel.send({ files: [buffer] });
}
