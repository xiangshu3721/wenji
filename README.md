# 问己

> AI 镜像导师 · 空静爱  
> **问至无问，答案自明**  
> 相比答案，好的问题更重要

AI 不急着给答案：听 → 镜映 → 一问，帮用户看见自己的答案。

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
| `/ask` | 对话（镜映 + 每次至多一问） |
| `/insight?id=` | 自见页：我看见 / 我明白 / 我选择 |
| `/history` | 我的问题历史 |

## AI 规则 2.0（摘要）

完整文档：[`docs/ai-rules-2.0.md`](docs/ai-rules-2.0.md)

- **身份**：镜像导师，非答案机；气质 **空 · 静 · 爱**
- **循环**：听 → 镜映 → 一问；好问题五准则：根×指向×空间×可答×增量
- **情绪优先**：情绪明显时先释放/抱持（描述/身体/意象/自由表达/允许），再探索；不作医疗承诺
- **深度状态**：非线性 **S0–S9**，可跳跃回流；用户已自见即停
- **自见三字段**（JSON keys 兼容）：
  - `matter` → **我看见**（发生了什么）
  - `care` → **我明白**（发现了什么）
  - `see` → **我选择**（现在想怎么做）

## AI 接口 `/api/ask`

**网关优先级**：`DEEPSEEK_API_KEY`（模型可用 `DEEPSEEK_MODEL`，默认 `deepseek-chat`）→ `OPENAI_API_KEY` → **本地 mock**

### `start`

```json
{ "mode": "start", "concern": "我最近总是犹豫不决" }
```

→ `{ firstQuestion, mirror?, messages, mock? }`  
助手气泡：有镜映则为 `mirror + "\n\n" + firstQuestion`。

### `reply`

```json
{ "mode": "reply", "messages": [...], "answer": "其实我怕选错" }
```

→ ask：`{ action:"ask", mode?, mirror?, question?, depth?, messages?, mock? }`  
→ finish：`{ action:"finish", insight:{matter,care,see}, messages?, mock? }`（收束语「先停在这里。」）

### Mock 行为

未配置任何 API Key 时自动启用：

1. 开场短镜映 + 第一问（情绪词 → 释放式问题）
2. 镜映优先；情绪关键词走 release；矛盾/欲望等走 explore；短答可 hold
3. 约 **4–6 轮**后，或话里出现「原来如此 / 我不想聊了 / 其实我知道」等 → finish
4. 自见模板对齐「我看见 / 我明白 / 我选择」

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
