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

export type SpeechState = 'idle' | 'listening' | 'processing' | 'awaiting_confirm'

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
        // 只在仍为 processing 时回到 idle，避免覆盖 awaiting_confirm 等状态
        setState(prev => prev === 'processing' ? 'idle' : prev)
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

  const speak = useCallback((text: string, onEnd?: () => void, speakLang = 'zh-CN') => {
    if (!window.speechSynthesis) {
      onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    // Chrome bug workaround: cancel() 后立刻 speak() 可能被吞掉，
    // 尤其是在语音识别刚结束时。加短延迟确保合成引擎就绪。
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = speakLang
      utterance.rate = 0.95
      utterance.pitch = 1
      if (onEnd) {
        utterance.onend = () => onEnd()
      }
      window.speechSynthesis.speak(utterance)
    }, 150)
  }, [])

  const setAwaitingConfirm = useCallback(() => {
    setState('awaiting_confirm')
  }, [])

  return { state, start, stop, speak, setAwaitingConfirm }
}
