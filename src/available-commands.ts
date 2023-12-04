import { Command } from "./command";
import { CouchCommand } from "./commands/frends/couch-command";
import { FrugCommand } from "./commands/frends/frug-command";
import { SaveAttachmentsCommand } from "./commands/makis-home/save-attachments-command";
import { VapourHoldCommand } from "./commands/mechanyx/vapour-hold-command";
import { CasCommand } from "./commands/memes-gifs/cas-command";
import { MyBelovedCommand } from "./commands/memes-gifs/my-beloved-command";
import { PetpetCommand } from "./commands/memes-gifs/petpet-command";
import { SquishyCommand } from "./commands/memes-gifs/squishy-command";
import { BlahajWatchingCommand } from "./commands/memes/blahaj-watching-command";
import { ComfyCommand } from "./commands/memes/comfy-command";
import { DeepfryCommand } from "./commands/memes/deepfry-command";
import { NokiaExcelCommand } from "./commands/memes/nokia-excel-command";
import { OmgHiCommand } from "./commands/memes/omg-hi-command";
import { ToastCommand } from "./commands/memes/toast-command";
import { LoopCommand } from "./commands/music/loop-command";
import { PlayCommand } from "./commands/music/play-command";
import { ShowQueueCommand } from "./commands/music/show-queue-command";
import { SkipCommand } from "./commands/music/skip-command";
import { StopCommand } from "./commands/music/stop-command";
import { FeatureplsCommand } from "./commands/other/featurepls-command";
import { HelpCommand } from "./commands/other/help-command";
import { RemoveBgCommand } from "./commands/other/remove-bg-command";
import { YtDlpCommand } from "./commands/other/yt-dlp-command";

export const availableCommands: Command[] = [
	// > other
	HelpCommand,
	RemoveBgCommand,
	YtDlpCommand,
	FeatureplsCommand,
	// > frends
	CouchCommand,
	FrugCommand,
	// > memes
	ComfyCommand,
	DeepfryCommand,
	OmgHiCommand,
	ToastCommand,
	NokiaExcelCommand,
	BlahajWatchingCommand,
	// > memes gifs
	CasCommand,
	PetpetCommand,
	SquishyCommand,
	MyBelovedCommand,
	// > music
	PlayCommand,
	StopCommand,
	SkipCommand,
	LoopCommand,
	ShowQueueCommand,
	// > games
	// SnakesAndLaddersCommand,
	// > mechanyx
	VapourHoldCommand,
	// > maki's home
	SaveAttachmentsCommand,
];
