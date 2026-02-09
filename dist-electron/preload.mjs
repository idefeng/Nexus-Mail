let electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
	on(...args) {
		const [channel, listener] = args;
		return electron.ipcRenderer.on(channel, (event, ...args$1) => listener(event, ...args$1));
	},
	off(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.off(channel, ...omit);
	},
	send(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.send(channel, ...omit);
	},
	invoke(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.invoke(channel, ...omit);
	}
});
electron.contextBridge.exposeInMainWorld("emailAPI", {
	connect: (config) => electron.ipcRenderer.invoke("email:connect", config),
	fetch: (limit) => electron.ipcRenderer.invoke("email:fetch", limit),
	send: (to, subject, body) => electron.ipcRenderer.invoke("email:send", to, subject, body)
});
electron.contextBridge.exposeInMainWorld("aiAPI", {
	summarize: (content) => electron.ipcRenderer.invoke("ai:summarize", content),
	setConfig: (config) => electron.ipcRenderer.invoke("ai:setConfig", config)
});
