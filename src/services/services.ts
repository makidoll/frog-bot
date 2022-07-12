import { RemBg } from "rembg-node";
import { DalleQueue } from "./dalle-queue";
import { HtmlRenderer } from "./html-renderer";

export interface Services {
	htmlRenderer: HtmlRenderer;
	dalleQueue: DalleQueue;
	remBg: RemBg;
}
