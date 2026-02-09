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
    fetch: (limit: number) => ipcRenderer.invoke('email:fetch', limit),
    send: (to: string, subject: string, body: string) => ipcRenderer.invoke('email:send', to, subject, body)
})

contextBridge.exposeInMainWorld('aiAPI', {
    summarize: (content: string) => ipcRenderer.invoke('ai:summarize', content),
    setConfig: (config: any) => ipcRenderer.invoke('ai:setConfig', config)
})

contextBridge.exposeInMainWorld('configAPI', {
    getAccount: () => ipcRenderer.invoke('config:getAccount')
})
