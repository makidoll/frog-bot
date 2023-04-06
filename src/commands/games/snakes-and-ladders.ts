import { SlashCommandBuilder } from "@discordjs/builders";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Guild,
	User,
} from "discord.js";
import * as path from "path";
import { Categories, Command } from "../../command";
import { HtmlRenderer } from "../../services/html-renderer";
import {
	downloadToDataUri,
	generateRandomId,
	getUsernameAndAvatarURL,
	possessive,
	possessiveEnding,
} from "../../utils";

interface SnakesAndLaddersPlayer {
	user: User;
	name: string;
	avatar: string;
	position: number; // index 1
}

enum SnakesAndLaddersMoved {
	NotMoved = "NotMoved",
	Snake = "Snake",
	Ladder = "Ladder",
}

class SnakesAndLaddersGame {
	gameId: string;

	private players: SnakesAndLaddersPlayer[] = [];
	private maxPlayers = 4; // for testing, should be 4

	private turnPlayerIndex = 0;
	private started = false;

	private finished = false;
	private playerWon: SnakesAndLaddersPlayer = null;

	private finishPosition = 100;
	private snakesAndLadders: { from: number; to: number }[] = [
		// starts at index 1. no particular order, just whats easiest to infer from picture
		// ladder takes you up
		{ from: 80, to: 99 },
		{ from: 71, to: 92 },
		{ from: 28, to: 76 },
		{ from: 50, to: 67 },
		{ from: 21, to: 42 },
		{ from: 1, to: 38 },
		{ from: 4, to: 14 },
		{ from: 8, to: 30 },
		// snakes brings you down
		{ from: 97, to: 78 },
		{ from: 95, to: 56 },
		{ from: 88, to: 24 },
		{ from: 62, to: 18 },
		{ from: 36, to: 6 },
		{ from: 48, to: 26 },
		{ from: 32, to: 10 },
	];

	private lobbyPath =
		"file://" +
		path.resolve(
			__dirname,
			"../../../assets/snakes-and-ladders/lobby.html",
		);

	private gamePath =
		"file://" +
		path.resolve(__dirname, "../../../assets/snakes-and-ladders/game.html");

	constructor() {
		this.gameId = generateRandomId(16);
	}

	async addPlayer(user: User, guild: Guild) {
		if (this.started) throw new Error("game already started");

		if (this.players.length >= this.maxPlayers)
			throw new Error("the lobby is already full");

		if (this.players.find(player => player.user == user)) {
			throw new Error("you already joined!");
		}

		const { username, avatarURL } = await getUsernameAndAvatarURL(
			user,
			guild,
		);

		this.players.push({
			user,
			name: username,
			avatar: await downloadToDataUri(avatarURL),
			position: 1,
		});
	}

	canJoin() {
		return this.players.length < this.maxPlayers;
	}

	canStart() {
		return this.players.length > 1;
	}

	isFinished() {
		return this.finished;
	}

	playerWhoCanRoll() {
		return this.players[this.turnPlayerIndex];
	}

	playerWhoWon() {
		return this.playerWon;
	}

	start() {
		if (this.started) return;
		this.started = true;
	}

	private nextTurnPlayerIndex() {
		this.turnPlayerIndex++;
		if (this.turnPlayerIndex >= this.players.length) {
			this.turnPlayerIndex = 0;
		}
	}

	private getTogetherWith(playerIndex: number) {
		// excludes self
		const player = this.players[playerIndex];
		return this.players.filter(
			(query, i) => i != playerIndex && query.position == player.position,
		);
	}

