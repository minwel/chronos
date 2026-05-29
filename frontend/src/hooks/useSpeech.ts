import { useState, useRef, useCallback } from 'react'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

interface UseSpeechOptions {
  onResult: (text: string) => void | Promise<void>
  onError?: (error: string) => void
  lang?: string
}

export type SpeechState = 'idle' | 'listening' | 'processing'

export function useSpeech({ onResult, onError, lang = 'zh-CN' }: UseSpeechOptions) {
  const [state, setState] = useState<SpeechState>('idle')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const start = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      onError?.('您的浏览器不支持语音识别，请使用 Chrome 或 Edge。')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setState('listening')

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setState('processing')
      Promise.resolve(onResult(text)).finally(() => {
        setState('idle')
      })
    }

    recognition.onerror = (event) => {
      setState('idle')
      onError?.(event.error === 'no-speech' ? '未检测到语音，请重试。' : `语音识别错误：${event.error}`)
    }

    recognition.onend = () => {
      setState(prev => prev === 'listening' ? 'idle' : prev)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [lang, onResult, onError])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setState('idle')
  }, [])

  const speak = useCallback((text: string, speakLang = 'zh-CN') => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = speakLang
    utterance.rate = 0.95
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }, [])

  return { state, start, stop, speak }
}
