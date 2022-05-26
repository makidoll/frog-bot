import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import * as path from "path";
import { downloadToDataUri } from "./utils";

export async function frogHugCommand(
	message: Message,
	htmlRenderer: HtmlRenderer,
) {
	const mention = message.mentions.users.first();
	if (mention == null) {
		message.channel.send("ribbit! pls mention someone");
		return;
	}

	const avatars = await Promise.all([
		downloadToDataUri(message.author.avatarURL()),
		downloadToDataUri(mention.avatarURL()),
	]);

	const buffer = await htmlRenderer.renderHtml(
		"file://" + path.resolve(__dirname, "../assets/frog-hug/frog-hug.html"),
		// 1125,
		// 799,
		563,
		400,
		async page => {
			await page.$eval(
				"#from-name",
				(e, username) => {
					(e.textContent as any) = username;
				},
				message.author.username,
			);
			await page.$eval(
				"#from-avatar",
				(e, avatar) => {
					(e as any).src = avatar;
				},
				avatars[0],
			);

			await page.$eval(
				"#to-name",
				(e, username) => {
					(e.textContent as any) = username;
				},
				mention.username,
			);
			await page.$eval(
				"#to-avatar",
				(e, avatar) => {
					(e as any).src = avatar;
				},
				avatars[1],
			);

			// using data uris, speeds this up
			// await page.waitForNetworkIdle();
		},
	);

	message.channel.send({ files: [buffer] });
}
