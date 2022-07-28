import * as express from "express";
import * as path from "path";
import * as fs from "fs/promises";

export class WebServer {
	app = express();

	start() {
		this.app.use(
			"/dalle-saved",
			express.static(path.resolve(__dirname, "../dalle-saved")),
		);

		this.app.use(
			"/Littlefox-Regular.woff2",
			express.static(
				path.resolve(__dirname, "../assets/Littlefox-Regular.woff2"),
			),
		);

		this.app.get("/", async (req, res) => {
			const html = await fs.readFile(
				path.resolve(__dirname, "../assets/index.html"),
				"utf8",
			);

			let filenames = await fs.readdir(
				path.resolve(__dirname, "../dalle-saved"),
			);

			filenames = filenames.sort(
				(a, b) =>
					parseInt(b.match(/-([0-9]+)\.png$/i)[1]) -
					parseInt(a.match(/-([0-9]+)\.png$/i)[1]),
			);

			res.contentType("text/html").send(
				html.replace(/\[dalles\]/gi, JSON.stringify(filenames)),
			);
		});

		this.app.get("*", (req, res) => {
			res.redirect("/");
		});

		this.app.listen(3406, () => {
			console.log("Web server at http://127.0.0.1:3406");
		});
	}
}
