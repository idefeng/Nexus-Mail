import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

export interface EmailConfig {
    user: string;
    pass: string;
    host: string;
    port: number;
    tls?: boolean;
}

export interface EmailMessage {
    id: string;
    subject: string;
    from: string;
    date: Date;
    snippet: string;
    html?: string;
    text?: string;
}

export class EmailService {
    private config: EmailConfig | null = null;
    private connection: imaps.ImapSimple | null = null;

    async connect(config: EmailConfig) {
        this.config = config;
        const imapConfig: imaps.ImapSimpleOptions = {
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
            this.connection = await imaps.connect(imapConfig);
            console.log('[IMAP] Connected successfully');

            this.connection.on('error', (err: any) => {
                console.error('[IMAP] Connection Error Event:', err);
                this.connection = null;
            });

            console.log('[IMAP] Opening INBOX...');
            await this.connection.openBox('INBOX');
            console.log('[IMAP] INBOX opened');
            return true;
        } catch (error) {
            console.error('[IMAP] Connection Failed:', error);
            this.connection = null;
            throw error;
        }
    }

    async fetchEmails(limit: number = 20): Promise<EmailMessage[]> {
        if (!this.connection) throw new Error("Not connected");
        console.log(`[IMAP] Fetching emails (Range Optimized), limit: ${limit}`);

        try {
            // Access the underlying node-imap box info
            const box: any = (this.connection as any).imap._box;
            if (!box) {
                console.error('[IMAP] Box info not found. Re-opening INBOX...');
                await this.connection.openBox('INBOX');
            }

            const totalMessages = (this.connection as any).imap._box.messages.total;
            console.log(`[IMAP] Total messages in INBOX: ${totalMessages}`);

            if (totalMessages === 0) return [];

            // Calculate range for the most recent 'limit' messages
            const start = Math.max(1, totalMessages - limit + 1);
            const end = totalMessages;
            const range = `${start}:${end}`;

            console.log(`[IMAP] Fetching range: ${range}`);

            // Fetch headers and bodies for the range
            const messages: any = await this.connection.search([range], {
                bodies: [''],
                markSeen: false
            });

            console.log(`[IMAP] Fetch complete. Found ${messages.length} messages in range.`);

            const results: EmailMessage[] = [];

            // Search results are always in ascending order in IMAP
            for (const msg of (messages as any[]).reverse()) {
                const uid = msg.attributes.uid;
                try {
                    const rawParams = msg.parts.find((p: any) => p.which === '')?.body;
                    const parsed = await simpleParser(rawParams);

                    results.push({
                        id: uid + '',
                        subject: parsed.subject || '(无主题)',
                        from: parsed.from?.text || '未知',
                        date: parsed.date || new Date(),
                        snippet: (parsed.text?.substring(0, 100) || '').replace(/\s+/g, ' '),
                        html: parsed.html || undefined,
                        text: parsed.text || undefined
                    });
                } catch (msgErr) {
                    console.warn(`[IMAP] Failed to parse message UID ${uid}:`, msgErr);
                }
            }

            return results;
        } catch (error) {
            console.error("[IMAP] Range Fetch error:", error);
            throw error;
        }
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
