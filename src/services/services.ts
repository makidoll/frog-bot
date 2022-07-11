import { DalleQueue } from "./dalle-queue";
import { HtmlRenderer } from "./html-renderer";
import { RemoveBg } from "./remove-bg";

export interface Services {
	htmlRenderer: HtmlRenderer;
	dalleQueue: DalleQueue;
	removeBg: RemoveBg;
}
