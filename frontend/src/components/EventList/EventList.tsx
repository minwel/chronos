import { Clock, Calendar, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@/api/events'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface EventListProps {
  events: CalendarEvent[]
  onDelete?: (id: number) => void
  rangeStart?: string
  rangeEnd?: string
  className?: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return '今天'
  if (d.toDateString() === tomorrow.toDateString()) return '明天'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
}

function groupByDate(events: CalendarEvent[]) {
  const groups: Record<string, CalendarEvent[]> = {}
  for (const event of events) {
    const key = formatDate(event.start_time)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }
  return groups
}

function EventItem({ event, onDelete }: { event: CalendarEvent; onDelete?: (id: number) => void }) {
  return (
    <div
      className="group flex items-start gap-3 px-3 py-2.5 rounded-lg
                 bg-white/[0.02] border border-white/[0.04]
                 hover:bg-white/[0.04] hover:border-white/[0.07]
                 transition-all duration-150"
    >
      {/* Time */}
      <div className="flex items-center gap-1 pt-0.5 shrink-0">
        <Clock className="h-3 w-3 text-stone-600" />
        <span className="font-mono text-[11px] text-stone-500">
          {formatTime(event.start_time)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-200 truncate leading-tight">
          {event.title}
        </p>
        {event.description && (
          <p className="text-xs text-stone-600 truncate mt-0.5">
            {event.description}
          </p>
        )}
      </div>

      {/* Delete — click to open confirmation dialog */}
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className={cn(
                'shrink-0 p-1 rounded select-none transition-all duration-150',
                'opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400 hover:bg-red-500/10',
              )}
              aria-label="删除事件"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-stone-900 border-stone-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-stone-100">确认删除</AlertDialogTitle>
              <AlertDialogDescription className="text-stone-400">
                是否要删除「{event.title}」？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-stone-800 border-stone-600 text-stone-200 hover:bg-stone-700 hover:text-stone-100">
                取消
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(event.id)}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export function EventList({ events, onDelete, rangeStart, rangeEnd, className }: EventListProps) {
  const upcoming = events
    .filter(e => {
      const t = new Date(e.start_time).getTime()
      if (rangeStart && rangeEnd) {
        return t >= new Date(rangeStart).getTime() && t < new Date(rangeEnd).getTime()
      }
      return t >= Date.now() - 3600_000
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 20)

  const groups = groupByDate(upcoming)

  if (upcoming.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 gap-2', className)}>
        <Calendar className="h-8 w-8 text-stone-700" />
        <p className="text-xs text-stone-600 text-center">暂无日程</p>
        <p className="text-xs text-stone-700 text-center">使用语音添加您的第一个事件</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4 overflow-y-auto', className)}>
      {Object.entries(groups).map(([date, groupEvents]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] tracking-widest uppercase text-stone-500">
              {date}
            </span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>

          <div className="flex flex-col gap-1">
            {groupEvents.map(event => (
              <EventItem key={event.id} event={event} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
