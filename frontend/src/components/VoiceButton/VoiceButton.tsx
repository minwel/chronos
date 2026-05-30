import { useEffect, useState } from 'react'
import { Mic, Loader2, HelpCircle, X, Send, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpeechState } from '@/hooks/useSpeech'

interface VoiceButtonProps {
  state: SpeechState
  onStart: () => void
  onStop: () => void
  onCancel?: () => void
  onSubmitDraft?: (text: string) => void
  onCancelDraft?: () => void
  draftText?: string
  lastText?: string
  interimText?: string
  className?: string
}

const stateConfig = {
  idle: {
    label: '按下说话',
    sublabel: '告诉 Chronos 您的日程安排',
    icon: Mic,
    ringColor: 'border-amber-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/15',
    pulseColor: 'bg-amber-500/20',
  },
  listening: {
    label: '正在聆听…',
    sublabel: '请说出您的指令',
    icon: Mic,
    ringColor: 'border-amber-400/60',
    glowColor: 'shadow-[0_0_40px_rgba(245,158,11,0.35)]',
    iconColor: 'text-amber-300',
    bgColor: 'bg-amber-500/20',
    pulseColor: 'bg-amber-400/30',
  },
  editing: {
    label: '确认指令',
    sublabel: '编辑后按回车发送',
    icon: PenLine,
    ringColor: 'border-emerald-500/40',
    glowColor: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]',
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    pulseColor: 'bg-emerald-500/20',
  },
  processing: {
    label: '解析中…',
    sublabel: '点击取消',
    icon: Loader2,
    ringColor: 'border-cyan-500/40',
    glowColor: 'shadow-[0_0_30px_rgba(6,182,212,0.2)]',
    iconColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    pulseColor: 'bg-cyan-500/20',
  },
  awaiting_confirm: {
    label: '等待确认…',
    sublabel: '请说"是"或"不要"来回答',
    icon: HelpCircle,
    ringColor: 'border-violet-500/50',
    glowColor: 'shadow-[0_0_35px_rgba(139,92,246,0.25)]',
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    pulseColor: 'bg-violet-500/20',
  },
}

const idleExamples = [
  '「明天下午三点开会」',
  '「查看本周日程」',
  '「删除周五的会议」',
  '「下周一上午十点健身」',
]

export function VoiceButton({ state, onStart, onStop, onCancel, onSubmitDraft, onCancelDraft, draftText, lastText, interimText, className }: VoiceButtonProps) {
  const config = stateConfig[state]
  const Icon = config.icon
  const [idleExampleIndex, setIdleExampleIndex] = useState(0)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (state === 'editing' && draftText) {
      setEditText(draftText)
    }
  }, [state, draftText])

  useEffect(() => {
    if (state !== 'idle') return

    const timer = window.setInterval(() => {
      setIdleExampleIndex((index) => (index + 1) % idleExamples.length)
    }, 3000)

    return () => window.clearInterval(timer)
  }, [state])

  const handleClick = () => {
    if (state === 'idle') onStart()
    else if (state === 'listening') onStop()
    else if (state === 'processing') onCancel?.()
  }

  const handleSubmitEdit = () => {
    if (editText.trim()) {
      onSubmitDraft?.(editText.trim())
    }
  }

  const sublabel = lastText ? `"${lastText}"` : config.sublabel

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* Ambient glow layer */}
      <div className="relative flex items-center justify-center">
        {/* Ripple rings when listening */}
        {state === 'listening' && (
          <>
            <span className="absolute h-28 w-28 rounded-full bg-amber-400/10 animate-[ripple_2s_ease-out_infinite]" />
            <span className="absolute h-28 w-28 rounded-full bg-amber-400/10 animate-[ripple_2s_ease-out_0.6s_infinite]" />
            <span className="absolute h-28 w-28 rounded-full bg-amber-400/10 animate-[ripple_2s_ease-out_1.2s_infinite]" />
          </>
        )}
        {state === 'awaiting_confirm' && (
          <>
            <span className="absolute h-28 w-28 rounded-full bg-violet-400/10 animate-[ripple_2.5s_ease-out_infinite]" />
            <span className="absolute h-28 w-28 rounded-full bg-violet-400/10 animate-[ripple_2.5s_ease-out_0.8s_infinite]" />
          </>
        )}

        {/* Main button */}
        <button
          onClick={handleClick}
          className={cn(
            'relative z-10 flex h-20 w-20 items-center justify-center rounded-full',
            'border-2 transition-all duration-300 cursor-pointer',
            config.ringColor,
            config.glowColor,
            config.bgColor,
          )}
          aria-label={state === 'processing' ? '取消' : config.label}
        >
          {state === 'processing' ? (
            <div className="relative">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
              <X className="absolute inset-0 m-auto h-4 w-4 text-cyan-300" />
            </div>
          ) : (
            <Icon
              className={cn(
                'h-8 w-8 transition-all duration-300',
                config.iconColor,
                state === 'listening' && 'animate-[float_1.5s_ease-in-out_infinite]',
                state === 'awaiting_confirm' && 'animate-pulse',
              )}
            />
          )}
        </button>
      </div>

      {/* State label / Edit UI */}
      {state === 'editing' ? (
        <div className="w-full space-y-2">
          <p className="font-mono text-xs font-medium tracking-widest uppercase text-emerald-400 text-center">
            {config.label}
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitEdit() }}
              autoFocus
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5
                         text-sm text-stone-200 placeholder-stone-600
                         focus:outline-none focus:border-emerald-500/50 transition-colors"
              placeholder="编辑语音指令..."
            />
            <button
              onClick={handleSubmitEdit}
              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
              aria-label="发送"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              onClick={onCancelDraft}
              className="p-1.5 rounded-lg bg-white/[0.05] text-stone-500 hover:text-stone-300 hover:bg-white/[0.1] transition-colors cursor-pointer"
              aria-label="取消"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-1">
          <p className={cn(
            'font-mono text-xs font-medium tracking-widest uppercase transition-colors duration-300',
            state === 'idle' && 'text-stone-500',
            state === 'listening' && 'text-amber-400',
            state === 'processing' && 'text-cyan-400',
            state === 'awaiting_confirm' && 'text-violet-400',
          )}>
            {config.label}
          </p>
          {state === 'idle' ? (
            <div className="h-4 overflow-hidden text-xs text-stone-600 font-sans leading-4">
              <div
                className="transition-transform duration-500 ease-out"
                style={{ transform: `translateY(-${idleExampleIndex}rem)` }}
              >
                {idleExamples.map((example) => (
                  <p key={example} className="h-4 leading-4">
                    {example}
                  </p>
                ))}
              </div>
            </div>
          ) : state === 'listening' && interimText ? (
            <p className="text-sm text-amber-300/80 font-sans italic max-w-[220px] truncate">
              {interimText}
            </p>
          ) : (
            <p className="text-xs text-stone-600 font-sans">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
