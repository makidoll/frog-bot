import * as puppeteer from "puppeteer";

export class HtmlRenderer {
	browser: puppeteer.Browser;

	constructor() {}

	async launch() {
		this.browser = await puppeteer.launch();
	}

	async renderHtml(html: string, width: number, height: number) {
		const page = await this.browser.newPage();
		await page.setViewport({
			width,
			height,
		});
		await page.setContent(html, {
			waitUntil: "networkidle0",
		});
		const screenshot = await page.screenshot({
			type: "png",
			encoding: "binary",
		});
		return screenshot;
	}
}
