import axios from "axios";

export async function downloadToDataUri(url: string) {
	try {
		const req = await axios({ url, responseType: "arraybuffer" });
		const contentType = req.headers["content-type"].split(" ")[0];
		const base64Data = req.data.toString("base64");
		return "data:" + contentType + ";base64," + base64Data;
	} catch (error) {
		return "";
	}
}