	roll(): {
		finished: boolean;
		moved: SnakesAndLaddersMoved;
		dice: number;
		rolledTooFar: boolean;
		from: number;
		toWithoutMoved: number;
		toWithMoved: number;
		togetherWith: SnakesAndLaddersPlayer[];
	} {
		if (this.finished) {
			return {
				finished: true,
				moved: SnakesAndLaddersMoved.NotMoved,
				dice: -1,
				rolledTooFar: false,
				from: -1,
				toWithoutMoved: -1,
				toWithMoved: -1,
				togetherWith: [],
			};
		}

		// 1 to 6
		const dice = Math.floor(Math.random() * 6) + 1;

		const player = this.playerWhoCanRoll();
		const playerIndex = this.turnPlayerIndex;

		const from = player.position;

		player.position += dice;

		// check if too far
		if (player.position > this.finishPosition) {
			player.position -= dice; // move back
			this.nextTurnPlayerIndex();
			return {
				finished: false,
				moved: SnakesAndLaddersMoved.NotMoved,
				dice,
				rolledTooFar: true,
				from,
				toWithoutMoved: player.position,
				toWithMoved: player.position,
				togetherWith: this.getTogetherWith(playerIndex),
			};
		}

		const toWithoutMoved = player.position;

		// check if player needs to be moved
		const snakeOrLadder = this.snakesAndLadders.find(
			snl => snl.from == player.position, // from starts with index 1
		);

		let moved = SnakesAndLaddersMoved.NotMoved;
		if (snakeOrLadder != null) {
			player.position = snakeOrLadder.to;
			if (snakeOrLadder.from < snakeOrLadder.to) {
				moved = SnakesAndLaddersMoved.Ladder;
			} else if (snakeOrLadder.from > snakeOrLadder.to) {
				moved = SnakesAndLaddersMoved.Snake;
			}
		}

		const toWithMoved = player.position;

		// check win condition
		if (player.position == this.finishPosition) {
			this.finished = true;
			this.playerWon = player;
		}

		this.nextTurnPlayerIndex();

		return {
			finished: this.finished,
			moved,
			dice,
			rolledTooFar: false,
			from,
			toWithoutMoved,
			toWithMoved,
			togetherWith: this.getTogetherWith(playerIndex),
		};
	}

	async renderLobby() {
		return await HtmlRenderer.instance.renderHtml(
			this.lobbyPath,
			async page => {
				await page.setViewportSize({
					width: 512,
					height: 320,
				});

				if (this.players.length >= 2) {
					await page.evaluate(
						'updateStartText("lobby full, ready to start!")',
					);
				}

				for (let i = 0; i < this.players.length; i++) {
					const player = this.players[i];

					await page.evaluate(
						"join(" +
							JSON.stringify(i) +
							"," +
							JSON.stringify(player.name) +
							"," +
							JSON.stringify(player.avatar) +
							")",
					);
				}
			},
		);
	}

	async renderGame() {
		return await HtmlRenderer.instance.renderHtml(
			this.gamePath,
			async page => {
				await page.setViewportSize({
					width: 512,
					height: 512,
				});

				const renderPlayers = this.players.map(player => ({
					name: player.name,
					avatar: player.avatar,
				}));

				await page.evaluate(
					"setPlayers(" + JSON.stringify(renderPlayers) + ")",
				);

				for (let i = 0; i < this.players.length; i++) {
					await page.evaluate(
						"movePlayer(" +
							JSON.stringify(i) +
							"," +
							JSON.stringify(this.players[i].position) +
							")",
					);
				}
			},
		);
	}
}

if (global.snakesAndLaddersGames == null) {
	global.snakesAndLaddersGames = new Map<string, SnakesAndLaddersGame>();
}

function getSavedGamesMap(): Map<string, SnakesAndLaddersGame> {
	return global.snakesAndLaddersGames;
}

function saveGame(game: SnakesAndLaddersGame) {
	getSavedGamesMap().set(game.gameId, game);
}

function getGame(gameId: string): SnakesAndLaddersGame {
	return getSavedGamesMap().get(gameId);
}

// TODO: database saving and loading idk

function joinButton(game: SnakesAndLaddersGame) {
	return new ButtonBuilder()
		.setCustomId("snakesladders-join:" + game.gameId)
		.setLabel("🐍 🪜 i want to join!")
		.setStyle(ButtonStyle.Secondary);
}

function startButton(game: SnakesAndLaddersGame) {
	return new ButtonBuilder()
		.setCustomId("snakesladders-start:" + game.gameId)
		.setLabel("🎮 start game!")
		.setStyle(ButtonStyle.Secondary);
}

function rollButton(game: SnakesAndLaddersGame) {
	const { name } = game.playerWhoCanRoll();
	return new ButtonBuilder()
		.setCustomId("snakesladders-roll:" + game.gameId)
		.setLabel("🎲 roll dice, " + name.toLowerCase())
		.setStyle(ButtonStyle.Secondary);
}

