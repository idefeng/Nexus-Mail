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

    // Allow setting config dynamically
    setConfig(config: { baseURL?: string; apiKey?: string; model?: string }) {
        if (config.baseURL) this.baseURL = config.baseURL;
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.model) this.model = config.model;
    }
}
