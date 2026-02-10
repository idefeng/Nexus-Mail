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
    isRead: boolean;
    isStarred: boolean;
    snippet: string;
    hasAttachments: boolean;
    html?: string;
    text?: string;
}

export interface IEmailAPI {
    connect: (config: EmailConfig) => Promise<boolean>;
    fetch: (limit?: number, mailbox?: string) => Promise<EmailMessage[]>;
    send: (to: string, subject: string, body: string) => Promise<boolean>;
    getFolders: () => Promise<string[]>;
    move: (uid: string, targetFolder: string, sourceFolder?: string) => Promise<boolean>;
    createFolder: (name: string) => Promise<boolean>;
}

export interface IAIAPI {
    summarize: (content: string) => Promise<{ summary: string; actions: string[]; category: string }>;
    setConfig: (config: { baseURL?: string; apiKey?: string; model?: string }) => Promise<void>;
}

export interface IConfigAPI {
    getAccount: () => Promise<EmailConfig | null>;
    getAI: () => Promise<any | null>;
}

declare global {
    interface Window {
        ipcRenderer: import('electron').IpcRenderer;
        emailAPI: IEmailAPI;
        aiAPI: IAIAPI;
        configAPI: IConfigAPI;
    }
}
