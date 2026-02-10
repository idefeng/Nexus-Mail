import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EmailService } from './email'
import { AIService } from './ai'
import { StorageService } from './storage'
import { ContactService } from './contacts'
import * as fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const emailService = new EmailService()
const aiService = new AIService()
const storageService = new StorageService()
const contactService = new ContactService()

const ACCOUNT_CONFIG_PATH = path.join(app.getPath('userData'), 'account_config.json')
const AI_CONFIG_PATH = path.join(app.getPath('userData'), 'ai_config.json')

function getSavedAccount() {
    try {
        if (fs.existsSync(ACCOUNT_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(ACCOUNT_CONFIG_PATH, 'utf-8'))
        }
    } catch (e) {
        console.error('Failed to load account config:', e)
    }
    return null
}

function saveAccountConfig(config: any) {
    try {
        fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify(config))
    } catch (e) {
        console.error('Failed to save account config:', e)
    }
}

function getSavedAI() {
    try {
        if (fs.existsSync(AI_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf-8'))
        }
    } catch (e) {
        console.error('Failed to load AI config:', e)
    }
    return null
}

function saveAIConfig(config: any) {
    try {
        fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(config))
    } catch (e) {
        console.error('Failed to save AI config:', e)
    }
}

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset'
    })

    // Test active push Message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }

    // Auto-load AI config on startup
    const aiConfig = getSavedAI()
    if (aiConfig) {
        aiService.setConfig(aiConfig)
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {
    createWindow()

    // Email handlers
    ipcMain.handle('email:connect', async (_, config: any) => {
        try {
            const success = await emailService.connect(config)
            if (success) saveAccountConfig(config)
            return success
        } catch (error: any) {
            console.error('Connection failed:', error)
            throw error
        }
    })

    ipcMain.handle('email:fetch', async (_, limit: number = 20, mailbox: string = 'INBOX') => {
        return await emailService.fetchEmails(limit, mailbox)
    })

    ipcMain.handle('email:syncNew', async (_, lastUid: string, mailbox: string = 'INBOX') => {
        return await emailService.syncNewEmails(lastUid, mailbox)
    })

    ipcMain.handle('email:send', async (_, to: string, subject: string, body: string) => {
        return await emailService.sendEmail(to, subject, body)
    })

    ipcMain.handle('email:getFolders', async () => {
        return await emailService.getFolders()
    })

    ipcMain.handle('email:move', async (_, uid: string, targetFolder: string, sourceFolder: string = 'INBOX') => {
        return await emailService.moveEmail(uid, targetFolder, sourceFolder)
    })

    ipcMain.handle('email:createFolder', async (_, name: string) => {
        return await emailService.createFolder(name)
    })

    // AI handlers
    ipcMain.handle('ai:summarize', async (_, content: string) => {
        return await aiService.summarize(content)
    })

    ipcMain.handle('ai:improve', async (_, text: string, tone: string) => {
        return await aiService.improve(text, tone)
    })

    ipcMain.handle('ai:generateOutlines', async (_, context: string) => {
        return await aiService.generateOutlines(context)
    })

    ipcMain.handle('ai:chat', async (_, prompt: string) => {
        return await aiService.chat(prompt)
    })

    ipcMain.handle('ai:setConfig', async (_, config: any) => {
        aiService.setConfig(config)
        saveAIConfig(config)
    })

    // Draft handlers
    ipcMain.handle('draft:save', async (_, draft: any) => {
        storageService.saveDraft(draft)
        return true
    })

    ipcMain.handle('draft:get', async (_, id: string) => {
        return storageService.getDraft(id)
    })

    // Config handlers
    ipcMain.handle('config:getAccount', () => getSavedAccount())
    ipcMain.handle('config:getAI', () => getSavedAI())

    // Contact handlers
    ipcMain.handle('contact:search', async (_, query: string) => {
        return contactService.search(query)
    })

    ipcMain.handle('contact:add', async (_, contact: any) => {
        contactService.add(contact)
    })
})
