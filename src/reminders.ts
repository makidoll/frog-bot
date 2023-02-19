import { CronJob } from "cron";
import { Client, TextChannel } from "discord.js";
import { froglog } from "./froglog";

interface Reminder {
	cron: string;
	message: string;
	channelId: string;
}

const timezone = "America/New_York";

const reminders: Reminder[] =
	process.env.DEV != null
		? [
				// {
				// 	cron: "* * * * *",
				// 	message: "hi <@72139729285427200>",
				// 	channelId: "544245402665222263",
				// },
		  ]
		: [
				{
					cron: "0 14 * * *",
					message:
						"ribbit, <@279887350027386881> and <@138864336054648834>, go do blender practice!",
					channelId: "496631514038009856", // mechanyx
				},
		  ];

let jobs: CronJob[] = [];

export function initReminders(client: Client) {
	for (let job of jobs) {
		job.stop();
	}

	jobs = [];

	for (const reminder of reminders) {
		const job = new CronJob(
			reminder.cron,
			async function () {
				try {
					const anyChannel = await client.channels.fetch(
						reminder.channelId,
					);

					const textChannel = anyChannel as TextChannel;

					textChannel.send(reminder.message);

					froglog.info(
						"Sent reminder!\n> Cron: " +
							reminder.cron +
							"\n> Message: " +
							reminder.message +
							"\n> Channel ID: " +
							reminder.channelId,
					);
				} catch (error) {
					froglog.error("Failed to send reminder");
					froglog.error(error);
				}
			},
			null,
			true,
			timezone,
		);

		jobs.push(job);
	}

	if (process.env.DEV != null) {
		froglog.info("Initialized DEV reminders");
	} else {
		froglog.info("Initialized reminders");
	}
}
