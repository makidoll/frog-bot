var max_tokens = 128;
var temperature = 0.6;
var top_p = 1.0;
var frequency_penalty = 0.6; // was 0.1
var presence_penalty = 0.3;
var best_of = 1;
var restartText = "Human: ";
var stopText = ["Human: ", "human:", "\r\n"];

var chatbotLabel = "AI:";
var humanLabel = "Human:";
var actionLabel = "###";

var engine = "davinci-instruct-beta";
var postURL = "https://api.openai.com/v1/engines/" + engine + "/completions";

var baseInitText = ""; // The initial text that is sent with every post
var chatTranscript = ""; // A record of the entire conversation
var usersPresent = [];

var chatVoiceSound;

//chatInjector.isPlaying());
Chat.showMessage("Initializing openAI.\r\n");

var isProcessing = false;
var muteVoice = false;

function tts(voice, text, action) {
	sound = SoundCache.getSound(
		"http://192.168.1.148:8080/sound.wav?voice=" +
			encodeURIComponent(voice) +
			"&text=" +
			encodeURIComponent(text)
	);
	function play() {
		Chat.sendMessage(text, false, false);
		if (muteVoice) return;
		Audio.playSound(sound, {
			position: MyAvatar.position,
			volume: 0.5
		});
		if (action.length > 0) Chat.sendMessage(action + "\r\n", true, false);
	}
	if (sound.downloaded) {
		play();
	} else {
		sound.ready.connect(play);
	}
}

request(
	{
		method: "GET",
		uri:
			"https://files.tivolicloud.com/caitlyn/open-ai/toastgenie-instruct-2.txt"
		// uri: "https://files.tivolicloud.com/caitlyn/open-ai/toaster-adult.txt"
		// uri: "https://files.tivolicloud.com/caitlyn/open-ai/toaster.txt"
		// uri: "https://files.tivolicloud.com/caitlyn/open-ai/supersmart.txt"
		// uri: "https://files.tivolicloud.com/caitlyn/open-ai/jello.txt"
		// uri: "https://files.tivolicloud.com/caitlyn/open-ai/gpt-chatbot.txt"
		// uri: "https://files.tivolicloud.com/caitlyn/open-ai/marvin.txt"
	},
	receiveInitText
);

