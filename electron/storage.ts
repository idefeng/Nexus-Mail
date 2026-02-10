import { app } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

// STORAGE_PATH will be initialized after app is ready to avoid issues with getPath
let storagePath = '';

const ENCRYPTION_KEY = crypto.createHash('sha256').update('nexus-mail-secret').digest();
const IV_LENGTH = 16;

function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
    const textParts = text.split(':');
    if (textParts.length < 2) return "";
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export interface Draft {
    id: string;
    to: string;
    cc: string;
    subject: string;
    body: string;
    updatedAt: number;
}

export class StorageService {
    private data: { drafts: Record<string, string> } = { drafts: {} };

    constructor() {
        // Initialize path when app is ready or now if already ready
        if (app.isReady()) {
            this.init();
        } else {
            app.whenReady().then(() => this.init());
        }
    }

    private init() {
        storagePath = path.join(app.getPath('userData'), 'nexus_storage.json');
        this.load();
    }

    private load() {
        if (!storagePath || !fs.existsSync(storagePath)) return;
        try {
            const content = fs.readFileSync(storagePath, 'utf-8');
            this.data = JSON.parse(content);
        } catch (e) {
            console.error('Failed to load storage:', e);
        }
    }

    private save() {
        if (!storagePath) return;
        try {
            fs.writeFileSync(storagePath, JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save storage:', e);
        }
    }

    saveDraft(draft: Draft) {
        const encrypted = encrypt(JSON.stringify(draft));
        this.data.drafts[draft.id || 'last_active'] = encrypted;
        this.save();
    }

    getDraft(id: string = 'last_active'): Draft | null {
        const encrypted = this.data.drafts[id];
        if (!encrypted) return null;
        try {
            return JSON.parse(decrypt(encrypted));
        } catch (e) {
            console.error('Failed to decrypt draft:', e);
            return null;
        }
    }
}
