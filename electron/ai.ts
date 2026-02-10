export interface AISummary {
    summary: string;
    actions: string[];
    category: string;
}

export class AIService {
    private baseURL = 'https://api.deepseek.com/v1'; // Default to DeepSeek or similar
    private apiKey = ''; // User needs to provide this
    private model = 'deepseek-chat';

    async summarize(content: string): Promise<AISummary> {
        if (!this.apiKey) {
            return {
                summary: '请在设置中配置 AI API Key 以启用灵镜摘要。',
                actions: ['配置 API Key', '选择 AI 模型', '开始智能摘要'],
                category: '系统'
            };
        }

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
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                })
            });

            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);
            return result;
        } catch (error) {
            console.error('AI Summary Error:', error);
            return {
                summary: '摘要生成失败，请检查网络连接或 API 配置。',
                actions: ['重试', '检查配置', '查看原邮件'],
                category: '错误'
            };
        }
    }

    async improve(text: string, tone: string = 'professional'): Promise<string> {
        if (!this.apiKey) return text;
        const prompt = `你是一个专业的邮件润色助手。请将以下内容转化为更加${tone === 'professional' ? '专业、得体、礼貌的商务邮件表达' : '亲切、随和、富有温度的私人信件表达'}。只返回润色后的内容，不要有任何解释。\n\n内容：${text}`;

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await response.json();
            return data.choices?.[0]?.message?.content || text;
        } catch (error) {
            console.error('AI Improve Error:', error);
            return text;
        }
    }

    async generateOutlines(context: string): Promise<string[]> {
        if (!this.apiKey) return [];
        const prompt = `基于以下邮件上下文，生成3个不同语气（如：专业、感谢、委绝）的简短回复大纲（每条大纲30字以内）。请以JSON数组格式返回，格式如下：{"outlines": ["...", "...", "..."]}\n\n上下文：${context}`;

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                })
            });
            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);
            return result.outlines || [];
        } catch (error) {
            console.error('AI Outlines Error:', error);
            return [];
        }
    }

    async chat(prompt: string): Promise<string> {
        if (!this.apiKey) return "";
        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        } catch (error) {
            console.error('AI Chat Error:', error);
            return "";
        }
    }

    // Allow setting config dynamically
    setConfig(config: { baseURL?: string; apiKey?: string; model?: string }) {
        if (config.baseURL) this.baseURL = config.baseURL;
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.model) this.model = config.model;
    }
}
