import { Rembg } from "rembg-node";
import { DalleQueue } from "./dalle-queue";
import { HtmlRenderer } from "./html-renderer";

export interface Services {
	htmlRenderer: HtmlRenderer;
	dalleQueue: DalleQueue;
	rembg: Rembg;
}
