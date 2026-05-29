# Chronos 🎙️📅

> 语音版日历工具 — 用说话来管理你的日程

Chronos 是一个以**语音交互为核心**的日历管理工具。你只需对着麦克风说出自然语言指令，即可完成日程的添加、删除和查询，无需手动输入。

## 功能特性

- **语音添加事件**：「明天下午三点和张总开会」
- **语音查询日程**：「这周有什么安排？」
- **语音删除事件**：「取消明天下午的会议」
- **日历可视化**：月视图 / 周视图切换
- **语音播报反馈**：操作完成后语音确认

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 日历组件 | FullCalendar.js |
| 语音识别 | Web Speech API |
| 后端 | Python FastAPI |
| AI 解析 | Claude API (claude-sonnet-4-6) |
| 数据库 | SQLite |

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.11+
- Chrome 或 Edge 浏览器（Web Speech API 支持最佳）

### 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 .env，填入 ANTHROPIC_API_KEY
```

### 启动方式一：Docker Compose

```bash
docker-compose up
```

访问 http://localhost:5173

### 启动方式二：手动启动

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端（新终端）
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

## 使用说明

1. 打开应用，点击页面中央的麦克风按钮
2. 说出你的日程指令（中文或英文均可）
3. 等待语音播报确认
4. 日历自动更新显示新事件

## 项目结构

```
chronos/
├── frontend/          # React 前端
├── backend/           # FastAPI 后端
├── docker-compose.yml
├── CLAUDE.md          # 项目技术文档
└── README.md
```

## 依赖说明

- `@anthropic-ai/sdk` / `anthropic` — Claude API，用于自然语言理解和意图解析
- `@fullcalendar/react` — 日历 UI 组件
- `fastapi` — Python Web 框架
- `sqlalchemy` — ORM，管理 SQLite 数据
