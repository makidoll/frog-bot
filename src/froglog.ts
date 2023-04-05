import ololog from "ololog";

if (global.froglog == null) {
	global.froglog = ololog.configure({
		time: true,
		tag: true,
		fancy: true,
	});
}

const globalFroglog = global.froglog as ololog;

export const froglog = {
	error: globalFroglog.error,
	info: globalFroglog.info,
	warn: globalFroglog.warn,
	debug: (...args) => {
		if (process.env.DEV) {
			globalFroglog.debug(...args);
		}
	},
};
