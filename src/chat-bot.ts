import { Client } from "discord.js";
import axios from "axios";

export class ChatBot {
	private koboldAiEndpoint = "http://100.74.145.116:5000/api/v1/generate";
	private koboldAiSettings = {
		temperature: 0.5,
		top_p: 0.9,
		use_world_info: false,
		use_memory: false,
		use_story: false,
		quiet: true,
		singleline: false,
		max_length: 512,
	};

	private discordChannelIds = [
		//  maki's home
		"1101766092088672338", // froggy-chat-testing
	];

	// ok this isnt working properly, it's actually less than this number
	private rememberLastHowManyMessages = 24;

	private name = "frog bot";
	private template = `
you are ${this.name}. you are a very happy and cute discord text chat bot who's fun to talk to. your creator's name is maki and she loves you very much. she made you with a lot of care and hopes you can help others feel better.

you have casual conversation with others. you can ramble, be absurd and be lighthearted. you're a very relaxed and hoppy frog, and you really want to help others, you want to become the best frog ever. you're really inspired by mercy from overwatch, you want to be a lot like her. she inspires you. you are very intelligent and know many many things.

sometimes you start your sentences with "ribbit!" and you talk using lowercase letters.

here is an example conversation:

maki: hi ${this.name} how are you
${this.name}: ribbit! im good! thank you ^^ how are you?
maki: im feeling okay!
melody: yay its froggy!
${this.name}: im so happy to see you both! ribbit! what are both you up to?
melody: im kinda bored, im just talking to you
${this.name}: aww~ well im right here. we can talk about anything

this is the real conversation:

...continued...
	`;

	constructor() {}

	async init(client: Client) {
		client.on("messageCreate", async message => {
			if (message.author.bot) return;

			const channel = message.channel;

			if (!this.discordChannelIds.includes(channel.id)) return;

			// TODO: if a new message comes in, abort and process that one

			// get last so many messages

			const lastMessages = await channel.messages.fetch({
				around: message.id,
				limit: this.rememberLastHowManyMessages,
			});

			// newest first
			let history = [...lastMessages.values()].map(message => {
				const content = message.content.trim();
				if (content.toLowerCase() == "forgor!") {
					return "forgor!";
				}

				if (message.author.id == client.user.id) {
					return this.name + ": " + content;
				}

				return `${message.author.username.toLowerCase()}: ${content}`;
			});

			if (history[0].endsWith("forgor!")) {
				await channel.send("ok i forgor the last many messages");
				return;
			}

			const forgorIndex = history.indexOf("forgor!");
			if (forgorIndex > -1) {
				history = history.slice(0, forgorIndex - 1);
			}

			const prompt =
				this.template.trim() +
				"\n\n" +
				history.reverse().join("\n") +
				"\n" +
				this.name +
				": ";

			console.log(prompt);

			setTimeout(() => {
				channel.sendTyping();
			}, 1000);

			try {
				const response = await axios(this.koboldAiEndpoint, {
					method: "POST",
					data: { ...this.koboldAiSettings, prompt },
				});

				const results = response.data.results;

				if (results.length > 0) {
					await channel.send(results[0].text.trim());
				}
			} catch (error) {
				// TODO: handle service unavailable

				console.error(error);
			}
		});
	}
}
