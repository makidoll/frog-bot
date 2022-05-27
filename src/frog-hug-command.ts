import { Message } from "discord.js";
import { HtmlRenderer } from "./html-renderer";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "./utils";

const frogHugSizes = {
	"2": [563, 400],
	"3": [619, 579],
	"4": [599, 786],
};

function removeDuplicates(input: any[]) {
	let unique = [];
	for (const item of input) {
		if (!unique.includes(item)) unique.push(item);
	}
	return unique;
}

export async function frogHugCommand(
	message: Message,
	htmlRenderer: HtmlRenderer,
) {
	const usersHugging = removeDuplicates([
		message.author,
		...message.mentions.users.values(),
	]);

	if (usersHugging.length == 1) {
		message.channel.send("ribbit! pls mention someone or multiple");
		return;
	}

	if (!Object.keys(frogHugSizes).includes(String(usersHugging.length))) {
		message.channel.send("ribbit! too many people sorry :(");
		return;
	}

	const imageSize = frogHugSizes[String(usersHugging.length)];

	const buffer = await htmlRenderer.renderHtml(
		"file://" +
			path.resolve(
				__dirname,
				"../assets/frog-hug/" + usersHugging.length + ".html",
			),
		imageSize[0],
		imageSize[1],
		async page => {
			for (let i = 0; i < usersHugging.length; i++) {
				const { username, avatarURL } = await getUsernameAndAvatarURL(
					usersHugging[i],
					message.guild,
				);
				await page.$eval(
					"#name-" + i,
					(el, username) => {
						(el.textContent as any) = username;
					},
					username,
				);
				await page.$eval(
					"#avatar-" + i,
					(el, avatar) => {
						(el as any).src = avatar;
					},
					await downloadToDataUri(avatarURL),
				);
			}
			// clone and turn old to shadows
			await page.$$eval(".user", els => {
				for (const el of els) {
					el.parentNode.appendChild(el.cloneNode(true));
					el.className += " shadow";
				}
			});
			// using data uris, this speeds this up
			// await page.waitForNetworkIdle();
		},
	);

	message.channel.send({ files: [buffer] });
}
