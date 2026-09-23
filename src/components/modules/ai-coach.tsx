'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  MessageCircle,
  Send,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Bot,
  User,
  Lightbulb,
  Moon,
  Apple,
  Stethoscope,
  Activity,
  Brain,
  Heart,
  MapPin,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const quickPrompts = [
  { icon: Moon, label: 'Improve my sleep', prompt: 'How can I improve my sleep quality during my cycle?' },
  { icon: Apple, label: 'PMS-friendly foods', prompt: 'What foods help with PMS symptoms?' },
  { icon: Stethoscope, label: 'When to see a doctor', prompt: 'What symptoms should prompt me to see a doctor about my cycle?' },
  { icon: Activity, label: 'Track the right things', prompt: 'What symptoms should I be tracking for better health insights?' },
  { icon: Brain, label: 'Understand my hormones', prompt: 'Can you explain how my hormone levels change through my cycle?' },
  { icon: Heart, label: 'Manage cycle anxiety', prompt: 'How can I manage anxiety that seems tied to my cycle?' },
]

// Chat starts empty — a friendly greeting + suggested prompts are shown in the
// empty-state UI below the chat input. No fake previous messages.
const initialMessages: Message[] = []

export default function CoachModule() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const userProfile = useAppStore((s) => s.userProfile)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Load persisted chat history when the user opens the coach
  useEffect(() => {
    const userId = userProfile?.id
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/chat?userId=${encodeURIComponent(userId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
              id: m.id,
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content,
              timestamp: new Date(m.createdAt),
            }))
          )
        }
      } catch {
        // History is best-effort — start fresh on failure
      }
    })()
    return () => { cancelled = true }
  }, [userProfile?.id])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Build history for context (last 10 messages)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history,
          userId: userProfile?.id,
        }),
      })

      const data = await response.json()

      if (data.success && data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        // Fallback response
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm here for you! While I process your question, remember that staying hydrated, getting enough sleep, and tracking your symptoms consistently can make a big difference in understanding your health. 💚\n\n*This is general wellness information. Please consult a healthcare professional for medical advice.*",
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, fallbackMessage])
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I appreciate your question! While I'm having trouble connecting right now, I'd recommend checking your tracked symptoms in the app for patterns. For any health concerns, please consult with your healthcare provider. 💚",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const resetConversation = async () => {
    setMessages(initialMessages)
    const userId = userProfile?.id
    if (userId) {
      try {
        await fetch(`/api/chat?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
        toast.success('Conversation cleared')
      } catch {
        // ignore
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">AI Health Coach</h2>
            <span className="gold-divider text-[10px]" aria-hidden><span>✦</span></span>
          </div>
          <p className="text-sm text-muted-foreground">Powered by AI • Your wellness companion</p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetConversation} className="text-muted-foreground min-h-11 shrink-0">
          <RotateCcw className="h-4 w-4 mr-1" /> Reset
        </Button>
      </div>

      {/* Safety Banner */}
      <div className="flex items-center gap-2 rounded-xl bg-gold-soft border border-gold/40 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          AI Coach provides wellness guidance, not medical diagnosis. Always consult a healthcare professional for medical concerns.
        </p>
      </div>

      {/* Chat Container */}
      <Card className="border-border bg-card shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {/* Messages Area — fills remaining viewport on mobile so the chat
              input stays visible without scrolling (chat-first UX) */}
          <ScrollArea className="h-[480px] max-lg:h-[max(240px,calc(100dvh-520px))] p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-plum-soft mb-3">
                    <Sparkles className="h-6 w-6 text-gold" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Hi{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}! I&apos;m your AI Health Coach 💚
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Ask me anything about your cycle, mood, nutrition, or fitness. Tap a suggested prompt below to get started.
                  </p>
                </div>
              )}
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    message.role === 'assistant'
                      ? 'bg-plum-soft'
                      : 'bg-blush'
                  )}>
                    {message.role === 'assistant' ? (
                      <Bot className="h-4 w-4 text-gold" />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn(
                    'min-w-0 max-w-[75%] rounded-3xl px-4 py-3',
                    message.role === 'assistant'
                      ? 'bg-blush border border-border rounded-bl-lg'
                      : 'bg-primary text-primary-foreground rounded-br-lg'
                  )}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
                    <p className={cn(
                      'text-[10px] mt-1.5',
                      message.role === 'assistant' ? 'text-muted-foreground' : 'text-primary-foreground/60'
                    )}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Typing Indicator */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex gap-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum-soft">
                      <Sparkles className="h-4 w-4 text-gold animate-pulse" />
                    </div>
                    <div className="bg-blush border border-border rounded-3xl rounded-bl-lg px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <Separator />

          {/* Quick Prompts — single horizontally-scrollable row on mobile
              (wrapping to 5 rows pushed the chat input below the fold) */}
          <div className="px-4 py-3">
            <div className="flex gap-2 flex-nowrap overflow-x-auto nuvia-scroll pb-1 lg:flex-wrap lg:overflow-x-visible lg:pb-0">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt.label}
                  variant="outline"
                  size="sm"
                  className="chip-soft shrink-0 min-h-11 px-4 text-xs gap-1.5 rounded-full"
                  onClick={() => sendMessage(prompt.prompt)}
                  disabled={isLoading}
                >
                  <prompt.icon className="h-3 w-3" />
                  {prompt.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your health..."
              className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1 min-h-11"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="btn-plum rounded-full h-11 w-11 shrink-0"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Coaching Categories */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: '🩸', label: 'Period Health', desc: 'Cycle & period guidance' },
          { icon: '🧠', label: 'Mental Wellness', desc: 'Mood & stress support' },
          { icon: '🥗', label: 'Nutrition', desc: 'Diet & supplement tips' },
          { icon: '🏃‍♀️', label: 'Exercise', desc: 'Phase-based fitness' },
        ].map((cat) => (
          <Card key={cat.label} className="border-border bg-card cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
            <CardContent className="p-4 text-center">
              <span aria-hidden className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blush text-2xl">{cat.icon}</span>
              <p className="font-medium text-sm mt-2">{cat.label}</p>
              <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Consult Doctor CTA */}
      <Card className="card-medical relative overflow-hidden">
        <div aria-hidden className="lotus-watermark absolute inset-0" />
        <CardContent className="relative p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-medical-soft shrink-0">
            <Stethoscope className="h-5 w-5 text-medical" />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h3 className="font-serif font-semibold text-sm">Facing a high-severity issue?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect with trusted healthcare specialists near you. Book appointments or video consultations instantly.
            </p>
          </div>
          <Button
            onClick={() => useAppStore.getState().setActiveModule('doctors')}
            className="btn-plum rounded-full px-6 min-h-11 font-semibold shrink-0"
            size="sm"
          >
            <MapPin className="h-4 w-4 mr-1" /> Find a Doctor
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
