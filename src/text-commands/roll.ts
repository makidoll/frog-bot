import { Message } from "discord.js";
import { froglog } from "../froglog";
import axios from "axios";

const commandPrefix = "-froll";

const invalidSyntaxMessage = [
	"🎲 ribbit! invalid syntax `(<amount>)d<size>(+<extra>)`",
	"for example: `d6, d20, 1d20, 2d20, 4d20+10`",
	"https://random.org is used for true randomness",
	"if dot • after response, then it's pseudo-random",
].join("\n");

function getSysRolls(n: number, min: number, max: number) {
	const rolls: number[] = [];

	for (let i = 0; i < n; i++) {
		rolls.push(Math.floor(Math.random() * (max - min + 1)) + min);
	}

	return rolls;
}

async function getTrueRolls(
	n: number,
	min: number,
	max: number,
): Promise<number[]> {
	const res = await axios({
		url: "https://api.random.org/json-rpc/4/invoke",
		method: "POST",
		data: {
			id: 42,
			jsonrpc: "2.0",
			method: "generateIntegers",
			params: {
				apiKey: process.env.RANDOM_ORG_API_KEY,
				n,
				min,
				max,
				replacement: true, // like dice roll
			},
		},
	});

	return res.data.result.random.data;
}

async function getRolls(
	n: number,
	size: number,
): Promise<{ rolls: number[]; pseudo: boolean }> {
	if (n > 4) {
		return { rolls: getSysRolls(n, 1, size), pseudo: true };
	}

	try {
		return { rolls: await getTrueRolls(n, 1, size), pseudo: false };
	} catch (error) {
		froglog.error(error);
	}

	return { rolls: getSysRolls(n, 1, size), pseudo: true };
}

const pseudoMsg = (pseudo: boolean) => (pseudo ? " •" : "");

export async function handleRollMessage(message: Message) {
	const msg = message.content.toLowerCase();

	if (!msg.startsWith(commandPrefix)) return false;

	const input = msg.slice(commandPrefix.length).trim();

	if (input == "") {
		const { rolls, pseudo } = await getRolls(1, 6);
		return message.channel.send(
			`🎲 ${rolls[0]} (1 - 6)` + pseudoMsg(pseudo),
		);
	}

	var matches = msg.match(/([0-9]+)?d([0-9]+)(?:(\+|\-)([0-9]+))?/i);
	if (matches == null) return message.channel.send(invalidSyntaxMessage);

	const amount = Number(matches[1] ?? 1);
	if (amount < 1) {
		return message.channel.send(invalidSyntaxMessage);
	}

	const size = Number(matches[2]);
	if (size < 2) return message.channel.send(invalidSyntaxMessage);

	const symbol = matches[3] ?? "+";
	const extra = Number(matches[4] ?? 0) * (symbol == "+" ? 1 : -1);

	const { rolls, pseudo } = await getRolls(amount, size);
	const total = rolls.reduce((a, b) => a + b, 0) + extra;

	const messageStr = `🎲 ${total} [${rolls.join(" ")}]` + pseudoMsg(pseudo);

	if (messageStr.length > 2000) {
		return message.channel.send("🎲 ribbit! response is too big :<");
	}

	return message.channel.send(messageStr);
}
