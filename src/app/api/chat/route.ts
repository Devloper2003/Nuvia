import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SYSTEM_PROMPT = `You are ChandraCycle, an AI Women's Health Coach. You provide empathetic, evidence-based wellness guidance about menstrual health, hormonal changes, fertility, pregnancy, PCOS, menopause, nutrition, exercise, and mental wellbeing.

IMPORTANT SAFETY RULES:
- You are a wellness coach, NOT a medical professional
- Never diagnose conditions or prescribe treatments
- Always recommend consulting a healthcare professional for medical concerns
- If a user describes severe symptoms (heavy bleeding, severe pain, signs of emergency), urge them to seek immediate medical attention
- Be supportive, non-judgmental, and culturally sensitive
- Use simple, accessible language

Your knowledge areas:
1. Menstrual cycle phases and what to expect
2. Hormonal fluctuations and their effects on mood, energy, sleep
3. PMS/PMDD management strategies
4. Fertility awareness and ovulation tracking
5. Early pregnancy wellness
6. PCOS lifestyle management
7. Perimenopause and menopause navigation
8. Nutrition for hormonal health
9. Exercise recommendations by cycle phase
10. Stress management and mental health support
11. Sleep hygiene tips
12. When to see a doctor

Always end responses with a supportive note and remind users you provide wellness information, not medical advice.`

// ─── GET: load chat history for a user ──────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const messages = await db.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Chat history fetch error:', error)
    return NextResponse.json({ messages: [] })
  }
}

// ─── POST: generate AI reply (and persist both messages when userId given) ──
export async function POST(request: NextRequest) {
  try {
    const { message, history = [], userId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Use z-ai-web-dev-sdk for AI chat
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Build conversation messages
    const messages = [
      { role: 'assistant' as const, content: SYSTEM_PROMPT },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })

    const response = completion.choices?.[0]?.message?.content

    if (!response) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Persist the conversation when we know the user. Verify the user exists
    // first so stale/foreign ids can't trigger FK errors. Never let a DB
    // hiccup break the chat itself.
    if (userId && typeof userId === 'string') {
      try {
        const userExists = await db.user.findUnique({
          where: { id: userId },
          select: { id: true },
        })
        if (userExists) {
          await db.chatMessage.createMany({
            data: [
              { userId, role: 'user', content: message },
              { userId, role: 'assistant', content: response },
            ],
          })
        }
      } catch (persistError) {
        console.error('Chat persist error:', persistError)
      }
    }

    return NextResponse.json({
      success: true,
      response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}

// ─── DELETE: clear chat history for a user ──────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    await db.chatMessage.deleteMany({ where: { userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chat clear error:', error)
    return NextResponse.json(
      { error: 'Failed to clear history' },
      { status: 500 }
    )
  }
}
