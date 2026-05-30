import { useState, useCallback, useEffect, useRef } from 'react'
import { CalendarView } from '@/components/Calendar/CalendarView'
import { VoiceButton } from '@/components/VoiceButton/VoiceButton'
import { EventList } from '@/components/EventList/EventList'
import { useSpeech } from '@/hooks/useSpeech'
import { eventsApi } from '@/api/events'
import type { CalendarEvent, PendingAction } from '@/api/events'
import { Sparkles, AlertCircle, CheckCircle2, X, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import './App.css'

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lastVoiceText, setLastVoiceText] = useState<string>()
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null)
  const [backendOffline, setBackendOffline] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const now = useNow()

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((type: 'success' | 'error', message: string, delay = 0) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    // delay: TTS 播报期间保持显示，播完后再倒计时
    const readTime = Math.max(4000, message.length * 80)
    setTimeout(() => removeToast(id), delay + readTime)
  }, [removeToast])

  const loadEvents = useCallback(async (start?: string, end?: string) => {
    try {
      const data = await eventsApi.list(start, end)
      setEvents(data)
      setBackendOffline(false)
    } catch {
      setBackendOffline(true)
    }
  }, [])

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setCalendarRange({ start, end })
    loadEvents(start, end)
  }, [loadEvents])

  useEffect(() => { loadEvents() }, [loadEvents])

  const handleVoiceResult = useCallback(async (text: string) => {
    setLastVoiceText(text)
    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort('timeout'), 15000)
    try {
      const result = await eventsApi.voice(text, pendingAction ?? undefined, controller.signal)
      const isPending = result.action === 'pending_delete' && !!result.candidates?.length
      if (isPending) {
        setPendingAction({ type: 'delete', candidates: result.candidates! })
        speechHook.setAwaitingConfirm()
        speechHook.speak(result.reply, () => {
          speechHook.start()
        })
      } else {
        setPendingAction(null)
        speechHook.speak(result.reply)
      }
      setBackendOffline(false)
      const ttsDelay = Math.round(result.reply.length * 250 / 0.95)
      addToast('success', result.reply, ttsDelay)
      await loadEvents()
    } catch (err) {
      if (controller.signal.aborted) {
        const msg = controller.signal.reason === 'timeout' ? '请求超时，请重试。' : '已取消。'
        addToast('error', msg)
      } else {
        const isNetwork = err instanceof Error && ('code' in err || err.message === 'Network Error')
        if (isNetwork) setBackendOffline(true)
        const errMsg = isNetwork ? '无法连接后端服务，请确认后端已启动。' : '抱歉，指令处理失败，请重试。'
        speechHook.speak(errMsg)
        const errTtsDelay = Math.round(errMsg.length * 250 / 0.95)
        addToast('error', errMsg, errTtsDelay)
      }
    } finally {
      clearTimeout(timeout)
      abortRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast, loadEvents, pendingAction])

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort('cancel')
  }, [])

  const speechHook = useSpeech({
    onResult: handleVoiceResult,
    onError: (err) => {
      addToast('error', err)
    },
  })

  const handleDelete = useCallback(async (id: number) => {
    try {
      await eventsApi.remove(id)
      setEvents(prev => prev.filter(e => e.id !== id))
      addToast('success', '事件已删除')
    } catch {
      addToast('error', '删除失败，请重试')
    }
  }, [addToast])

  const dateStr = now.toLocaleDateString('zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <div className="flex flex-col h-screen bg-[#04040a] overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/[0.04] rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="font-display text-xl text-white tracking-tight">Chronos</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="font-mono text-xs text-stone-500">{dateStr}</span>
        </div>
        <div className="font-mono text-lg text-amber-400/80 tabular-nums tracking-wider">
          {timeStr}
        </div>
      </header>

      {/* Backend offline banner */}
      {backendOffline && (
        <div className="relative z-10 flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <WifiOff className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            无法连接后端服务，请确认后端已启动（端口 8000）
          </p>
          <button
            onClick={() => loadEvents(calendarRange?.start, calendarRange?.end)}
            className="ml-auto text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded px-2 py-0.5 cursor-pointer transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="flex flex-col w-72 shrink-0 border-r border-white/[0.05] bg-white/[0.01]">
          {/* Events section */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-[10px] tracking-widest uppercase text-stone-500">
                日程列表
              </span>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="font-mono text-[10px] text-stone-600">
                {events.length}
              </span>
            </div>
            <EventList
              events={events}
              onDelete={handleDelete}
              rangeStart={calendarRange?.start}
              rangeEnd={calendarRange?.end}
              selectedId={selectedEventId}
              onSelect={setSelectedEventId}
              className="flex-1"
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.05] mx-4" />

          {/* Voice button */}
          <div className="p-6 flex flex-col items-center">
            <VoiceButton
              state={speechHook.state}
              onStart={speechHook.start}
              onStop={speechHook.stop}
              onCancel={cancelProcessing}
              onSubmitDraft={speechHook.submitDraft}
              onCancelDraft={speechHook.cancelDraft}
              draftText={speechHook.draftText}
              lastText={lastVoiceText}
              interimText={speechHook.interimText}
            />
          </div>
        </aside>

        {/* Calendar */}
        <main className="flex-1 min-w-0 p-4">
          <CalendarView
            events={events}
            onDateRangeChange={handleDateRangeChange}
            onEventClick={(id) => setSelectedEventId(prev => prev === id ? null : id)}
            className="h-full"
          />
        </main>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-xl glass max-w-sm',
              toast.type === 'success' ? 'border-cyan-500/20' : 'border-red-500/20',
            )}
          >
            {toast.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              : <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            }
            <p className="text-sm text-stone-300 flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-stone-500 hover:text-stone-300 transition-colors shrink-0 mt-0.5 cursor-pointer"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
