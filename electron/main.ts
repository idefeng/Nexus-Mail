import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EmailService, type EmailConfig } from './email'
import { AIService } from './ai'
import fs from 'node:fs'

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

const ACCOUNT_CONFIG_PATH = path.join(app.getPath('userData'), 'account_config.json')
const AI_CONFIG_PATH = path.join(app.getPath('userData'), 'ai_config.json')

function getSavedAccount() {
    try {
        if (fs.existsSync(ACCOUNT_CONFIG_PATH)) {
            const data = fs.readFileSync(ACCOUNT_CONFIG_PATH, 'utf-8')
            return JSON.parse(data)
        }
    } catch (e) {
        console.error('Failed to load account config:', e)
    }
    return null
}

function saveAccount(config: EmailConfig) {
    try {
        fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify(config, null, 2))
        return true
    } catch (e) {
        console.error('Failed to save account config:', e)
        return false
    }
}

function getSavedAIConfig() {
    try {
        if (fs.existsSync(AI_CONFIG_PATH)) {
            const data = fs.readFileSync(AI_CONFIG_PATH, 'utf-8')
            return JSON.parse(data)
        }
    } catch (e) {
        console.error('Failed to load AI config:', e)
    }
    return null
}

function saveAIConfig(config: any) {
    try {
        fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(config, null, 2))
        return true
    } catch (e) {
        console.error('Failed to save AI config:', e)
        return false
    }
}

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        },
        width: 1200,
        height: 800,
        frame: true,
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
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
    // Load saved AI config on startup
    const savedAI = getSavedAIConfig();
    if (savedAI) {
        console.log('[Main] Auto-loading AI configuration');
        aiService.setConfig(savedAI);
    }

    createWindow()

    ipcMain.handle('email:connect', async (_, config: EmailConfig) => {
        console.log('[IPC] email:connect requested');
        try {
            const result = await emailService.connect(config);
            console.log('[IPC] email:connect success');
            if (result) {
                saveAccount(config);
            }
            return result;
        } catch (error) {
            console.error('[IPC] email:connect error:', error);
            throw error;
        }
    })

    ipcMain.handle('config:getAccount', () => {
        return getSavedAccount();
    })

    ipcMain.handle('config:getAI', () => {
        return getSavedAIConfig();
    })

    ipcMain.handle('email:fetch', async (_, limit: number) => {
        console.log('[IPC] email:fetch requested, limit:', limit);
        try {
            const result = await emailService.fetchEmails(limit);
            console.log('[IPC] email:fetch success, count:', result.length);
            return result;
        } catch (error) {
            console.error('[IPC] email:fetch error:', error);
            throw error;
        }
    })

    ipcMain.handle('email:send', async (_, to: string, subject: string, body: string) => {
        return await emailService.sendEmail(to, subject, body)
    })

    ipcMain.handle('ai:summarize', async (_, content: string) => {
        return await aiService.summarize(content)
    })

    ipcMain.handle('ai:setConfig', async (_, config: any) => {
        aiService.setConfig(config)
        saveAIConfig(config)
    })
})
