import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "./utils";

export async function frogHugCommand(
	message: Message,
	htmlRenderer: HtmlRenderer,
) {
	const toUser = message.mentions.users.first();
	if (toUser == null) {
		message.channel.send("ribbit! pls mention someone");
		return;
	}

	const from = await getUsernameAndAvatarURL(message.author, message.guild);
	const to = await getUsernameAndAvatarURL(toUser, message.guild);

	console.log((await downloadToDataUri(from.avatarURL)).slice(0, 100));

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
				from.username,
			);
			await page.$eval(
				"#from-avatar",
				(e, avatar) => {
					(e as any).src = avatar;
				},
				await downloadToDataUri(from.avatarURL),
			);

			await page.$eval(
				"#to-name",
				(e, username) => {
					(e.textContent as any) = username;
				},
				to.username,
			);
			await page.$eval(
				"#to-avatar",
				(e, avatar) => {
					(e as any).src = avatar;
				},
				await downloadToDataUri(to.avatarURL),
			);

			// using data uris, speeds this up
			// await page.waitForNetworkIdle();
		},
	);

	message.channel.send({ files: [buffer] });
}