function receiveInitText(error, body, initText) {
	Chat.showMessage("Loading init data.\r\n");

	if (error) {
		console.error(error);
		return;
	}

	var prompt = "";
	var answer = "";

	initChatBot();
	new_prompt = initText.trim();

	function sendToSearch(message) {
		

		console.log("SEND TO SEARCH: "+ message);

		request(
			{
				method: "POST",
				uri: "https://api.openai.com/v1/engines/ada/search",
				json: true,
				headers: {
					Authorization:
						"Bearer sk-RX0ecjqyYjuDqoQ1EBsA5n2WwDfTYFA6wIbO5sKR"
				},
				body: {
					documents: ["give me toast", "give me a waffle", "give me a pop tart"],
					query: message
				}
			},
			
			function (error, res, data) {
				if (error) {
					console.error(error);
					return;
				}

				var answer = data.choices[0].text.trim();
				Chat.sendMessage("SEARCH RESULT " + answer, true, false);
			}
		);
	}

	function sendToGPT(message) {
		if (isProcessing) return;
		isProcessing = true;

		//if (chatInjector.playing()) return;
		sendToSearch(message);

		var prompt = new_prompt + "\r\n" + restartText + message;
		console.log("Sending prompt\r\n" + prompt);
		request(
			{
				method: "POST",
				uri: postURL,
				json: true,
				headers: {
					Authorization:
						"Bearer sk-RX0ecjqyYjuDqoQ1EBsA5n2WwDfTYFA6wIbO5sKR"
				},
				body: {
					temperature: temperature,
					top_p: top_p,
					presence_penalty: presence_penalty,
					frequency_penalty: frequency_penalty,
					max_tokens: max_tokens,
					stop: stopText,
					prompt: prompt
				}
			},
			function (error, res, data) {
				if (error) {
					console.error(error);
					return;
				}

				var answer = data.choices[0].text.trim();

				console.log("Raw answer is " + answer);
				var actionPos = answer.indexOf(actionLabel);
				var action = "";

				if (actionPos > -1) {
					// put the action in its own string to act out in third person
					action = answer.slice(actionPos);
					action = action.replace(/\n*$/, ""); // remove \r and \b
					//action = action.replace(/"/g,""); // remove quotes
					action = action.replace(/###/g, ""); // remove hash symbols
					console.log("ACTION FOUND " + action);
					// remove the action so it's not spoken or stored
					answer = answer.substring(0, actionPos);
				}

				var chatBotLabelPos_1 = answer.indexOf(chatbotLabel);
				var chatBotLabelPos_2 = answer.lastIndexOf(chatbotLabel);

				// Multiple AI labels. Chop the second extra unwanted stuff.
				if (chatBotLabelPos_2 > -1) {
					if (chatBotLabelPos_1 != chatBotLabelPos_2) {
						answer = answer.substring(0, chatBotLabelPos_2);
					}
				}

				// Handle junk before the AI label. Cut it out.
				if (chatBotLabelPos_1 > -1) {
					answer = answer.slice(answer.indexOf(chatbotLabel));
				}

				// Handle if it tries to anticipate the lines for human
				if (answer.indexOf(humanLabel) > 0) {
					answer = answer.substring(0, answer.indexOf(humanLabel));
					console.log("SLICED IT TO " + answer);
				}

				answer = answer.replace(/\\n/g, "\n").replace(/\\r/g, "\r");

				// tts("Trinoid", answer);

				tts("kathy", answer.substring(4), action);

				new_prompt = prompt + "\r\n" + answer; //prompt + startText + answer;
				chatTranscript += prompt + "\r\n" + answer;

				var trimPos = 0;
				var trimmedLen = 0;
				var history = [0, 0, 0];
				var trimmed = chatTranscript;

				trimPos = trimmed.lastIndexOf(humanLabel);
				trimmedLen = trimmed.length;
				history[0] = trimmed.slice(trimPos, trimmedLen);
				trimmed = trimmed.slice(0, trimPos);

				trimPos = trimmed.lastIndexOf(humanLabel);
				trimmedLen = trimmed.length;
				history[1] = trimmed.slice(trimPos, trimmedLen);
				trimmed = trimmed.slice(0, trimPos);

				trimPos = trimmed.lastIndexOf(humanLabel);
				trimmedLen = trimmed.length;
				history[2] = trimmed.slice(trimPos, trimmedLen);
				trimmed = trimmed.slice(0, trimPos);

				trimPos = trimmed.lastIndexOf(humanLabel);
				trimmedLen = trimmed.length;
				history[3] = trimmed.slice(trimPos, trimmedLen);
				trimmed = trimmed.slice(0, trimPos);

				trimPos = trimmed.lastIndexOf(humanLabel);
				trimmedLen = trimmed.length;
				history[4] = trimmed.slice(trimPos, trimmedLen);
				trimmed = trimmed.slice(0, trimPos);

				new_prompt =
					initText.trim() +
					history[4] +
					history[3] +
					history[2] +
					history[1] +
					history[0];

				console.log("Here would be the new prompt: \r\n" + new_prompt);

				isProcessing = false;
			}
		);
	}

	var askGPT = Chat.addCommand("askGPT", "Sends a query to a GPT3 chatbot.");
	askGPT.running.connect(function (query) {
		sendToGPT(query);
	});

	var initGPT = Chat.addCommand("initGPT", "Init chatbot.");
	initGPT.running.connect(initChatBot);

	function messageReceived(data, senderID) {
		var message = data.message;
		var messageTLC = data.message.toLowerCase();
		var username = AvatarList.getAvatar(senderID).displayName;
		console.log(username, "said", message);

		if (data.local) {
			if (messageTLC.indexOf(" left") > -1) {
				usersPresent.pop(
					messageTLC.substring(0, messageTLC.indexOf(" left"))
				);
			}

			if (messageTLC.indexOf(" joined") > -1) {
				usersPresent.push(
					messageTLC.substring(0, messageTLC.indexOf(" joined"))
				);
			}

			console.log("SOMEONE LEFT AND IT WAS " + usersPresent);
		}

		if (messageTLC.indexOf("@ai ") > -1) {
			sendToGPT(message.slice(4).trim());
		} else if (messageTLC.indexOf("@aiq ") > -1) {
			muteVoice = true;
			sendToGPT(message.slice(4).trim());
		} else muteVoice = false;
	}

	Chat.messageReceived.connect(messageReceived);

	Script.scriptEnding.connect(function () {
		Chat.showMessage("OpenAI shutting down.\r\n", true, false);
		Chat.removeCommand(askGPT);
		Chat.removeCommand(initGPT);
		Chat.messageReceived.disconnect(messageReceived);
	});

	// 	"The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\r\n\r\nQ: Hello, who are you?\r\nA: I am an AI created by OpenAI. How can I help you today?\rQ: ";
	//"I'm a chatbot that reluctantly answers questions.\r\n\r\n###\r\nQ: How many pounds are in a kilogram?\r\nA: This again? There are 2.2 pounds in a kilogram. Please make a note of this.\r\n###\r\nQ: What does HTML stand for?\r\nA: Was Google too busy? Hypertext Markup Language. The T is for try to ask better questions in the future.\r\n###\r\nQ: When did the first airplane fly?\r\nA: On December 17, 1903, Wilbur and Orville Wright made the first flights. I wish they\u2019d come and take me away.\r\n###\r\nQ: Who was the first man in space?\r\nA:";
	//'I am a highly intelligent and helpful question answering bot. If you ask me a question that is rooted in truth, I will give you the answer. If you ask me a question that is nonsense, trickery, or has no clear answer, I will respond with "Unknown".\nQ: What is human life expectancy in the United States?\nA: Human life expectancy in the United States is 78 years.\n\nQ: Who was president of the United States in 1955?\nA: Dwight D. Eisenhower was president of the United States in 1955.\n\nQ: Which party did he belong to?\nA: He belonged to the Republican Party.\n\nQ: What is the square root of banana?\nA: Unknown\n\nQ: How does a telescope work?\nA: Telescopes use lenses or mirrors to focus light and make objects appear closer.\n\nQ: Where were the 1992 Olympics held?\nA: The 1992 Olympics were held in Barcelona, Spain.\n\nQ: How many squigs are in a bonk?\nA: Unknown\n';

	function initChatBot() {
		console.log("Init text was sent: " + initText);
		prompt = "";
		answer = "";
		request(
			{
				method: "POST",
				uri: postURL,
				json: true,
				headers: {
					Authorization:
						"Bearer sk-RX0ecjqyYjuDqoQ1EBsA5n2WwDfTYFA6wIbO5sKR"
				},
				body: {
					temperature: temperature,
					top_p: top_p,
					presence_penalty: presence_penalty,
					frequency_penalty: frequency_penalty,
					max_tokens: max_tokens,
					prompt: baseInitText
				}
			},
			function (error, res, data) {
				if (error) {
					console.error(error);
					Chat.showMessage("Error initializing.\r\n");
					return;
				}
				//Chat.showMessage("OpenAI has been initialized.\r\n");
				Chat.showMessage(
					">> OpenAI has been initialized.\r\n",
					true,
					false
				);
			}
		);
	}
}