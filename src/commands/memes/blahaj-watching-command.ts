import { SlashCommandBuilder } from "@discordjs/builders";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { Categories, Command } from "../../command";
import { HtmlRenderer } from "../../services/html-renderer";
import { bufferToDataUri, downloadToBufferAndDataUri } from "../../utils";
import { froglog } from "../../froglog";

const blahajWatchingDir = path.resolve(
	__dirname,
	"../../../assets/blahaj-watching",
);

const blahajWatchingHtmlUrl =
	"file:///" + path.resolve(blahajWatchingDir, "blahaj-watching.html");

const loadImageAsDataUri = (frame: number, filename: string) =>
	bufferToDataUri(
		fs.readFileSync(path.resolve(blahajWatchingDir, filename)),
		"image/png",
	);

const blahajWatchingBaseImage = bufferToDataUri(
	fs.readFileSync(path.resolve(blahajWatchingDir, "blahaj-watching.jpg")),
	"image/png",
);

const blahajWatchingOverlayImage = bufferToDataUri(
	fs.readFileSync(
		path.resolve(blahajWatchingDir, "blahaj-watching-overlay.png"),
	),
	"image/png",
);

const blahajWatchingFragCode = fs.readFileSync(
	path.resolve(blahajWatchingDir, "blahaj-watching.frag"),
	"utf8",
);

export const BlahajWatchingCommand: Command = {
	category: Categories.memes,
	command: new SlashCommandBuilder()
		.setName("blahaj-watching")
		.setDescription("🦈 lots of blahajs are watching your thing!!")
		.addAttachmentOption(option =>
			option
				.setName("image")
				.setDescription("image to put on screen")
				.setRequired(true),
		),
	// .addUserOption(option =>
	// 	option
	// 		.setName("friend")
	// 		.setDescription("need fren")
	// 		.setRequired(true),
	// ),
	onInteraction: async interaction => {
		await interaction.deferReply();

		const image = interaction.options.getAttachment("image", true);

		try {
			const { buffer: imageBuffer, dataUri: imageDataUri } =
				await downloadToBufferAndDataUri(image.url);

			const imageMetadata = await sharp(imageBuffer).metadata();
			const imageAspectRatio = imageMetadata.width / imageMetadata.height;

			const buffer = await HtmlRenderer.instance.renderHtml(
				"file://" +
					path.resolve(
						__dirname,
						"../../../assets/blahaj-watching/blahaj-watching.html",
					),
				async page => {
					await page.setViewportSize({
						width: 640,
						height: 640,
					});
					await page.evaluate(
						"load(" +
							JSON.stringify({
								fragCode: blahajWatchingFragCode,
								baseImage: blahajWatchingBaseImage,
								overlayImage: blahajWatchingOverlayImage,
								userImage: imageDataUri,
								userImageAspectRatio: imageAspectRatio,
							}) +
							")",
					);
					await new Promise(resolve => {
						setTimeout(resolve, 200);
					});
				},
			);

			interaction.editReply({ files: [buffer] });
		} catch (error) {
			interaction.editReply("aw ribbit... it failed sorry :(");
			froglog.error(error);
		}
	},
};