export const SnakesAndLaddersCommand: Command = {
	category: Categories.games,
	command: new SlashCommandBuilder()
		.setName("snakesladders")
		.setDescription("🐍 🪜 start a game of snakes and ladders with frends"),
	onInteraction: async interaction => {
		await interaction.deferReply();
		try {
			const game = new SnakesAndLaddersGame();
			saveGame(game);

			await game.addPlayer(interaction.user, interaction.guild);

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				joinButton(game),
			);

			await interaction.editReply({
				files: [await game.renderLobby()],
				components: [row],
				content: "",
			});
		} catch (error) {
			await interaction.editReply(
				"🐍 🪜 aw ribbit... something went wrong :(",
			);
		}
	},
	buttonCustomIds: [
		"snakesladders-join:*",
		"snakesladders-start:*",
		"snakesladders-roll:*",
	],
	async onButton(interaction) {
		const customId = interaction.customId;

		function ribbitMessage(text: string) {
			return "🐍 🪜 ribbit! " + text;
		}

		function errorRibbitMessage(text: string) {
			return "🐍 🪜 aw ribbit... " + text;
		}

		try {
			const split = customId.split(":");
			if (split.length < 2) throw new Error("bad custom id");

			const commandId = split[0];
			const gameId = split[1];

			const game = getGame(gameId);
			if (game == null) {
				await interaction.update({
					files: [], // keep images
					components: [], // but remove buttons
					content: errorRibbitMessage(
						"game not found :( please make a new one",
					),
				});
				return;
			}

			async function renderFinished() {
				const { user } = game.playerWhoWon();

				await interaction.update({
					files: [await game.renderGame()],
					components: [], // remove buttons
					content: ribbitMessage(
						`game finished! <@${user.id}> won!\nthank you so much for playing ❤️`,
					),
				});
			}

			if (commandId == "snakesladders-join") {
				// send emphemeral error
				try {
					await game.addPlayer(interaction.user, interaction.guild);
				} catch (error) {
					await interaction.reply({
						content: errorRibbitMessage(error.message),
						ephemeral: true,
					});
					return;
				}

				const row = new ActionRowBuilder<ButtonBuilder>();
				if (game.canJoin()) {
					row.addComponents(joinButton(game));
				}
				if (game.canStart()) {
					row.addComponents(startButton(game));
				}

				// update game message
				await interaction.update({
					files: [await game.renderGame()],
					components: [row],
					content: "",
				});
			} else if (commandId == "snakesladders-start") {
				if (game.isFinished()) {
					return await renderFinished();
				}

				game.start();

				const row = new ActionRowBuilder<ButtonBuilder>();
				row.addComponents(rollButton(game));

				const { name, user } = game.playerWhoCanRoll();

				const facts = [
					ribbitMessage("the game has started!"),
					`➡️ it's <@${user.id}>${possessiveEnding(name)} turn`,
				];

				// update game message
				await interaction.update({
					files: [await game.renderGame()],
					components: [row],
					content: facts.join("\n"),
				});
			} else if (commandId == "snakesladders-roll") {
				if (game.isFinished()) {
					return await renderFinished();
				}

				const { name, user } = game.playerWhoCanRoll();

				// send emphemeral error if not turn
				if (interaction.user.id != user.id) {
					await interaction.reply({
						content: errorRibbitMessage(
							"it's not your turn, it's " +
								possessive(name).toLowerCase(),
						),
						ephemeral: true,
					});
					return;
				}

				// roll!
				const {
					dice,
					finished,
					moved,
					rolledTooFar,
					from,
					toWithoutMoved,
					toWithMoved,
					togetherWith,
				} = game.roll();

				if (finished) {
					return await renderFinished();
				}

				const facts = [`🎲 <@${user.id}> rolled a **${dice}**`];

				if (rolledTooFar) {
					facts.push("↩️ but it's too far, so **didnt move**");
				} else {
					let emoji = "📈";

					if (moved == SnakesAndLaddersMoved.Ladder) {
						facts.push("🪜 and got **moved up** by a ladder");
					} else if (moved == SnakesAndLaddersMoved.Snake) {
						facts.push("🐍 but got **moved down** by snek");
						emoji = "📉";
					}

					if (moved == SnakesAndLaddersMoved.NotMoved) {
						facts.push(
							`${emoji} went from **${from}** to **${toWithoutMoved}**`,
						);
					} else {
						facts.push(
							`${emoji} went from **${from}** to **${toWithoutMoved}** to **${toWithMoved}**`,
						);
					}
				}

				if (togetherWith.length > 0) {
					facts.push(
						"💕 together with " +
							togetherWith
								.map(player => `<@${player.user.id}>`)
								.join(" and "),
					);
				}

				const playerRollNext = game.playerWhoCanRoll();
				facts.push(
					`➡️ it's <@${playerRollNext.user.id}>${possessiveEnding(
						playerRollNext.name,
					)} turn next`,
				);

				// new buttons
				const row = new ActionRowBuilder<ButtonBuilder>();
				row.addComponents(rollButton(game));

				// update game message
				await interaction.update({
					files: [await game.renderGame()],
					components: [row],
					content: facts.join("\n"),
				});
			}
		} catch (error) {
			// update game message
			console.error(error);
			try {
				await interaction.update({
					// files: [], // keep images
					components: [], // but remove buttons
					content: errorRibbitMessage("something went wrong :("),
				});
			} catch (error) {
				console.error(error);
			}
		}
	},
};
