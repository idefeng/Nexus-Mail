import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EmailService, type EmailConfig } from './email'
import { AIService } from './ai'

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
    createWindow()

    ipcMain.handle('email:connect', async (_, config: EmailConfig) => {
        console.log('[IPC] email:connect requested');
        try {
            const result = await emailService.connect(config);
            console.log('[IPC] email:connect success');
            return result;
        } catch (error) {
            console.error('[IPC] email:connect error:', error);
            throw error;
        }
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
    })
})
