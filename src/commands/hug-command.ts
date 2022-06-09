import { Message } from "discord.js";
import * as path from "path";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";
import { Command } from "../command";
import { Services } from "../services/services";

const frogHugInfo = {
	"2": { variations: 3 },
	"3": { variations: 1 },
	"4": { variations: 1 },
	"5": { variations: 1 },
	"6": { variations: 1 },
};

const alphabet = "abcdefghijklmnopqrstuvwxyz";

function removeDuplicates(input: any[]) {
	let unique = [];
	for (const item of input) {
		if (!unique.includes(item)) unique.push(item);
	}
	return unique;
}

export const HugCommand: Command = {
	command: "hug",
	shortCommand: "frug",
	help: {
		arguments: "<mention(s)>",
		description:
			"🫂 does a frog hug with frens, or more. yes, 2, 3, 4, 5 or 6 (find me a pic for more lol)",
	},
	onMessage: async (
		argument: string,
		message: Message,
		{ htmlRenderer }: Services,
	) => {
		const usersHugging = removeDuplicates([
			message.author,
			...message.mentions.users.values(),
		]);

		// const usersHugging = [
		// 	message.author,
		// 	message.author,
		// 	message.author,
		// 	message.author,
		// 	message.author,
		// 	message.author,
		// ];

		if (usersHugging.length == 1) {
			message.reply("ribbit! pls mention someone or multiple");
			return;
		}

		if (!Object.keys(frogHugInfo).includes(String(usersHugging.length))) {
			message.reply("ribbit! too many people sorry :(");
			return;
		}

		const { variations } = frogHugInfo[String(usersHugging.length)];

		const filename =
			usersHugging.length +
			(variations > 1
				? alphabet[Math.floor(Math.random() * variations)]
				: "");

		const buffer = await htmlRenderer.renderHtml(
			"file://" +
				path.resolve(
					__dirname,
					"../../assets/frog-hug/" + filename + ".html",
				),
			async page => {
				for (let i = 0; i < usersHugging.length; i++) {
					const { username, avatarURL } =
						await getUsernameAndAvatarURL(
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

				// make shadows and make text fit
				await page.evaluate("postProcess()");

				// get image width and height
				const width = await page.evaluate(
					"document.querySelector('.image').getBoundingClientRect().width",
				);
				const height = await page.evaluate(
					"document.querySelector('.image').getBoundingClientRect().height",
				);

				await page.setViewport({
					width: Math.floor(width),
					height: Math.floor(height),
				});

				// await new Promise(resolve => {
				// 	setTimeout(resolve, 1000000);
				// });

				// using data uris, this speeds this up
				// await page.waitForNetworkIdle();
			},
		);

		message.reply({ files: [buffer] });
	},
};
