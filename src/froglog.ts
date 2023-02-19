import ololog from "ololog";

if (global.froglog == null) {
	global.froglog = ololog.configure({
		time: true,
		tag: true,
		fancy: true,
	});
}

export const froglog = global.froglog as ololog;
