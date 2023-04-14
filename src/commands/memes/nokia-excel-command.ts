import { SlashCommandBuilder } from "@discordjs/builders";
import * as fs from "fs/promises";
import * as path from "path";
import { Categories, Command } from "../../command";
import { layerImages } from "../../image-utils";
import { HtmlRenderer } from "../../services/html-renderer";

export const NokiaExcelCommand: Command = {
	category: Categories.memes,
	command: new SlashCommandBuilder()
		.setName("nokia-excel")
		.setDescription("📱📝 put message on nokia on excel")
		.addStringOption(option =>
			option
				.setName("text")
				.setDescription("to put on nokia on excel")
				.setRequired(true),
		),
	onInteraction: async interaction => {
		const text = interaction.options.getString("text", true);

		const textBuffer = await HtmlRenderer.instance.renderHtml(
			"file://" +
				path.resolve(
					__dirname,
					"../../../assets/nokia-excel/nokia-excel.html",
				),
			async page => {
				await page.setViewportSize({
					width: 720,
					height: 540,
				});
				await page.evaluate("setText(" + JSON.stringify(text) + ")");
			},
		);

		const backgroundBuffer = await fs.readFile(
			path.resolve(
				__dirname,
				"../../../assets/nokia-excel/nokia-excel.png",
			),
		);

		const geometry = {
			width: 720,
			height: 540,
			x: 0,
			y: 0,
		};

		const buffer = await layerImages(geometry.width, geometry.height, [
			{
				buffer: backgroundBuffer,
				...geometry,
			},
			{
				buffer: textBuffer,
				...geometry,
			},
		]);

		interaction.reply({ files: [buffer] });
	},
};
