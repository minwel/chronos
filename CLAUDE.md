# Chronos — 语音日历工具

## 项目背景

Chronos 是一个以**语音交互为核心**的日历管理工具，来源于一个黑客松竞赛题目。

**目标**：帮助用户通过自然语言语音指令，准确、顺畅地实现日程事件的添加 / 删除 / 查看，提高日历管理效率和便捷性。

**评审维度**：
- 作品完整度与创新性（40%）：设计合理性、功能完整度、交互流畅度、创新性
- 开发过程与质量（40%）：架构清晰度、代码健壮性、PR 规范、commit 分布合理性
- 演示与表达（20%）：demo 视频质量、功能表达完整性

**PR 规范要求**：
- 每个 PR 只做一件事（单一功能）
- PR 标题需一句话说明新增/修改了什么
- PR 描述需包含：功能描述、实现思路、测试方式
- 主分支代码随时保持可运行状态

---

## 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5 | 类型安全 |
| Vite | 5 | 构建工具 |
| Tailwind CSS | 3 | 样式框架 |
| shadcn/ui | latest | UI 组件库 |
| FullCalendar.js | 6 | 日历可视化组件 |
| Axios | latest | HTTP 客户端 |

### 语音能力
| 技术 | 用途 |
|------|------|
| Web Speech API (`SpeechRecognition`) | 语音识别（浏览器内置，Chrome/Edge） |
| Web Speech Synthesis API | TTS 语音播报反馈 |

> **注意**：Web Speech API 需要 HTTPS 或 localhost，Chrome/Edge 支持最佳，Firefox 支持有限。

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11+ | 运行时 |
| FastAPI | latest | REST API 框架 |
| Uvicorn | latest | ASGI 服务器 |
| SQLAlchemy | 2 | ORM |
| SQLite | 内置 | 数据库（MVP 阶段） |
| Pydantic | 2 | 数据校验 |

### AI / NLP
| 技术 | 用途 |
|------|------|
| DeepSeek API (`deepseek-chat`) | 解析语音文本 → 结构化事件数据（action、title、datetime 等），兼容 OpenAI SDK |

> DeepSeek API 负责理解自然语言时间表达（"明天下午三点"、"下周一上午"），提取结构化字段，无需手写正则。

### 工程工具
| 技术 | 用途 |
|------|------|
| Docker Compose | 本地一键启动前后端 |
| pytest | 后端单元/集成测试 |
| Vitest | 前端单元测试 |
| ESLint + Prettier | 前端代码规范 |
| Ruff | Python 代码规范 |

---

## 架构概览

```
用户说话
   │
   ▼
[浏览器 Web Speech API]  ←── 语音识别为文本
   │ 文本
   ▼
[React 前端]  ──── POST /api/voice ────▶  [FastAPI 后端]
                                               │
                                               ▼
                                        [Claude API]
                                    解析意图 + 提取结构化数据
                                    {action, title, start, end, ...}
                                               │
                                               ▼
                                        [SQLite DB]
                                        存储/查询/删除事件
                                               │
                    ◀──── 返回事件数据 ─────────┘
   │ 更新日历
   ▼
[FullCalendar.js]  显示事件
   │
[Web Speech Synthesis]  播报确认反馈（"已添加：明天下午三点开会"）
```

### 核心数据流
1. 用户按下麦克风按钮 → 启动 `SpeechRecognition`
2. 识别结果文本 → `POST /api/voice` → FastAPI
3. FastAPI 调用 DeepSeek API，System Prompt 指定输出 JSON schema
4. DeepSeek 返回 `{action: "add"|"delete"|"query", event: {...}}`
5. FastAPI 执行数据库操作，返回结果
6. 前端更新 FullCalendar，TTS 播报确认语

---

## 项目结构

```
chronos/
├── frontend/                  # React + Vite 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Calendar/      # FullCalendar 封装
│   │   │   ├── VoiceButton/   # 语音录入按钮
│   │   │   └── EventList/     # 事件列表
│   │   ├── hooks/
│   │   │   └── useSpeech.ts   # Web Speech API hook
│   │   ├── api/               # Axios 请求封装
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                   # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py            # FastAPI 入口
│   │   ├── routes/
│   │   │   ├── voice.py       # POST /api/voice — 语音指令处理
│   │   │   └── events.py      # CRUD /api/events
│   │   ├── services/
│   │   │   ├── claude.py      # Claude API 调用 + prompt
│   │   │   └── calendar.py    # 事件业务逻辑
│   │   ├── models/            # SQLAlchemy 模型
│   │   └── database.py        # SQLite 连接配置
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
├── docker-compose.yml
├── CLAUDE.md                  # 本文件
└── README.md
```

---

## 开发规范

### Commit 规范
```
feat: 添加语音录入按钮组件
fix: 修复时区解析导致事件时间偏移问题
refactor: 提取 useSpeech hook
test: 添加 Claude 解析单元测试
docs: 更新 README 部署说明
```

### 环境变量
后端需要 `.env` 文件（参考 `.env.example`）：
```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=sqlite:///./chronos.db
CORS_ORIGINS=http://localhost:5173
```

### 本地启动
```bash
# 方式一：Docker Compose
docker-compose up

# 方式二：手动
# 后端
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend && npm install
npm run dev  # http://localhost:5173
```

---

## 项目链接

| 平台 | 地址 |
|------|------|
| GitHub | https://github.com/minwel/chronos |
| Linear | https://linear.app/ssiresearch/project/chronos-语音日历工具-b09903d64c46 |

Linear 团队：Jying
