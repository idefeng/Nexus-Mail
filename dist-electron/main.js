import { BrowserWindow, app, ipcMain } from "electron";
import * as path$1 from "node:path";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
var require = createRequire(import.meta.url);
var imapsRaw = require("imap-simple");
var imaps = imapsRaw.default || imapsRaw;
var mailparser = require("mailparser");
var nodemailer = require("nodemailer");
var { simpleParser } = mailparser;
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
			const connection = await imaps.connect(imapConfig);
			this.connection = connection;
			console.log("[IMAP] Connected successfully");
			connection.on("error", (err) => {
				console.error("[IMAP] Connection Error Event:", err);
				this.connection = null;
			});
			console.log("[IMAP] Opening INBOX...");
			await connection.openBox("INBOX");
			console.log("[IMAP] INBOX opened");
			return true;
		} catch (error) {
			console.error("[IMAP] Connection Failed:", error);
			this.connection = null;
			throw error;
		}
	}
	async fetchEmails(limit = 20, mailbox = "INBOX") {
		if (!this.connection) throw new Error("Not connected");
		console.log(`[IMAP] Fetching emails from ${mailbox}, limit: ${limit}`);
		try {
			console.log(`[IMAP] Opening ${mailbox}...`);
			const totalMessages = (await this.connection.openBox(mailbox)).messages.total;
			console.log(`[IMAP] Total messages in ${mailbox}: ${totalMessages}`);
			if (totalMessages === 0) return [];
			const range = `${Math.max(1, totalMessages - limit + 1)}:${totalMessages}`;
			console.log(`[IMAP] Fetching range: ${range}`);
			const messages = await this.connection.search([range], {
				bodies: [""],
				markSeen: false
			});
			console.log(`[IMAP] Fetch complete. Found ${messages.length} messages. Parallel parsing...`);
			const parsePromises = messages.reverse().map(async (msg) => {
				const uid = msg.attributes.uid;
				try {
					const rawParams = msg.parts.find((p) => p.which === "")?.body;
					const parsed = await simpleParser(rawParams);
					return {
						id: uid + "",
						subject: parsed.subject || "(无主题)",
						from: parsed.from?.text || "未知",
						date: parsed.date || /* @__PURE__ */ new Date(),
						isRead: msg.attributes.flags.includes("\\Seen"),
						isStarred: msg.attributes.flags.includes("\\Flagged"),
						snippet: (parsed.text?.substring(0, 100) || "").replace(/\s+/g, " "),
						hasAttachments: parsed.attachments && parsed.attachments.length > 0 || false,
						html: parsed.html || void 0,
						text: parsed.text || void 0
					};
				} catch (msgErr) {
					console.warn(`[IMAP] Failed to parse message UID ${uid}:`, msgErr);
					return null;
				}
			});
			const results = (await Promise.all(parsePromises)).filter((r) => r !== null);
			console.log(`[IMAP] Parsing finished. Returning ${results.length} messages.`);
			return results;
		} catch (error) {
			console.error("[IMAP] Range Fetch error:", error);
			throw error;
		}
	}
	async syncNewEmails(lastUid, mailbox = "INBOX") {
		if (!this.connection) throw new Error("Not connected");
		const uidNum = parseInt(lastUid);
		if (isNaN(uidNum)) throw new Error("Invalid lastUid");
		console.log(`[IMAP] Syncing new emails from ${mailbox} after UID ${uidNum}`);
		try {
			await this.connection.openBox(mailbox);
			const searchCriteria = [["UID", `${uidNum + 1}:*`]];
			const newMessages = (await this.connection.search(searchCriteria, {
				bodies: [""],
				markSeen: false
			})).filter((m) => m.attributes.uid > uidNum);
			if (newMessages.length === 0) {
				console.log("[IMAP] No new emails found.");
				return [];
			}
			console.log(`[IMAP] Found ${newMessages.length} new messages. Parsing...`);
			const parsePromises = newMessages.reverse().map(async (msg) => {
				const uid = msg.attributes.uid;
				try {
					const rawParams = msg.parts.find((p) => p.which === "")?.body;
					const parsed = await simpleParser(rawParams);
					return {
						id: uid + "",
						subject: parsed.subject || "(无主题)",
						from: parsed.from?.text || "未知",
						date: parsed.date || /* @__PURE__ */ new Date(),
						isRead: msg.attributes.flags.includes("\\Seen"),
						isStarred: msg.attributes.flags.includes("\\Flagged"),
						snippet: (parsed.text?.substring(0, 100) || "").replace(/\s+/g, " "),
						hasAttachments: parsed.attachments && parsed.attachments.length > 0 || false,
						html: parsed.html || void 0,
						text: parsed.text || void 0
					};
				} catch (msgErr) {
					console.warn(`[IMAP] Failed to parse message UID ${uid}:`, msgErr);
					return null;
				}
			});
			return (await Promise.all(parsePromises)).filter((r) => r !== null);
		} catch (error) {
			console.error("[IMAP] Sync error:", error);
			throw error;
		}
	}
	async getFolders() {
		if (!this.connection) throw new Error("Not connected");
		console.log("[IMAP] getFolders requested");
		const internalImap = this.connection.imap || this.connection.connection;
		if (!internalImap) {
			console.error("[IMAP] Could not find internal IMAP instance on connection object. Keys:", Object.keys(this.connection));
			throw new Error("Internal IMAP instance not found");
		}
		return new Promise((resolve, reject) => {
			internalImap.getBoxes((err, boxes) => {
				if (err) {
					console.error("[IMAP] getBoxes error:", err);
					return reject(err);
				}
				const list = [];
				const flatten = (obj, prefix = "") => {
					for (const key in obj) {
						const box = obj[key];
						const fullPath = prefix + key;
						if (!box.attribs || !box.attribs.includes("\\Noselect")) list.push(fullPath);
						if (box.children) flatten(box.children, fullPath + box.delimiter);
					}
				};
				flatten(boxes);
				console.log(`[IMAP] Found ${list.length} folders`);
				resolve(list);
			});
		});
	}
	async moveEmail(uid, targetFolder, sourceFolder = "INBOX") {
		if (!this.connection) throw new Error("Not connected");
		console.log(`[IMAP] Moving email UID ${uid} from ${sourceFolder} to ${targetFolder}`);
		const internalImap = this.connection.imap || this.connection.connection;
		if (!internalImap) throw new Error("Internal IMAP instance not found");
		await this.connection.openBox(sourceFolder);
		return new Promise((resolve, reject) => {
			internalImap.move(uid, targetFolder, (err) => {
				if (err) {
					console.error("[IMAP] move error:", err);
					return reject(err);
				}
				console.log(`[IMAP] Successfully moved UID ${uid}`);
				resolve(true);
			});
		});
	}
	async createFolder(name) {
		if (!this.connection) throw new Error("Not connected");
		return new Promise((resolve, reject) => {
			this.connection.imap.addBox(name, (err) => {
				if (err) return reject(err);
				resolve(true);
			});
		});
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
			summary: "请在设置中配置 AI API Key 以启用灵镜摘要。",
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
	async improve(text, tone = "professional") {
		if (!this.apiKey) return text;
		const prompt = `你是一个专业的邮件润色助手。请将以下内容转化为更加${tone === "professional" ? "专业、得体、礼貌的商务邮件表达" : "亲切、随和、富有温度的私人信件表达"}。只返回润色后的内容，不要有任何解释。\n\n内容：${text}`;
		try {
			return (await (await fetch(`${this.baseURL}/chat/completions`, {
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
					}]
				})
			})).json()).choices?.[0]?.message?.content || text;
		} catch (error) {
			console.error("AI Improve Error:", error);
			return text;
		}
	}
	async generateOutlines(context) {
		if (!this.apiKey) return [];
		const prompt = `基于以下邮件上下文，生成3个不同语气（如：专业、感谢、委绝）的简短回复大纲（每条大纲30字以内）。请以JSON数组格式返回，格式如下：{"outlines": ["...", "...", "..."]}\n\n上下文：${context}`;
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
			return JSON.parse(data.choices[0].message.content).outlines || [];
		} catch (error) {
			console.error("AI Outlines Error:", error);
			return [];
		}
	}
	async chat(prompt) {
		if (!this.apiKey) return "";
		try {
			return (await (await fetch(`${this.baseURL}/chat/completions`, {
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
					}]
				})
			})).json()).choices?.[0]?.message?.content || "";
		} catch (error) {
			console.error("AI Chat Error:", error);
			return "";
		}
	}
	setConfig(config) {
		if (config.baseURL) this.baseURL = config.baseURL;
		if (config.apiKey) this.apiKey = config.apiKey;
		if (config.model) this.model = config.model;
	}
};
var storagePath = "";
var ENCRYPTION_KEY = crypto.createHash("sha256").update("nexus-mail-secret").digest();
var IV_LENGTH = 16;
function encrypt(text) {
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return iv.toString("hex") + ":" + encrypted.toString("hex");
}
function decrypt(text) {
	const textParts = text.split(":");
	if (textParts.length < 2) return "";
	const iv = Buffer.from(textParts.shift(), "hex");
	const encryptedText = Buffer.from(textParts.join(":"), "hex");
	const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString();
}
var StorageService = class {
	constructor() {
		this.data = { drafts: {} };
		if (app.isReady()) this.init();
		else app.whenReady().then(() => this.init());
	}
	init() {
		storagePath = path$1.join(app.getPath("userData"), "nexus_storage.json");
		this.load();
	}
	load() {
		if (!storagePath || !fs.existsSync(storagePath)) return;
		try {
			const content = fs.readFileSync(storagePath, "utf-8");
			this.data = JSON.parse(content);
		} catch (e) {
			console.error("Failed to load storage:", e);
		}
	}
	save() {
		if (!storagePath) return;
		try {
			fs.writeFileSync(storagePath, JSON.stringify(this.data));
		} catch (e) {
			console.error("Failed to save storage:", e);
		}
	}
	saveDraft(draft) {
		const encrypted = encrypt(JSON.stringify(draft));
		this.data.drafts[draft.id || "last_active"] = encrypted;
		this.save();
	}
	getDraft(id = "last_active") {
		const encrypted = this.data.drafts[id];
		if (!encrypted) return null;
		try {
			return JSON.parse(decrypt(encrypted));
		} catch (e) {
			console.error("Failed to decrypt draft:", e);
			return null;
		}
	}
};
var pinyin = createRequire(import.meta.url)("tiny-pinyin");
var ContactService = class {
	constructor() {
		this.contacts = [];
		this.storagePath = "";
		if (app.isReady()) this.init();
		else app.whenReady().then(() => this.init());
	}
	init() {
		this.storagePath = path$1.join(app.getPath("userData"), "nexus_contacts.json");
		this.load();
	}
	load() {
		if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
		try {
			const content = fs.readFileSync(this.storagePath, "utf-8");
			this.contacts = JSON.parse(content);
		} catch (e) {
			console.error("Failed to load contacts:", e);
		}
	}
	save() {
		if (!this.storagePath) return;
		try {
			fs.writeFileSync(this.storagePath, JSON.stringify(this.contacts, null, 2));
		} catch (e) {
			console.error("Failed to save contacts:", e);
		}
	}
	getInitials(name) {
		return name.slice(0, 2).toUpperCase();
	}
	add(contact) {
		const existingIndex = this.contacts.findIndex((c) => c.email === contact.email);
		if (existingIndex > -1) {
			const existing = this.contacts[existingIndex];
			existing.name = contact.name || existing.name;
			existing.frequency = (existing.frequency || 0) + 1;
			existing.lastUsed = Date.now();
			if (contact.name && contact.name !== existing.name) existing.pinyin = pinyin.convertToPinyin(contact.name, "", true).toLowerCase();
		} else {
			const newContact = {
				...contact,
				avatar: contact.avatar || this.getInitials(contact.name || contact.email),
				pinyin: pinyin.convertToPinyin(contact.name || "", "", true).toLowerCase(),
				frequency: 1,
				lastUsed: Date.now()
			};
			this.contacts.push(newContact);
		}
		this.save();
	}
	search(query) {
		if (!query) return [];
		const lowerQuery = query.toLowerCase();
		return this.contacts.filter((c) => {
			return c.name && c.name.toLowerCase().includes(lowerQuery) || c.email.toLowerCase().includes(lowerQuery) || c.pinyin && c.pinyin.includes(lowerQuery);
		}).sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 10);
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
var storageService = new StorageService();
var contactService = new ContactService();
var ACCOUNT_CONFIG_PATH = path.join(app.getPath("userData"), "account_config.json");
var AI_CONFIG_PATH = path.join(app.getPath("userData"), "ai_config.json");
function getSavedAccount() {
	console.log("[Config] Loading account from:", ACCOUNT_CONFIG_PATH);
	try {
		if (fs.existsSync(ACCOUNT_CONFIG_PATH)) {
			const data = fs.readFileSync(ACCOUNT_CONFIG_PATH, "utf-8");
			console.log("[Config] Loaded account data success");
			return JSON.parse(data);
		} else console.log("[Config] No account config file found");
	} catch (e) {
		console.error("[Config] Failed to load account config:", e);
	}
	return null;
}
function saveAccountConfig(config) {
	console.log("[Config] Saving account to:", ACCOUNT_CONFIG_PATH);
	try {
		fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify(config));
		console.log("[Config] Account saved successfully");
	} catch (e) {
		console.error("[Config] Failed to save account config:", e);
	}
}
function getSavedAI() {
	try {
		if (fs.existsSync(AI_CONFIG_PATH)) return JSON.parse(fs.readFileSync(AI_CONFIG_PATH, "utf-8"));
	} catch (e) {
		console.error("Failed to load AI config:", e);
	}
	return null;
}
function saveAIConfig(config) {
	try {
		fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(config));
	} catch (e) {
		console.error("Failed to save AI config:", e);
	}
}
function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		icon: path.join(process.env.VITE_PUBLIC || "", "logo.png"),
		webPreferences: { preload: path.join(__dirname, "preload.js") },
		titleBarStyle: "hiddenInset"
	});
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(RENDERER_DIST, "index.html"));
	const aiConfig = getSavedAI();
	if (aiConfig) aiService.setConfig(aiConfig);
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
	createWindow();
	ipcMain.handle("email:connect", async (_, config) => {
		try {
			const success = await emailService.connect(config);
			if (success) saveAccountConfig(config);
			return success;
		} catch (error) {
			console.error("Connection failed:", error);
			throw error;
		}
	});
	ipcMain.handle("email:fetch", async (_, limit = 20, mailbox = "INBOX") => {
		return await emailService.fetchEmails(limit, mailbox);
	});
	ipcMain.handle("email:syncNew", async (_, lastUid, mailbox = "INBOX") => {
		return await emailService.syncNewEmails(lastUid, mailbox);
	});
	ipcMain.handle("email:send", async (_, to, subject, body) => {
		return await emailService.sendEmail(to, subject, body);
	});
	ipcMain.handle("email:getFolders", async () => {
		return await emailService.getFolders();
	});
	ipcMain.handle("email:move", async (_, uid, targetFolder, sourceFolder = "INBOX") => {
		return await emailService.moveEmail(uid, targetFolder, sourceFolder);
	});
	ipcMain.handle("email:createFolder", async (_, name) => {
		return await emailService.createFolder(name);
	});
	ipcMain.handle("ai:summarize", async (_, content) => {
		return await aiService.summarize(content);
	});
	ipcMain.handle("ai:improve", async (_, text, tone) => {
		return await aiService.improve(text, tone);
	});
	ipcMain.handle("ai:generateOutlines", async (_, context) => {
		return await aiService.generateOutlines(context);
	});
	ipcMain.handle("ai:chat", async (_, prompt) => {
		return await aiService.chat(prompt);
	});
	ipcMain.handle("ai:setConfig", async (_, config) => {
		aiService.setConfig(config);
		saveAIConfig(config);
	});
	ipcMain.handle("draft:save", async (_, draft) => {
		storageService.saveDraft(draft);
		return true;
	});
	ipcMain.handle("draft:get", async (_, id) => {
		return storageService.getDraft(id);
	});
	ipcMain.handle("config:getAccount", () => getSavedAccount());
	ipcMain.handle("config:getAI", () => getSavedAI());
	ipcMain.handle("contact:search", async (_, query) => {
		return contactService.search(query);
	});
	ipcMain.handle("contact:add", async (_, contact) => {
		contactService.add(contact);
	});
});
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
