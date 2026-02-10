import { createRequire } from 'node:module';
import type * as ImapSimple from 'imap-simple';

const require = createRequire(import.meta.url);
const imapsRaw = require('imap-simple');
// Handle potential default export wrapper
const imaps = imapsRaw.default || imapsRaw;
const mailparser = require('mailparser');
const nodemailer = require('nodemailer');
const { simpleParser } = mailparser;

export interface EmailConfig {
    user: string;
    pass: string;
    host: string;
    port: number;
    tls?: boolean;
    avatar?: string;
}

export interface EmailMessage {
    id: string;
    subject: string;
    from: string;
    date: Date;
    isRead: boolean;
    isStarred: boolean;
    snippet: string;
    hasAttachments: boolean;
    html?: string;
    text?: string;
}

export class EmailService {
    private config: EmailConfig | null = null;
    private connection: ImapSimple.ImapSimple | null = null;

    async connect(config: EmailConfig) {
        this.config = config;
        const imapConfig: ImapSimple.ImapSimpleOptions = {
            imap: {
                user: config.user,
                password: config.pass,
                host: config.host,
                port: config.port,
                tls: config.tls !== false,
                authTimeout: 10000,
                tlsOptions: { rejectUnauthorized: false }
            },
        };

        console.log('[IMAP] Connecting with config:', { ...imapConfig.imap, password: '***' });
        try {
            const connection = await imaps.connect(imapConfig);
            this.connection = connection;
            console.log('[IMAP] Connected successfully');

            connection.on('error', (err: any) => {
                console.error('[IMAP] Connection Error Event:', err);
                this.connection = null;
            });

            console.log('[IMAP] Opening INBOX...');
            await connection.openBox('INBOX');
            console.log('[IMAP] INBOX opened');
            return true;
        } catch (error) {
            console.error('[IMAP] Connection Failed:', error);
            this.connection = null;
            throw error;
        }
    }

    async fetchEmails(limit: number = 20, mailbox: string = 'INBOX'): Promise<EmailMessage[]> {
        if (!this.connection) throw new Error("Not connected");
        console.log(`[IMAP] Fetching emails from ${mailbox}, limit: ${limit}`);

        try {
            console.log(`[IMAP] Opening ${mailbox}...`);
            const box: any = await this.connection.openBox(mailbox);

            const totalMessages = box.messages.total;
            console.log(`[IMAP] Total messages in ${mailbox}: ${totalMessages}`);

            if (totalMessages === 0) return [];

            const start = Math.max(1, totalMessages - limit + 1);
            const end = totalMessages;
            const range = `${start}:${end}`;

            console.log(`[IMAP] Fetching range: ${range}`);

            const messages: any = await this.connection.search([range], {
                bodies: [''],
                markSeen: false
            });

            console.log(`[IMAP] Fetch complete. Found ${messages.length} messages. Parallel parsing...`);

            const parsePromises = (messages as any[]).reverse().map(async (msg) => {
                const uid = msg.attributes.uid;
                try {
                    const rawParams = msg.parts.find((p: any) => p.which === '')?.body;
                    const parsed = await simpleParser(rawParams);

                    return {
                        id: uid + '',
                        subject: parsed.subject || '(无主题)',
                        from: parsed.from?.text || '未知',
                        date: parsed.date || new Date(),
                        isRead: msg.attributes.flags.includes('\\Seen'),
                        isStarred: msg.attributes.flags.includes('\\Flagged'),
                        snippet: (parsed.text?.substring(0, 100) || '').replace(/\s+/g, ' '),
                        hasAttachments: (parsed.attachments && parsed.attachments.length > 0) || false,
                        html: parsed.html || undefined,
                        text: parsed.text || undefined
                    } as EmailMessage;
                } catch (msgErr) {
                    console.warn(`[IMAP] Failed to parse message UID ${uid}:`, msgErr);
                    return null;
                }
            });

            const results = (await Promise.all(parsePromises)).filter(r => r !== null) as EmailMessage[];
            console.log(`[IMAP] Parsing finished. Returning ${results.length} messages.`);
            return results;
        } catch (error) {
            console.error("[IMAP] Range Fetch error:", error);
            throw error;
        }
    }

