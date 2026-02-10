import { BrowserWindow, app, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import fs from "node:fs";
var EmailService = class {
	constructor() {
		this.config = null;
		this.connection = null;
	}
	async connect(config) {
		this.config = config;
		const imapConfig = { imap: {
			user: config.user,
			password: config.pass,
			host: config.host,
			port: config.port,
			tls: config.tls !== false,
			authTimeout: 1e4,
			tlsOptions: { rejectUnauthorized: false }
		} };
		console.log("[IMAP] Connecting with config:", {
			...imapConfig.imap,
			password: "***"
		});
		try {
			this.connection = await imaps.connect(imapConfig);
			console.log("[IMAP] Connected successfully");
			this.connection.on("error", (err) => {
				console.error("[IMAP] Connection Error Event:", err);
				this.connection = null;
			});
			console.log("[IMAP] Opening INBOX...");
			await this.connection.openBox("INBOX");
			console.log("[IMAP] INBOX opened");
			return true;
		} catch (error) {
			console.error("[IMAP] Connection Failed:", error);
			this.connection = null;
			throw error;
		}
	}
	async fetchEmails(limit = 20) {
		if (!this.connection) throw new Error("Not connected");
		console.log(`[IMAP] Fetching emails (Range Optimized), limit: ${limit}`);
		try {
			console.log("[IMAP] Re-syncing INBOX...");
			const totalMessages = (await this.connection.openBox("INBOX")).messages.total;
			console.log(`[IMAP] Total messages in INBOX: ${totalMessages}`);
			if (totalMessages === 0) return [];
			const range = `${Math.max(1, totalMessages - limit + 1)}:${totalMessages}`;
			console.log(`[IMAP] Fetching range: ${range}`);
			const messages = await this.connection.search([range], {
				bodies: [""],
				markSeen: false
			});
			console.log(`[IMAP] Fetch complete. Found ${messages.length} messages in range.`);
			const results = [];
			for (const msg of messages.reverse()) {
				const uid = msg.attributes.uid;
				try {
					const rawParams = msg.parts.find((p) => p.which === "")?.body;
					const parsed = await simpleParser(rawParams);
					results.push({
						id: uid + "",
						subject: parsed.subject || "(无主题)",
						from: parsed.from?.text || "未知",
						date: parsed.date || /* @__PURE__ */ new Date(),
						seen: msg.attributes.flags.includes("\\Seen"),
						snippet: (parsed.text?.substring(0, 100) || "").replace(/\s+/g, " "),
						html: parsed.html || void 0,
						text: parsed.text || void 0
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
	async sendEmail(to, subject, body) {
		if (!this.config) throw new Error("Config missing");
		const transporter = nodemailer.createTransport({
			host: this.config.host.replace("imap", "smtp"),
			port: 465,
			secure: true,
			auth: {
				user: this.config.user,
				pass: this.config.pass
			}
		});
		try {
			await transporter.sendMail({
				from: this.config.user,
				to,
				subject,
				text: body
			});
			return true;
		} catch (error) {
			console.error("SMTP Error:", error);
			throw error;
		}
	}
};
var AIService = class {
	constructor() {
		this.baseURL = "https://api.deepseek.com/v1";
		this.apiKey = "";
		this.model = "deepseek-chat";
	}
	async summarize(content) {
		if (!this.apiKey) return {
			summary: "请在设置中配置 AI API Key 以启用灵境摘要。",
			actions: [
				"配置 API Key",
				"选择 AI 模型",
				"开始智能摘要"
			],
			category: "系统"
		};
		const prompt = `
你是一个专业的邮件助手。请分析以下邮件内容，并提供：
1. 100字以内的简短摘要。
2. 3个核心行动点（每点一句话）。
3. 分类标签：如果是通知、订阅、广告类邮件，请归类为“资讯”，否则归类为“核心”。

请以 JSON 格式返回，格式如下：
{
  "summary": "...",
  "actions": ["...", "...", "..."],
  "category": "..."
}

邮件内容：
${content}
`;
		try {
			const data = await (await fetch(`${this.baseURL}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${this.apiKey}`
				},
				body: JSON.stringify({
					model: this.model,
					messages: [{
						role: "user",
						content: prompt
					}],
					response_format: { type: "json_object" }
				})
			})).json();
			return JSON.parse(data.choices[0].message.content);
		} catch (error) {
			console.error("AI Summary Error:", error);
			return {
				summary: "摘要生成失败，请检查网络连接或 API 配置。",
				actions: [
					"重试",
					"检查配置",
					"查看原邮件"
				],
				category: "错误"
			};
		}
	}
	setConfig(config) {
		if (config.baseURL) this.baseURL = config.baseURL;
		if (config.apiKey) this.apiKey = config.apiKey;
		if (config.model) this.model = config.model;
	}
};
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var win;
var emailService = new EmailService();
var aiService = new AIService();
var ACCOUNT_CONFIG_PATH = path.join(app.getPath("userData"), "account_config.json");
var AI_CONFIG_PATH = path.join(app.getPath("userData"), "ai_config.json");
function getSavedAccount() {
	try {
		if (fs.existsSync(ACCOUNT_CONFIG_PATH)) {
			const data = fs.readFileSync(ACCOUNT_CONFIG_PATH, "utf-8");
			return JSON.parse(data);
		}
	} catch (e) {
		console.error("Failed to load account config:", e);
	}
	return null;
}
function saveAccount(config) {
	try {
		fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify(config, null, 2));
		return true;
	} catch (e) {
		console.error("Failed to save account config:", e);
		return false;
	}
}
function getSavedAIConfig() {
	try {
		if (fs.existsSync(AI_CONFIG_PATH)) {
			const data = fs.readFileSync(AI_CONFIG_PATH, "utf-8");
			return JSON.parse(data);
		}
	} catch (e) {
		console.error("Failed to load AI config:", e);
	}
	return null;
}
function saveAIConfig(config) {
	try {
		fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(config, null, 2));
		return true;
	} catch (e) {
		console.error("Failed to save AI config:", e);
		return false;
	}
}
function createWindow() {
	win = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC || "", "logo.png"),
		webPreferences: { preload: path.join(__dirname, "preload.mjs") },
		width: 1200,
		height: 800,
		frame: true
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(RENDERER_DIST, "index.html"));
}
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(() => {
	const savedAI = getSavedAIConfig();
	if (savedAI) {
		console.log("[Main] Auto-loading AI configuration");
		aiService.setConfig(savedAI);
	}
	createWindow();
	ipcMain.handle("email:connect", async (_, config) => {
		console.log("[IPC] email:connect requested");
		try {
			const result = await emailService.connect(config);
			console.log("[IPC] email:connect success");
			if (result) saveAccount(config);
			return result;
		} catch (error) {
			console.error("[IPC] email:connect error:", error);
			throw error;
		}
	});
	ipcMain.handle("config:getAccount", () => {
		return getSavedAccount();
	});
	ipcMain.handle("config:getAI", () => {
		return getSavedAIConfig();
	});
	ipcMain.handle("email:fetch", async (_, limit) => {
		console.log("[IPC] email:fetch requested, limit:", limit);
		try {
			const result = await emailService.fetchEmails(limit);
			console.log("[IPC] email:fetch success, count:", result.length);
			return result;
		} catch (error) {
			console.error("[IPC] email:fetch error:", error);
			throw error;
		}
	});
	ipcMain.handle("email:send", async (_, to, subject, body) => {
		return await emailService.sendEmail(to, subject, body);
	});
	ipcMain.handle("ai:summarize", async (_, content) => {
		return await aiService.summarize(content);
	});
	ipcMain.handle("ai:setConfig", async (_, config) => {
		aiService.setConfig(config);
		saveAIConfig(config);
	});
});
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
