import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import * as path from "path";

export async function frogCouchCommand(
	message: Message,
	htmlRenderer: HtmlRenderer,
) {
	const messages = Array.from(
		(await message.channel.messages.fetch({ limit: 5 })).values(),
	)
		.reverse()
		.slice(0, 4);

	const buffer = await htmlRenderer.renderHtml(
		"file://" +
			path.resolve(__dirname, "../assets/frog-couch/frog-couch.html"),
		600,
		500,
		async page => {
			for (let i = 0; i < 4; i++) {
				await page.$eval(
					"#username-" + i,
					(e, username) => {
						(e.textContent as any) = username;
					},
					messages[i].author.username,
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
					messages[i].author.displayAvatarURL(),
				);
			}
			await page.waitForNetworkIdle();
		},
	);

	message.channel.send({ files: [buffer] });
}
