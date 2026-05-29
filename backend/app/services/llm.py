import json
import os
from datetime import datetime

from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com",
        )
    return _client


SYSTEM_PROMPT = """\
你是一个日历助手，负责将用户的语音指令解析为结构化日历操作。

当前时间：{now}

请严格输出以下 JSON 格式，不要包含任何其他内容：
{{
  "action": "add" | "delete" | "query",
  "event": {{
    "title": "事件标题",
    "start_time": "ISO8601格式，如 2026-05-30T15:00:00",
    "end_time": "ISO8601格式或 null",
    "description": "描述或 null"
  }},
  "reply": "用于语音播报的确认语句，如：已添加：明天下午三点，开会"
}}

规则：
- action 为 query 时，event 字段可为 null
- 时间描述"明天"、"下周一"等必须换算为绝对时间
- 默认事件时长 1 小时（若未指定结束时间）
- reply 必须简洁自然，适合 TTS 朗读
"""


def parse_voice_command(text: str) -> dict:
    now = datetime.now().strftime("%Y-%m-%d %H:%M (%A)")
    client = _get_client()

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT.format(now=now)},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    content = response.choices[0].message.content
    return json.loads(content)
