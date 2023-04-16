import { SlashCommandBuilder } from "@discordjs/builders";
import { ClientUser } from "discord.js";
import execa from "execa";
import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";
import { Writable } from "stream";
import { Categories, Command } from "../../command.js";
import { froglog } from "../../froglog.js";
import {
	circleCrop,
	getMagickPath,
	makeGif,
	rembg,
} from "../../image-utils.js";
import { downloadToBuffer, getUsernameAndAvatarURL } from "../../utils.js";

const options = {
	squish: 1.25,
	scale: 0.875,
	spriteX: 14,
	spriteY: 20,
	spriteWidth: 112,
	spriteHeight: 112,
	// gif related
	delay: 60,
	frames: 5,
};

const offsets = [
	{ x: 0, y: 0, w: 0, h: 0 },
	{ x: -4, y: 12, w: 4, h: -12 },
	{ x: -12, y: 18, w: 12, h: -18 },
	{ x: -8, y: 12, w: 4, h: -12 },
	{ x: -4, y: 0, w: 0, h: 0 },
].map(offset => ({
	x: ~~(options.spriteX + offset.x * (options.squish * 0.4)),
	y: ~~(options.spriteY + offset.y * (options.squish * 0.9)),
	w: ~~((options.spriteWidth + offset.w * options.squish) * options.scale),
	h: ~~((options.spriteHeight + offset.h * options.squish) * options.scale),
}));

async function petpetFrame(
	frame: number,
	avatarImage: Buffer,
	petpetSpriteImage: Buffer,
): Promise<Buffer> {
	if (frame > options.frames - 1) throw new Error("Frame too high");
	const { x, y, w, h } = offsets[frame];

	const magick = await getMagickPath("convert");

	const subprocess = execa(
		magick.path,
		[
			...magick.args,
			"-size",
			`${options.spriteWidth}x${options.spriteWidth}`,
			"xc:none",
			// avatar
			"fd:3", // instead of -
			"-gravity",
			"NorthWest",
			"-geometry",
			`${w}x${h}+${x}+${y}!`,
			"-composite",
			// petpet sprite
			"fd:4", // instead of -
			"-gravity",
			"NorthWest",
			"-geometry",
			`${options.spriteWidth * options.frames}x${options.spriteHeight}-${
				options.spriteWidth * frame
			}+0!`,
			"-composite",
			// output
			"png:-",
		],
		{
			stdio: [
				"pipe", // stdin
				"pipe", // stdout
				"pipe", // stderr
				"pipe",
				"pipe",
			],
			encoding: null,
		},
	);

	(subprocess.stdio[3] as Writable).write(avatarImage);
	(subprocess.stdio[4] as Writable).write(petpetSpriteImage);
	(subprocess.stdio[3] as Writable).end();
	(subprocess.stdio[4] as Writable).end();

	return (await subprocess.finally()).stdout as any;
}

export const PetpetCommand: Command = {
	category: Categories.memesGifs,
	command: new SlashCommandBuilder()
		.setName("petpet")
		.setDescription("👋 pet pet a frend giffy")
		.addUserOption(option =>
			option
				.setName("friend")
				.setDescription("for a 2 frog hug")
				.setRequired(true),
		)
		.addBooleanOption(option =>
			option
				.setName("just-circle-crop")
				.setDescription("dont do ai please")
				.setRequired(false),
		),
	onInteraction: async interaction => {
		interaction.deferReply();

		const user: ClientUser = interaction.options.getUser(
			"friend",
			false,
		) as any;

		const justCircleCrop =
			interaction.options.getBoolean("just-circle-crop");

		const { avatarURL } = await getUsernameAndAvatarURL(
			user ? user : interaction.user,
			interaction.guild,
		);

		try {
			let avatarImage: Buffer = await downloadToBuffer(avatarURL);

			if (justCircleCrop) {
				avatarImage = await circleCrop(avatarImage);
			} else {
				// gifs dont do opacity so post process
				// well, idk its prettier with dithered opacity so dont post process
				avatarImage = await rembg(avatarImage, false);
				avatarImage = await sharp(avatarImage).trim().png().toBuffer();
			}

			const petpetSpriteImage = await fs.readFile(
				path.resolve(__dirname, "../../../assets/petpet-sprite.png"),
			);

			const frames = await Promise.all(
				new Array(5)
					.fill(null)
					.map((_, frame) =>
						petpetFrame(frame, avatarImage, petpetSpriteImage),
					),
			);

			const outputBuffer = await makeGif(
				frames,
				1000 / options.delay,
				100, // quality
			);

			interaction.editReply({
				files: [
					{
						attachment: outputBuffer,
						name: "output.gif",
					},
				],
			});
		} catch (error) {
			interaction.editReply("aw ribbit... it failed sorry :(");
			froglog.error(error);
		}
	},
};
