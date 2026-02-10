一、 产品定义：灵镜邮 (Nexus Mail)
定位：一款极简、智能的跨平台桌面邮件客户端，强调 AI 对邮件内容的自动分类、摘要提炼以及回复建议。

核心功能模块
多账户集成：支持主流邮件服务（Gmail, Outlook, QQ, 网易等）。

AI 灵镜助手：自动提取长邮件摘要，标记待办事项。

极简界面：沉浸式设计，支持 Wubi 输入法优化的快速搜索。

安全加密：本地存储敏感凭据。

二、 技术选型 (针对 Vibe Coding 优化)
为了让 Antigravity 或其他 AI IDE 能够高效生成代码，建议采用技术成熟、生态丰富的组合：

框架：Electron + Vue 3 / React (方便快速构建桌面应用)。

通信：Nodemailer (发送) + Mailparser / node-imap (接收)。

数据库：SQLite / Lowdb (本地存储邮件索引和配置)。

UI 组件库：Tailwind CSS + DaisyUI (极其适合通过 Vibe Coding 快速调整样式)。


