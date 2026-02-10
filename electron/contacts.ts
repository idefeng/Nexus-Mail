import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pinyin = require('tiny-pinyin');

export interface Contact {
    name: string;
    email: string;
    avatar?: string; // Optional, can be generated from initials
    pinyin?: string; // For search
    frequency?: number; // Usage frequency
    lastUsed?: number; // Timestamp
}

export class ContactService {
    private contacts: Contact[] = [];
    private storagePath: string = '';

    constructor() {
        if (app.isReady()) {
            this.init();
        } else {
            app.whenReady().then(() => this.init());
        }
    }

    private init() {
        this.storagePath = path.join(app.getPath('userData'), 'nexus_contacts.json');
        this.load();
    }

    private load() {
        if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
        try {
            const content = fs.readFileSync(this.storagePath, 'utf-8');
            this.contacts = JSON.parse(content);
        } catch (e) {
            console.error('Failed to load contacts:', e);
        }
    }

    private save() {
        if (!this.storagePath) return;
        try {
            fs.writeFileSync(this.storagePath, JSON.stringify(this.contacts, null, 2));
        } catch (e) {
            console.error('Failed to save contacts:', e);
        }
    }

    // Generate avatar initials from name or email
    private getInitials(name: string): string {
        return name.slice(0, 2).toUpperCase();
    }

    // Add or update a contact
    add(contact: Contact) {
        const existingIndex = this.contacts.findIndex(c => c.email === contact.email);

        if (existingIndex > -1) {
            // Update existing
            const existing = this.contacts[existingIndex];
            existing.name = contact.name || existing.name; // Prefer new name if provided
            existing.frequency = (existing.frequency || 0) + 1;
            existing.lastUsed = Date.now();
            // Re-generate pinyin if name changed
            if (contact.name && contact.name !== existing.name) {
                existing.pinyin = pinyin.convertToPinyin(contact.name, '', true).toLowerCase();
            }
        } else {
            // Add new
            const newContact: Contact = {
                ...contact,
                avatar: contact.avatar || this.getInitials(contact.name || contact.email),
                pinyin: pinyin.convertToPinyin(contact.name || '', '', true).toLowerCase(),
                frequency: 1,
                lastUsed: Date.now()
            };
            this.contacts.push(newContact);
        }

        this.save();
    }

    // Search contacts by name, email, or pinyin
    search(query: string): Contact[] {
        if (!query) return [];
        const lowerQuery = query.toLowerCase();

        return this.contacts.filter(c => {
            return (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
                c.email.toLowerCase().includes(lowerQuery) ||
                (c.pinyin && c.pinyin.includes(lowerQuery));
        }).sort((a, b) => (b.frequency || 0) - (a.frequency || 0)) // Sort by frequency
            .slice(0, 10); // Limit to top 10 results
    }
}
