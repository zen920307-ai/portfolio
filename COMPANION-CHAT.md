# 墩墩和噗噗

本地：复制 `.env.example` 为 `.env.local`，填写 `DEEPSEEK_API_KEY` 后重启开发服务。不要使用 `VITE_` 前缀，不要把密钥写入前端或提交到 Git。

线上：在运行 `worker/index.js` 的服务端配置 `DEEPSEEK_API_KEY` secret。可用 `DEEPSEEK_MODEL` 指定模型，默认 `deepseek-v4-flash`。静态 GitHub Pages 不运行聊天接口，需要 Worker 服务端或同源 API 代理。

知识库在构建时从 `src/content.js`、`src/data.js` 和 `public/portfolio-content.json` 合并生成，覆盖个人档案、职业经历、设计系统、项目、视觉作品、AI 创作和六页文案；线上请求再覆盖已发布的 KV 内容。本地聊天每次读取已保存内容。图片和视频中的未录入文字不做 OCR，不读取本地未发布的浏览器草稿。

聊天仅在内存中保留，发送最近 12 条消息到本站服务端，再交由 DeepSeek 回答。未配密钥时明确显示暂不可用；失败保留问题以便重试。

API 文档：https://api-docs.deepseek.com/api/create-chat-completion/
验证：`node --test tests/companion-chat.test.mjs`，`npm run test:sites`，`npm run build`。
