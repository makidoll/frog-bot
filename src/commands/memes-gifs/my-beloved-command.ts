import { SlashCommandBuilder } from "@discordjs/builders";
import { ClientUser } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { Categories, Command } from "../../command.js";
import { froglog } from "../../froglog.js";
import { makeGif } from "../../image-utils.js";
import { HtmlRenderer } from "../../services/html-renderer.js";
import {
	bufferToDataUri,
	downloadToDataUri,
	getUsernameAndAvatarURL,
	wait,
} from "../../utils.js";

interface MyBelovedFrame {
	dark: string;
	mapper: string;
	mapper2: string;
	neutral: string;
}

const myBelovedDir = path.resolve(__dirname, "../../../assets/my-beloved");

const myBelovedHtmlUrl =
	"file:///" + path.resolve(myBelovedDir, "my-beloved.html");

const loadImageAsDataUri = (frame: number, filename: string) =>
	bufferToDataUri(
		fs.readFileSync(path.resolve(myBelovedDir, filename)),
		"image/png",
	);

const myBelovedFrames: MyBelovedFrame[] = new Array(39)
	.fill(null)
	.map((_, i) => ({
		dark: loadImageAsDataUri(i, `frames/${i}_dark.png`),
		mapper: loadImageAsDataUri(i, `frames/${i}_mapper.png`),
		mapper2: loadImageAsDataUri(i, `frames/${i}_mapper2.png`),
		neutral: loadImageAsDataUri(i, `frames/${i}_neutral.png`),
	}));

const myBelovedFramesBig: MyBelovedFrame[] = new Array(39)
	.fill(null)
	.map((_, i) => ({
		dark: loadImageAsDataUri(i, `frames_big/${i}_dark.png`),
		mapper: loadImageAsDataUri(i, `frames_big/${i}_mapper.png`),
		mapper2: loadImageAsDataUri(i, `frames_big/${i}_mapper2.png`),
		neutral: loadImageAsDataUri(i, `frames_big/${i}_neutral.png`),
	}));

const myBelovedFragCode = fs.readFileSync(
	path.resolve(myBelovedDir, "my-beloved.frag"),
	"utf8",
);

export const MyBelovedCommand: Command = {
	category: Categories.memesGifs,
	command: new SlashCommandBuilder()
		.setName("my-beloved")
		.setDescription("💕 make beloved gif")
		.addUserOption(option =>
			option
				.setName("your-beloved")
				.setDescription("frend")
				.setRequired(true),
		)
		.addBooleanOption(option =>
			option
				.setName("high-quality")
				.setDescription("twice the beloved (2x resolution)"),
		)
		.addBooleanOption(option =>
			option.setName("only-image").setDescription("dont make gif"),
		),
	onInteraction: async interaction => {
		await interaction.deferReply();

		const user: ClientUser = interaction.options.getUser(
			"your-beloved",
			true,
		) as any;

		const big = interaction.options.getBoolean("high-quality", false);

		const onlyImage = interaction.options.getBoolean("only-image", false);

		try {
			const { username, avatarURL } = await getUsernameAndAvatarURL(
				user ? user : interaction.user,
				interaction.guild,
			);

			const avatarDataUri = await downloadToDataUri(avatarURL);

			const renderFrame = (frameNumber: number): Promise<Buffer> =>
				HtmlRenderer.instance.renderHtml(
					myBelovedHtmlUrl,
					async page => {
						await page.setViewportSize({
							width: big ? 800 : 400,
							height: big ? 600 : 300,
						});

						// sometimes GlslCanvas.js doesnt load in time
						await wait(100);

						const frameData = {
							name: username,
							big,
							fragCode: myBelovedFragCode,
							images: {
								avatar: avatarDataUri,
								...(big ? myBelovedFramesBig : myBelovedFrames)[
									frameNumber
								],
							},
						};

						await page.evaluate(
							"loadFrame(" + JSON.stringify(frameData) + ")",
						);

						await wait(100);
					},
				);

			const fileNameWithoutExt =
				username.toLowerCase() + "_my_beloved" + (big ? "_big" : "");

			if (onlyImage) {
				const outputBuffer = await renderFrame(
					myBelovedFrames.length - 1,
				);

				interaction.editReply({
					files: [
						{
							attachment: outputBuffer,
							name: fileNameWithoutExt + ".png",
						},
					],
				});
			} else {
				const frames = await Promise.all(
					myBelovedFrames.map((_, i) => renderFrame(i)),
				);

				const outputBuffer = await makeGif(
					frames,
					9, // fps
					100, // quality
				);

				interaction.editReply({
					files: [
						{
							attachment: outputBuffer,
							name: fileNameWithoutExt + ".gif",
						},
					],
				});
			}
		} catch (error) {
			interaction.editReply("aw ribbit... it failed sorry :(");
			froglog.error(error);
		}
	},
};