    async syncNewEmails(lastUid: string, mailbox: string = 'INBOX'): Promise<EmailMessage[]> {
        if (!this.connection) throw new Error("Not connected");
        const uidNum = parseInt(lastUid);
        if (isNaN(uidNum)) throw new Error("Invalid lastUid");

        console.log(`[IMAP] Syncing new emails from ${mailbox} after UID ${uidNum}`);

        try {
            await this.connection.openBox(mailbox);
            // Fetch everything after the last seen UID
            const searchCriteria = [['UID', `${uidNum + 1}:*`]];
            const fetchOptions = {
                bodies: [''],
                markSeen: false
            };

            const messages: any = await this.connection.search(searchCriteria, fetchOptions);

            // Filter out the last UID itself just in case IMAP returns it
            const newMessages = (messages as any[]).filter(m => m.attributes.uid > uidNum);

            if (newMessages.length === 0) {
                console.log('[IMAP] No new emails found.');
                return [];
            }

            console.log(`[IMAP] Found ${newMessages.length} new messages. Parsing...`);

            const parsePromises = newMessages.reverse().map(async (msg) => {
                const uid = msg.attributes.uid;
                try {
                    const rawParams = msg.parts.find((p: any) => p.which === '')?.body;
                    const parsed = await simpleParser(rawParams);

                    return {
                        id: uid + '',
                        subject: parsed.subject || '(无主题)',
                        from: parsed.from?.text || '未知',
                        date: parsed.date || new Date(),
                        isRead: msg.attributes.flags.includes('\\Seen'),
                        isStarred: msg.attributes.flags.includes('\\Flagged'),
                        snippet: (parsed.text?.substring(0, 100) || '').replace(/\s+/g, ' '),
                        hasAttachments: (parsed.attachments && parsed.attachments.length > 0) || false,
                        html: parsed.html || undefined,
                        text: parsed.text || undefined
                    } as EmailMessage;
                } catch (msgErr) {
                    console.warn(`[IMAP] Failed to parse message UID ${uid}:`, msgErr);
                    return null;
                }
            });

            return (await Promise.all(parsePromises)).filter(r => r !== null) as EmailMessage[];
        } catch (error) {
            console.error("[IMAP] Sync error:", error);
            throw error;
        }
    }

    async getFolders(): Promise<string[]> {
        if (!this.connection) throw new Error("Not connected");
        console.log('[IMAP] getFolders requested');

        // imap-simple wraps the 'imap' instance. We try different common names.
        const internalImap = (this.connection as any).imap || (this.connection as any).connection;

        if (!internalImap) {
            console.error('[IMAP] Could not find internal IMAP instance on connection object. Keys:', Object.keys(this.connection));
            throw new Error("Internal IMAP instance not found");
        }

        return new Promise((resolve, reject) => {
            internalImap.getBoxes((err: Error, boxes: any) => {
                if (err) {
                    console.error('[IMAP] getBoxes error:', err);
                    return reject(err);
                }
                const list: string[] = [];
                const flatten = (obj: any, prefix = '') => {
                    for (const key in obj) {
                        const box = obj[key];
                        const fullPath = prefix + key;
                        if (!box.attribs || !box.attribs.includes('\\Noselect')) {
                            list.push(fullPath);
                        }
                        if (box.children) {
                            flatten(box.children, fullPath + box.delimiter);
                        }
                    }
                };
                flatten(boxes);
                console.log(`[IMAP] Found ${list.length} folders`);
                resolve(list);
            });
        });
    }

    async moveEmail(uid: string, targetFolder: string, sourceFolder: string = 'INBOX') {
        if (!this.connection) throw new Error("Not connected");
        console.log(`[IMAP] Moving email UID ${uid} from ${sourceFolder} to ${targetFolder}`);

        const internalImap = (this.connection as any).imap || (this.connection as any).connection;
        if (!internalImap) throw new Error("Internal IMAP instance not found");

        await this.connection.openBox(sourceFolder);
        return new Promise((resolve, reject) => {
            internalImap.move(uid, targetFolder, (err: Error) => {
                if (err) {
                    console.error('[IMAP] move error:', err);
                    return reject(err);
                }
                console.log(`[IMAP] Successfully moved UID ${uid}`);
                resolve(true);
            });
        });
    }

    async createFolder(name: string) {
        if (!this.connection) throw new Error("Not connected");
        return new Promise((resolve, reject) => {
            (this.connection as any).imap.addBox(name, (err: Error) => {
                if (err) return reject(err);
                resolve(true);
            });
        });
    }

    async sendEmail(to: string, subject: string, body: string) {
        if (!this.config) throw new Error("Config missing");

        // Attempt to guess SMTP host. Usually smtp.domain or the given host if it supports both.
        // For ports, we try common ones. 
        // In a real app, these should be configurable.
        const transporter = nodemailer.createTransport({
            host: this.config.host.replace('imap', 'smtp'),
            port: 465,
            secure: true,
            auth: {
                user: this.config.user,
                pass: this.config.pass,
            },
        });

        try {
            await transporter.sendMail({
                from: this.config.user,
                to,
                subject,
                text: body,
            });
            return true;
        } catch (error) {
            console.error('SMTP Error:', error);
            throw error;
        }
    }
}
