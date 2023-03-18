import { webkit, Browser, Page } from "playwright";

export class HtmlRenderer {
	private static _instance: HtmlRenderer;

	public static get instance(): HtmlRenderer {
		if (!HtmlRenderer._instance) {
			HtmlRenderer._instance = new HtmlRenderer();
		}
		return HtmlRenderer._instance;
	}

	private constructor() {}

	private browser: Browser;

	async init() {
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

		// dont async cause dont wanna wait
		page.close();

		return screenshot;
	}
}
