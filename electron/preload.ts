import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    // You can expose other weird stuff here if you need it.
})

contextBridge.exposeInMainWorld('emailAPI', {
    connect: (config: any) => ipcRenderer.invoke('email:connect', config),
    fetch: (limit: number, mailbox?: string) => ipcRenderer.invoke('email:fetch', limit, mailbox),
    syncNew: (lastUid: string, mailbox?: string) => ipcRenderer.invoke('email:syncNew', lastUid, mailbox),
    send: (to: string, subject: string, body: string) => ipcRenderer.invoke('email:send', to, subject, body),
    getFolders: () => ipcRenderer.invoke('email:getFolders'),
    move: (uid: string, targetFolder: string, sourceFolder?: string) => ipcRenderer.invoke('email:move', uid, targetFolder, sourceFolder),
    createFolder: (name: string) => ipcRenderer.invoke('email:createFolder', name)
})

contextBridge.exposeInMainWorld('aiAPI', {
    summarize: (content: string) => ipcRenderer.invoke('ai:summarize', content),
    improve: (text: string, tone: string) => ipcRenderer.invoke('ai:improve', text, tone),
    generateOutlines: (context: string) => ipcRenderer.invoke('ai:generateOutlines', context),
    chat: (prompt: string) => ipcRenderer.invoke('ai:chat', prompt),
    setConfig: (config: { baseURL?: string; apiKey?: string; model?: string }) => ipcRenderer.invoke('ai:setConfig', config)
})

contextBridge.exposeInMainWorld('configAPI', {
    getAccount: () => ipcRenderer.invoke('config:getAccount'),
    getAI: () => ipcRenderer.invoke('config:getAI')
})

contextBridge.exposeInMainWorld('draftAPI', {
    save: (draft: any) => ipcRenderer.invoke('draft:save', draft),
    get: (id?: string) => ipcRenderer.invoke('draft:get', id)
})

contextBridge.exposeInMainWorld('contactAPI', {
    search: (query: string) => ipcRenderer.invoke('contact:search', query),
    add: (contact: any) => ipcRenderer.invoke('contact:add', contact)
})
