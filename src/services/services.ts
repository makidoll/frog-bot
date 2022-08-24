import { Rembg } from "rembg-node";
import { StableDiffusionQueue } from "./stable-diffusion-queue";
import { HtmlRenderer } from "./html-renderer";

export interface Services {
	htmlRenderer: HtmlRenderer;
	stableDiffusionQueue: StableDiffusionQueue;
	rembg: Rembg;
}
