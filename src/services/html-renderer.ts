import { webkit, Browser, Page } from "playwright";

export class HtmlRenderer {
	browser: Browser;

	constructor() {}

	async launch() {
		this.browser = await webkit.launch({
			// headless: false,
		});
	}

	async renderHtml(
		path: string,
		doWithPathFn?: (page: Page) => Promise<any>,
	) {
		const page = await this.browser.newPage();
		await page.goto(path);
		if (doWithPathFn != null) await doWithPathFn(page);
		const screenshot = await page.screenshot({
			type: "png",
			omitBackground: true,
		});
		page.close();
		return screenshot;
	}
}
