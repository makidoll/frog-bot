import * as fs from "fs/promises";
import { ElementHandle } from "playwright";
import { HtmlRenderer } from "../services/html-renderer";

enum HgDistrictSize {
	Two = 2,
	Three = 3,
	Four = 4,
}

enum HgGender {
	// site uses these indices
	Female = "0",
	Male = "1",
}

async function simulateHungerGames() {
	const browser = HtmlRenderer.instance.getBrowser();

	// new context so nothing is remembered
	const context = await browser.newContext();

	const page = await context.newPage();
	await page.setViewportSize({ width: 1200, height: 6000 });

	// accept disclaimer first

	await page.goto("https://brantsteele.net/hungergames/disclaimer.php", {
		waitUntil: "networkidle",
	});
	page.click('a[href="agree.php"]');

	// adjust size

	const districtSize: HgDistrictSize = HgDistrictSize.Two;
	const gameSize = districtSize * 12; // districts

	await page.goto(
		"https://brantsteele.net/hungergames/ChangeTributes-" +
			gameSize +
			".php",
		{ waitUntil: "networkidle" },
	);

	// adjust cast

	await page.goto("https://brantsteele.net/hungergames/edit.php", {
		waitUntil: "networkidle",
	});

	for (let i = 0; i < gameSize; i++) {
		const name = "Maki " + (i + 1);

		// must end without arguments (? or &)
		const imgUrl =
			"https://cdn.discordapp.com/avatars/72139729285427200/a203db5f8ec10826d83a5b421486b0e3.png";

		const gender = HgGender.Female;

		const iStr = String(i + 1).padStart(2, "0");
		const selector = (type: string) => `*[name=cusTribute${iStr}${type}]`;

		await (await page.$(selector(""))).fill(name);
		await (await page.$(selector("nickname"))).fill(name);
		await (await page.$(selector("img"))).fill(imgUrl);
		await (await page.$(selector("gender"))).selectOption(gender);
	}

	await page.click("input[type=submit]");

	// start simulation

	let i = 0;

	const screenshotAndProceed = async () => {
		const title = (
			await (await page.$("#titleHolder > #title")).textContent()
		).trim();

		const contentHeight = (await (await page.$("#content")).boundingBox())
			.height;

		const screenshot = await page.screenshot({
			type: "png",
			fullPage: true,
			clip: {
				x: 220,
				y: 87,
				width: 677,
				height: contentHeight + 87,
			},
		});

		// const filename = i + " - " + title + ".png";
		const filename = i + ".png";
		await fs.writeFile(filename, screenshot);

		i++;

		const aTags = await page.$$("a");

		// .find() work work for some reason
		let proceedEl: ElementHandle | null = null;
		for (const aTag of aTags) {
			if ((await aTag.textContent()).includes("Proceed.")) {
				proceedEl = aTag;
				break;
			}
		}

		// nothing left to do
		if (proceedEl == null) {
			return false;
		}

		await proceedEl.click();
		await page.waitForLoadState("networkidle");

		return true;
	};

	await page.goto("https://brantsteele.net/hungergames/reaping.php", {
		waitUntil: "networkidle",
	});

	while (await screenshotAndProceed()) {
		// its doing
	}

	// ok we're done

	await page.close();
}

// (async () => {
// 	await HtmlRenderer.instance.init();
// 	simulateHungerGames();
// })();
