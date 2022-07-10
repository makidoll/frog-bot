import { SlashCommandBuilder } from "@discordjs/builders";
import * as path from "path";
import { Categories, Command } from "../command";
import { downloadToDataUri, getUsernameAndAvatarURL } from "../utils";

const frogHugInfo = {
	"2": { variations: 3 },
	"3": { variations: 1 },
	"4": { variations: 1 },
	"5": { variations: 1 },
	"6": { variations: 1 },
};

const alphabet = "abcdefghijklmnopqrstuvwxyz";

// function removeDuplicates(input: any[]) {
// 	let unique = [];
// 	for (const item of input) {
// 		if (!unique.includes(item)) unique.push(item);
// 	}
// 	return unique;
// }

export const FrugCommand: Command = {
	category: Categories.frends,
	command: new SlashCommandBuilder()
		.setName("frug")
		.setDescription(
			"🫂 does a frog hug with frens, or more. yes, 2, 3, 4, 5 or 6 (find me a pic for more lol)",
		)
		.addUserOption(option =>
			option
				.setName("friend")
				.setDescription("for a 2 frog hug")
				.setRequired(true),
		)
		.addUserOption(option =>
			option
				.setName("friend2")
				.setDescription("for a 3 frog hug")
				.setRequired(false),
		)
		.addUserOption(option =>
			option
				.setName("friend3")
				.setDescription("for a 4 frog hug")
				.setRequired(false),
		)
		.addUserOption(option =>
			option
				.setName("friend4")
				.setDescription("for a 5 frog hug")
				.setRequired(false),
		)
		.addUserOption(option =>
			option
				.setName("friend5")
				.setDescription("for a 6 frog hug")
				.setRequired(false),
		),
	onInteraction: async (interaction, { htmlRenderer }) => {
		await interaction.deferReply();

		// const usersHugging = removeDuplicates([
		const usersHugging = [
			interaction.user,
			interaction.options.getUser("friend"),
			interaction.options.getUser("friend2"),
			interaction.options.getUser("friend3"),
			interaction.options.getUser("friend4"),
			interaction.options.getUser("friend5"),
		].filter(user => user != null);

		// const usersHugging = [
		// 	interaction.author,
		// 	interaction.author,
		// 	interaction.author,
		// 	interaction.author,
		// 	interaction.author,
		// 	interaction.author,
		// ];

		if (usersHugging.length == 1) {
			interaction.reply("ribbit! pls mention someone or multiple");
			return;
		}

		if (!Object.keys(frogHugInfo).includes(String(usersHugging.length))) {
			interaction.reply("ribbit! too many people sorry :(");
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
							interaction.guild,
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

		interaction.editReply({
			content:
				`<@${usersHugging[0].id}> hugged ` +
				usersHugging
					.slice(1)
					.map(user => `<@${user.id}>`)
					.join(" and "),
			files: [buffer],
		});
	},
};
