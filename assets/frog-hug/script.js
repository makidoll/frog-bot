function doTextFit() {
	textFit(document.getElementsByClassName("name"), {
		maxFontSize: 80,
	});
}

function makeShadows() {
	document.querySelectorAll(".user").forEach(el => {
		el.parentNode.appendChild(el.cloneNode(true));
		el.className += " shadow";
	});
}

function postProcess() {
	doTextFit();
	makeShadows();
}

function addExampleUsers() {
	document.querySelectorAll(".avatar").forEach(el => {
		el.src =
			"https://nitter.cutelab.space/pic/pbs.twimg.com%2Fprofile_images%2F1531399237547728896%2FyVO55RYR_400x400.jpg";
	});
	document.querySelectorAll(".name").forEach(el => {
		el.textContent = "Maki";
	});
}

// addExampleUsers();
