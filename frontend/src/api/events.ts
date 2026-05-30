import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export interface CalendarEvent {
  id: number
  title: string
  start_time: string
  end_time?: string | null
  description?: string | null
  created_at: string
}

export interface VoiceResponse {
  action: 'add' | 'delete' | 'query' | 'pending_delete'
  event?: CalendarEvent
  events?: CalendarEvent[]
  candidates?: CalendarEvent[]
  reply: string
}

export interface PendingAction {
  type: 'delete'
  candidates: CalendarEvent[]
}

export const eventsApi = {
  list: (start?: string, end?: string) =>
    api.get<CalendarEvent[]>('/events', { params: { start, end } }).then(r => r.data),

  create: (data: Omit<CalendarEvent, 'id' | 'created_at'>) =>
    api.post<CalendarEvent>('/events', data).then(r => r.data),

  remove: (id: number) =>
    api.delete(`/events/${id}`).then(r => r.data),

  voice: (text: string, pendingAction?: PendingAction, signal?: AbortSignal) =>
    api.post<VoiceResponse>('/voice', { text, pending_action: pendingAction }, { signal }).then(r => r.data),
}
