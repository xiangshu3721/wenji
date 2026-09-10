# 问己

> AI 镜像导师 · 空静爱  
> **问至无问，答案自明**  
> 相比答案，好的问题更重要

AI 像真心在听的人：自然节奏、可多短气泡、可不提问；最高能力是让用户愿意继续说。结束权在用户。

移动端 Web MVP · 无需登录 · 数据仅存 LocalStorage。

---

## 快速开始

```bash
cd /workspace/wenji
cp .env.example .env.local   # 可选：填入 API Key
npm install
npm run dev                  # http://0.0.0.0:3020
```

生产构建：

```bash
npm run build
npm start                    # 端口 3020
```

## 页面

| 路径 | 说明 |
|------|------|
| `/` | 首页：写下困惑，开始问己 |
| `/ask` | 对话（多气泡 · 可只回应不问） |
| `/insight?id=` | 自见页：我看见 / 我明白 / 我选择 |
| `/history` | 我的问题历史 |

## AI 规则 4.0（摘要）

完整文档：[`docs/ai-rules-4.0.md`](docs/ai-rules-4.0.md)（2.0 见 [`docs/ai-rules-2.0.md`](docs/ai-rules-2.0.md)）

- **身份**：真心在听的镜子，非提问机器人；气质 **空 · 静 · 爱**
- **节奏**：内容决定 1–5 短气泡；可不提问；反机械（连续两轮问答后优先只回应）
- **探索**：一次一个任务；决策对称；情绪优先抱持；允许沉默与 celebrate
- **结束**：仅用户点击「谢谢，我已经找到答案了」→ finish；reply 永不 auto-finish
- **自见三字段**：`matter` 我看见 · `care` 我明白 · `see` 我选择

## AI 接口 `/api/ask`

**网关优先级**：`DEEPSEEK_API_KEY`（模型可用 `DEEPSEEK_MODEL`，默认 `deepseek-chat`）→ `OPENAI_API_KEY` → **本地 mock**

### `start`

```json
{ "mode": "start", "concern": "我最近总是犹豫不决" }
```

→ `{ bubbles?, firstQuestion?, messages, mock? }`  
多条 `assistant` = 多气泡；`firstQuestion` 兼容。

### `reply`

```json
{ "mode": "reply", "messages": [...], "answer": "其实我怕选错" }
```

→ ask：`{ action:"ask", mode?, bubbles?, hasQuestion?, depth?, messages?, mock? }`（禁止 finish）  
→ finish（仅 mode=finish）：`{ action:"finish", insight:{matter,care,see}, messages?, mock? }`

### Mock 行为

未配置任何 API Key 时自动启用：

1. 开场 2–3 气泡（情绪 → 多承接；决策 → 对称提示）
2. 有时 hold/不问；有时 celebrate；情绪走 release；**永不 auto-finish**
3. 「原来如此」等 → hold 留白，等用户主动结束
4. finish 仅用户触发；自见模板「我看见 / 我明白 / 我选择」

## 本地存储

`localStorage` key：`wenji_sessions`

```ts
{
  id, date, concern,
  messages: [{ role, content }],
  insight?: { matter, care, see, userKnows? },
  helpful?: boolean,
  createdAt
}
```

## 设计

现代东方留白：暖白底、墨黑字、少量灰；大字号、圆角输入、极少按钮。系统中文字体，不依赖 Google Fonts。

## 环境变量

见 `.env.example`。可选 `DEEPSEEK_MODEL`（默认 `deepseek-chat`）。
