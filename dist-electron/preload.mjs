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
	fetch: (limit, mailbox) => electron.ipcRenderer.invoke("email:fetch", limit, mailbox),
	syncNew: (lastUid, mailbox) => electron.ipcRenderer.invoke("email:syncNew", lastUid, mailbox),
	send: (to, subject, body) => electron.ipcRenderer.invoke("email:send", to, subject, body),
	getFolders: () => electron.ipcRenderer.invoke("email:getFolders"),
	move: (uid, targetFolder, sourceFolder) => electron.ipcRenderer.invoke("email:move", uid, targetFolder, sourceFolder),
	createFolder: (name) => electron.ipcRenderer.invoke("email:createFolder", name)
});
electron.contextBridge.exposeInMainWorld("aiAPI", {
	summarize: (content) => electron.ipcRenderer.invoke("ai:summarize", content),
	setConfig: (config) => electron.ipcRenderer.invoke("ai:setConfig", config)
});
electron.contextBridge.exposeInMainWorld("configAPI", {
	getAccount: () => electron.ipcRenderer.invoke("config:getAccount"),
	getAI: () => electron.ipcRenderer.invoke("config:getAI")
});
