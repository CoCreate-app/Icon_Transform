import { queryElements } from "@cocreate/utils";
import uuid from "@cocreate/uuid";

const attribute = "actions";
const actions = {};

/**
 * name: string
 * callback: function
 * endEvent: string
 **/
function init(data) {
	if (!Array.isArray(data)) data = [data];
	for (let { name, callback, endEvent } of data) {
		if (!Array.isArray(name)) name = [name];
		for (let i = 0; i < name.length; i++) {
			if (actions[name[i]]) continue;

			actions[name[i]] = {
				name: name[i],
				callback,
				endEvent: endEvent || name[i]
			};
		}
	}
}

function initActions() {
	document.addEventListener("click", function (event) {
		let element = event.target;
		if (!element.getAttribute(attribute))
			element = event.target.closest(`[${attribute}]`);

		if (!element) return;
		if (element.tagName === "form") {
			const pattern =
				/^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(:\d{1,5})?(\/.*)?$/i;
			if (pattern.test(element.action)) return form.submit();
		}

		event.preventDefault();

		let actions = (element.getAttribute(attribute) || "").split(/\s*,\s*/);
		if (actions.length == 0) return;

		let index = 0;
		let stagedActions = [];
		for (let action of actions) {
			let [name, params] = action.split("(");
			if (params) params = params.substring(0, params.length - 1);

			stagedActions.push({ name, params });
		}

		runAction(stagedActions, index, element);
	});
}

function runAction(stagedActions, index, element) {
	if (index >= stagedActions.length) {
		if (index == stagedActions.length) {
			runSubmit(element);
			runLink(element);
		}
		return;
	}

	const currentAction = stagedActions[index];
	if (!currentAction) return;

	let actionName = currentAction.name;
	if (actionName.includes(".")) {
		let name = actionName.split(".")[0];
		currentAction.method = actionName.substring(name.length + 1);
		currentAction.name = actionName = name;
		currentAction.endEvent = uuid.generate(6);
	}

	const action = actions[actionName];

	if (action) {
		document.addEventListener(
			currentAction.endEvent || action.endEvent,
			function () {
				runNextAction(stagedActions, index, element);
			},
			{ once: true }
		);

		if (action.callback) {
			const form = element.closest("form");
			action.callback.call(null, { element, form, ...currentAction });
		} else runNextAction(stagedActions, index, element);
	} else {
		let status = runSpecialAction(
			stagedActions,
			index,
			element,
			actionName,
			currentAction.params
		);
		if (status === "next") {
			runNextAction(stagedActions, index, element);
		}
	}
}

function runSpecialAction(actions, index, element, actionName, params) {
	if (!params) return "next";
	let elements,
		status = "next";
	switch (actionName) {
		case "event":
			console.log("Waiting Event....");
			status = "";
			document.addEventListener(
				params,
				() => {
					console.log(
						"Event Action (Received event from other section) ====== " +
							params
					);
					runNextAction(actions, index, element);
				},
				{ once: true }
			);
			break;
		case "timeout":
			status = "";

			let delayTime = parseInt(params);
			if (delayTime > 0) {
				setTimeout(function () {
					console.log("Timeout ======= " + params);
					runNextAction(actions, index, element);
				}, parseInt(params));
			}
			break;
		case "action":
			elements = queryElements({
				element,
				selector: params,
				type: "selector"
			});
			for (let i = 0; i < elements.length; i++) {
				elements[i].click();
			}
			break;
		case "read":
		case "save":
		case "renderValue":
			elements = queryElements({
				element,
				selector: params,
				type: "selector"
			});
			for (let i = 0; i < elements.length; i++) {
				if (elements[i][actionName]) elements[i][actionName]();
			}
			break;
		case "submit":
			let form = closest("form");
			if (form) form.click();
			break;
		default:
			elements = queryElements({
				element,
				selector: params,
				type: "selector"
			});
			for (let i = 0; i < elements.length; i++) {
				if (elements[i][actionName]) elements[i][actionName]();
			}
	}

	return status;
}

function runNextAction(actions, index, element) {
	runAction(actions, (index += 1), element);
}

function runSubmit(element) {
	let button = element.closest('[type="submit"]');
	if (!button) button = element.querySelector('[type="submit"]');
	if (button) {
		let form = element.closest("form");
		if (form && form.action) {
			const pattern =
				/^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(:\d{1,5})?(\/.*)?$/i;
			if (pattern.test(form.action)) form.submit();
		}
	}
}

function runLink(element) {
	let link = element.closest("[href], [target], [state_to]");
	if (!link) link = element.querySelector("[href], [target], [state_to]");
	if (link) run(link);
}

function run(link) {
	if (typeof CoCreate.link !== "undefined") {
		CoCreate.link.open(link);
	} else if (link.hasAttribute("href")) {
		let href = link.getAttribute("href") || "";
		// Normalize both URLs to compare paths in a uniform way
		const currentPath = new URL(location.href).pathname.replace(
			"/index.html",
			"/"
		);
		const targetPath = new URL(href, location.href).pathname.replace(
			"/index.html",
			"/"
		);

		if (currentPath !== targetPath) {
			location.href = href;
		}
	}
}

initActions();

export default { init };
