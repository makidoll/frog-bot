import * as puppeteer from "puppeteer";

export class HtmlRenderer {
	browser: puppeteer.Browser;

	constructor() {}

	async launch() {
		this.browser = await puppeteer.launch({
			// headless: false,
		});
	}

	async renderHtml(
		path: string,
		width: number,
		height: number,
		doWithPathFn?: (page: puppeteer.Page) => Promise<any>,
	) {
		const page = await this.browser.newPage();
		await page.setViewport({
			width,
			height,
		});
		await page.goto(path);
		if (doWithPathFn != null) await doWithPathFn(page);
		const screenshot = await page.screenshot({
			type: "png",
			encoding: "binary",
			omitBackground: true,
		});
		page.close();
		return screenshot;
	}
}
