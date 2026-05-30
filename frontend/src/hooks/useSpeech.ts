import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { transcript: string }
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResult[]
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
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // 用 ref 保持回调最新引用，避免 TTS onEnd 自动开麦时闭包捕获旧的 pendingAction 等状态
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const start = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      onErrorRef.current?.('您的浏览器不支持语音识别，请使用 Chrome 或 Edge。')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = lang
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setInterimText('')
      setState('listening')
    }

    recognition.onresult = (event) => {
      const result = event.results[0]
      const text = result[0].transcript
      if (result.isFinal) {
        setInterimText('')
        setState('processing')
        Promise.resolve(onResultRef.current(text)).finally(() => {
          setState(prev => prev === 'processing' ? 'idle' : prev)
        })
      } else {
        setInterimText(text)
      }
    }

    recognition.onerror = (event) => {
      setState('idle')
      onErrorRef.current?.(event.error === 'no-speech' ? '未检测到语音，请重试。' : `语音识别错误：${event.error}`)
    }

    recognition.onend = () => {
      setState(prev => prev === 'listening' ? 'idle' : prev)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setInterimText('')
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

  return { state, interimText, start, stop, speak, setAwaitingConfirm }
}
