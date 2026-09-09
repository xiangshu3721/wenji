# 问己

> AI 深度自我探索  
> **问至无问，答案自明**

AI 不急着给答案，通过连续追问帮用户看见自己的答案。

移动端 Web MVP · 无需登录 · 数据仅存 LocalStorage。

---

## 快速开始

```bash
cd /workspace/wenji
cp .env.example .env   # 可选：填入 API Key
npm install
npm run dev            # http://0.0.0.0:3020
```

生产构建：

```bash
npm run build
npm start              # 端口 3020
```

## 页面

| 路径 | 说明 |
|------|------|
| `/` | 首页：写下困惑，开始问己 |
| `/ask` | 对话追问（AI 每次只问一句） |
| `/insight?id=` | 自见页：这件事 / 我真正关心 / 我看见了 |
| `/history` | 我的问题历史 |

## AI 接口 `/api/ask`

**网关优先级**：`DEEPSEEK_API_KEY` → `OPENAI_API_KEY` → **本地 mock**

### `start`

```json
{ "mode": "start", "concern": "我最近总是犹豫不决" }
```

→ `{ firstQuestion, messages, mock? }`

### `reply`

```json
{ "mode": "reply", "messages": [...], "answer": "其实我怕选错" }
```

→ `{ action: "ask"|"finish", question?, insight?, messages?, mock? }`

### 内部七层

事 / 感 / 欲 / 惧 / 念 / 我 / 无 — 由 AI 自行决定下一层，不强制走完。

规则：一次一问；不连环「为什么」；不贴心理标签；不替用户决定；不说教；不急着总结。

### Mock 行为

未配置任何 API Key 时自动启用：

1. 根据困惑生成第一问（锚定「事」）
2. 随后按浅→深规则追问（感→欲→惧→念→无）
3. 约 **4–6 轮**后（或用户话里出现「明白/清楚/原来」等）结束
4. 输出模板自见：`matter` / `care` / `see`

## 本地存储

`localStorage` key：`wenji_sessions`

每条会话：

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

见 `.env.example`。
