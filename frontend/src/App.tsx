import { useState, useCallback, useEffect } from 'react'
import { CalendarView } from '@/components/Calendar/CalendarView'
import { VoiceButton } from '@/components/VoiceButton/VoiceButton'
import { EventList } from '@/components/EventList/EventList'
import { useSpeech } from '@/hooks/useSpeech'
import { eventsApi } from '@/api/events'
import type { CalendarEvent } from '@/api/events'
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
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
  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null)
  const now = useNow()

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const loadEvents = useCallback(async (start?: string, end?: string) => {
    try {
      const data = await eventsApi.list(start, end)
      setEvents(data)
    } catch {
      // silently ignore if backend not running
    }
  }, [])

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setCalendarRange({ start, end })
    loadEvents(start, end)
  }, [loadEvents])

  useEffect(() => { loadEvents() }, [loadEvents])

  const handleVoiceResult = useCallback(async (text: string) => {
    setLastVoiceText(text)
    try {
      const result = await eventsApi.voice(text)
      speechHook.speak(result.reply)
      addToast('success', result.reply)
      await loadEvents()
    } catch {
      const errMsg = '抱歉，指令处理失败，请重试。'
      speechHook.speak(errMsg)
      addToast('error', errMsg)
    } finally {
      speechHook.finishProcessing()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast, loadEvents])

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
              lastText={lastVoiceText}
            />
          </div>
        </aside>

        {/* Calendar */}
        <main className="flex-1 min-w-0 p-4">
          <CalendarView
            events={events}
            onDateRangeChange={handleDateRangeChange}
            className="h-full"
          />
        </main>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
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
            <p className="text-sm text-stone-300">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
