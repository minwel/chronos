import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core'
import type { CalendarEvent } from '@/api/events'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
  events: CalendarEvent[]
  onDateRangeChange?: (start: string, end: string) => void
  onEventClick?: (eventId: number) => void
  className?: string
}

export function CalendarView({ events, onDateRangeChange, onEventClick, className }: CalendarViewProps) {
  const fcEvents = events.map(e => ({
    id: String(e.id),
    title: e.title,
    start: e.start_time,
    end: e.end_time ?? undefined,
    extendedProps: { description: e.description },
  }))

  const handleDatesSet = (info: DatesSetArg) => {
    onDateRangeChange?.(info.startStr, info.endStr)
  }

  const handleEventClick = (info: EventClickArg) => {
    onEventClick?.(Number(info.event.id))
  }

  return (
    <div className={cn('h-full [&_.fc]:h-full', className)}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="zh-cn"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{
          today: '今天',
          month: '月',
          week: '周',
          day: '日',
        }}
        events={fcEvents}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        height="100%"
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        dayMaxEvents={3}
        nowIndicator
      />
    </div>
  )
}
