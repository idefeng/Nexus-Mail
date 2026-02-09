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

export interface IEmailAPI {
    connect: (config: EmailConfig) => Promise<boolean>;
    fetch: (limit?: number) => Promise<EmailMessage[]>;
    send: (to: string, subject: string, body: string) => Promise<boolean>;
}

export interface IAIAPI {
    summarize: (content: string) => Promise<{ summary: string; actions: string[]; category: string }>;
    setConfig: (config: { baseURL?: string; apiKey?: string; model?: string }) => Promise<void>;
}

declare global {
    interface Window {
        ipcRenderer: import('electron').IpcRenderer;
        emailAPI: IEmailAPI;
        aiAPI: IAIAPI;
    }
}
