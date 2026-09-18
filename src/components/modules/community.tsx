'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users,
  Heart,
  MessageCircle,
  Plus,
  TrendingUp,
  Trophy,
  Award,
  Star,
  Shield,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Target,
  CheckCircle2,
  ArrowRight,
  Crown,
  Zap,
  BookOpen,
  HandHeart,
  Sparkles,
  Send,
  X,
  ChevronRight,
  UserCircle,
  Hash,
  Loader2,
  Trash2,
  Flag,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore } from '@/lib/store'

// ─── Types ────────────────────────────────────────────────────────

type Category = 'General' | 'PCOS' | 'Fertility' | 'Pregnancy' | 'Menopause' | 'Mental Health'

interface CommentItem {
  id: string
  content: string
  author: string
  timeAgo: string
  isAnonymous: boolean
  isOwn: boolean
}

interface Post {
  id: string
  username: string
  title: string
  content: string
  category: Category
  likes: number
  comments: number
  timeAgo: string
  liked: boolean
  isAnonymous: boolean
  isOwn: boolean
  reportedCount: number
  createdAt: string
}

interface TrendingTopic {
  id: string
  topic: string
  posts: number
  trending: boolean
}

interface SupportGroup {
  id: string
  name: string
  description: string
  members: number
  icon: React.ElementType
  color: string
  joined: boolean
}

interface Challenge {
  id: string
  name: string
  description: string
  participants: number
  progress: number
  daysLeft: number
  joined: boolean
}

interface Badge_ {
  id: string
  name: string
  description: string
  icon: React.ElementType
  earned: boolean
  color: string
}

// ─── Category mapping (UI ↔ API) ─────────────────────────────────

const categories: Category[] = ['General', 'PCOS', 'Fertility', 'Pregnancy', 'Menopause', 'Mental Health']

const categoryColors: Record<Category, string> = {
  General: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  PCOS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Fertility: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Pregnancy: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Menopause: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Mental Health': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}

const toApiCategory: Record<Category, string> = {
  General: 'general',
  PCOS: 'pcos',
  Fertility: 'fertility',
  Pregnancy: 'pregnancy',
  Menopause: 'menopause',
  'Mental Health': 'mental_health',
}

const fromApiCategory: Record<string, Category> = {
  general: 'General',
  pcos: 'PCOS',
  fertility: 'Fertility',
  pregnancy: 'Pregnancy',
  menopause: 'Menopause',
  mental_health: 'Mental Health',
}

const REPORT_REASONS = [
  'Spam or scam',
  'Harassment or bullying',
  'Inappropriate content',
  'Misleading health information',
  'Other',
] as const

// ─── Helpers ──────────────────────────────────────────────────────

const FLOWERS = ['Lotus', 'Sakhi', 'Amber', 'River', 'Jasmine', 'Peony', 'Rose', 'Lily', 'Daisy', 'Iris']

// Deterministic anonymous display name derived from an id — stable across
// reloads so anonymous users keep the same alias for a given post/comment.
function anonName(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  const flower = FLOWERS[hash % FLOWERS.length]
  const num = hash % 100
  return `${flower}_${num}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// Raw API post → UI Post
interface ApiPost {
  id: string
  title: string
  content: string
  category: string
  isAnonymous: boolean
  likes: number
  reportedCount: number
  createdAt: string
  comments?: Array<{ id: string }>
  user?: { id: string; name: string | null; avatar: string | null }
}

function mapApiPost(p: ApiPost, currentUserId: string | undefined, likedIds: Set<string>): Post {
  const category = fromApiCategory[p.category] ?? 'General'
  const isOwn = currentUserId && p.user?.id === currentUserId
  const username = p.isAnonymous
    ? anonName(p.id)
    : isOwn
      ? 'You'
      : (p.user?.name || 'Community member')
  return {
    id: p.id,
    username,
    title: p.title,
    content: p.content,
    category,
    likes: p.likes,
    comments: p.comments?.length ?? 0,
    timeAgo: timeAgo(p.createdAt),
    liked: likedIds.has(p.id),
    isAnonymous: p.isAnonymous,
    isOwn: !!isOwn,
    reportedCount: p.reportedCount ?? 0,
    createdAt: p.createdAt,
  }
}

// Empty arrays — groups & challenges launch later; badges are progress-driven.
const initialSupportGroups: SupportGroup[] = []
const initialChallenges: Challenge[] = []

const userBadges: Badge_[] = [
  { id: '1', name: 'First Post', description: 'Created your first post', icon: Send, earned: false, color: 'text-primary' },
  { id: '2', name: 'Helpful', description: 'Received 10+ likes on a comment', icon: HandHeart, earned: false, color: 'text-emerald-500' },
  { id: '3', name: 'Supportive', description: 'Commented on 25+ posts', icon: Heart, earned: false, color: 'text-pink-500' },
  { id: '4', name: 'Challenger', description: 'Completed a community challenge', icon: Trophy, earned: false, color: 'text-amber-500' },
  { id: '5', name: 'Rising Star', description: 'Get 50+ likes on a post', icon: Star, earned: false, color: 'text-purple-500' },
  { id: '6', name: 'Mentor', description: 'Help 100 community members', icon: Crown, earned: false, color: 'text-orange-500' },
]

// ─── Component ────────────────────────────────────────────────────

export default function CommunityModule() {
  const userProfile = useAppStore((s) => s.userProfile)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalPosts, setTotalPosts] = useState(0)
  const nextOffsetRef = useRef(0)
  const [posting, setPosting] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  // Ref mirror of likedIds so mapping/loading doesn't need it in deps
  // (otherwise every like would re-trigger a full feed reload).
  const likedIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    likedIdsRef.current = likedIds
  }, [likedIds])
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All')
  const [supportGroups] = useState<SupportGroup[]>(initialSupportGroups)
  const [challenges] = useState<Challenge[]>(initialChallenges)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'General' as Category,
    anonymous: true,
  })
  const [activeTab, setActiveTab] = useState<'feed' | 'groups' | 'challenges'>('feed')

  // Comments dialog state
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null)
  const [commentsList, setCommentsList] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentPosting, setCommentPosting] = useState(false)
  const [reportPost, setReportPost] = useState<Post | null>(null)
  const [reportComment, setReportComment] = useState<CommentItem | null>(null)
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0])

  // ─── Server-side paginated + category-filtered loading ────────────────────
  const PAGE_SIZE = 4
  const categoryQuery = (cat: Category | 'All') =>
    cat === 'All' ? '' : `&category=${encodeURIComponent(toApiCategory[cat])}`

  const mapPage = (data: ApiPost[]) =>
    data.map((p) => mapApiPost(p, userProfile?.id, likedIdsRef.current))

  const loadPosts = useCallback(async (cat: Category | 'All' = 'All') => {
    try {
      nextOffsetRef.current = 0
      const res = await fetch(`/api/community?limit=${PAGE_SIZE}&offset=0${categoryQuery(cat)}`)
      if (!res.ok) throw new Error('Failed to load posts')
      const data = (await res.json()) as { posts: ApiPost[]; total: number; hasMore: boolean; nextOffset: number }
      setPosts(mapPage(data.posts))
      setTotalPosts(data.total)
      setHasMore(data.hasMore)
      nextOffsetRef.current = data.nextOffset
    } catch {
      toast.error('Could not load community posts')
    } finally {
      setLoading(false)
    }
  }, [userProfile?.id])

  const loadMorePosts = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/community?limit=${PAGE_SIZE}&offset=${nextOffsetRef.current}${categoryQuery(activeCategory)}`
      )
      if (!res.ok) throw new Error('Failed to load more posts')
      const data = (await res.json()) as { posts: ApiPost[]; total: number; hasMore: boolean; nextOffset: number }
      setPosts((prev) => [...prev, ...mapPage(data.posts)])
      setHasMore(data.hasMore)
      nextOffsetRef.current = data.nextOffset
    } catch {
      toast.error('Could not load more posts')
    } finally {
      setLoadingMore(false)
    }
  }

  // Initial load (All)
  useEffect(() => {
    loadPosts('All')
  }, [loadPosts])

  // Server-side category filter: reload page 1 whenever the filter changes.
  const firstCategoryRender = useRef(true)
  useEffect(() => {
    if (firstCategoryRender.current) {
      firstCategoryRender.current = false
      return
    }
    setLoading(true)
    loadPosts(activeCategory)
  }, [activeCategory, loadPosts])

  // ─── Derived ────────────────────────────────────────────────────
  const filteredPosts = activeCategory === 'All'
    ? posts
    : posts.filter(p => p.category === activeCategory)

  // Full-stats snapshot (legacy endpoint returns the entire feed) — keeps
  // trending topics, category chip counts and gamification accurate even
  // though the visible feed is paginated/filtered.
  const [statsPosts, setStatsPosts] = useState<ApiPost[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/community')
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data: ApiPost[]) => {
        if (!cancelled && Array.isArray(data)) setStatsPosts(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [totalPosts])

  const mappedStats = useMemo(
    () => statsPosts.map((p) => mapApiPost(p, userProfile?.id, likedIdsRef.current)),
    [statsPosts, userProfile?.id]
  )

  // Per-category totals for the filter chips
  const categoryCounts = useMemo(() => {
    const counts = {} as Record<Category, number>
    for (const cat of categories) counts[cat] = 0
    for (const p of mappedStats) counts[p.category] = (counts[p.category] ?? 0) + 1
    return counts
  }, [mappedStats])

  // Live trending topics — top categories by post count
  const trendingTopics: TrendingTopic[] = categories
    .map((cat, i) => ({
      id: String(i + 1),
      topic: `#${cat.replace(' ', '')}`,
      posts: categoryCounts[cat] ?? 0,
      trending: (categoryCounts[cat] ?? 0) >= 2,
    }))
    .filter(t => t.posts > 0)
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 5)

  // Gamification — derived from REAL community activity
  const myPosts = mappedStats.filter(p => userProfile && p.isOwn).length
  const supportScore = myPosts * 20 + mappedStats.reduce((acc, p) => acc + p.likes, 0) * 5
  const nextLevel = 100
  const level = Math.floor(supportScore / nextLevel) + 1
  const levelNames = ['Newcomer', 'Friend', 'Supporter', 'Advocate', 'Champion', 'Guardian']
  const levelName = levelNames[Math.min(level - 1, levelNames.length - 1)]
  const earnedBadges = userBadges.map(b => ({
    ...b,
    earned:
      (b.id === '1' && myPosts >= 1) ||
      (b.id === '5' && mappedStats.some(p => p.likes >= 5)) ||
      (b.id === '3' && mappedStats.reduce((acc, p) => acc + p.comments, 0) >= 3),
  }))

  const generateAnonName = () => {
    const flower = FLOWERS[Math.floor(Math.random() * FLOWERS.length)]
    const num = Math.floor(Math.random() * 100)
    return `${flower}_${num}`
  }

  // ─── Actions ────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return
    if (!userProfile) {
      toast.error('Please sign in to post')
      return
    }
    setPosting(true)
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.id,
          title: newPost.title.trim(),
          content: newPost.content.trim(),
          category: toApiCategory[newPost.category],
          isAnonymous: newPost.anonymous,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create post')
      }
      const created: ApiPost = await res.json()
      const createdUi = mapApiPost(created, userProfile.id, likedIdsRef.current)
      // Only prepend when it matches the active server-side filter.
      if (activeCategory === 'All' || createdUi.category === activeCategory) {
        setPosts(prev => [createdUi, ...prev])
        setTotalPosts(t => t + 1)
      } else {
        toast.success(`Posted! Switch to #${createdUi.category} to see it in the feed.`)
      }
      setNewPost({ title: '', content: '', category: 'General', anonymous: true })
      setDialogOpen(false)
      toast.success('Post shared with the community 💙')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create post')
    } finally {
      setPosting(false)
    }
  }

  const toggleLike = async (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (!post || !userProfile) return
    const willLike = !post.liked

    // Optimistic update
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, liked: willLike, likes: Math.max(0, willLike ? p.likes + 1 : p.likes - 1) }
          : p
      )
    )
    setLikedIds(prev => {
      const next = new Set(prev)
      if (willLike) next.add(postId)
      else next.delete(postId)
      return next
    })

    try {
      const res = await fetch('/api/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action: willLike ? 'like' : 'unlike' }),
      })
      if (!res.ok) throw new Error()
      const updated: ApiPost = await res.json()
      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, likes: updated.likes } : p))
      )
    } catch {
      // Revert on failure
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, liked: !willLike, likes: Math.max(0, !willLike ? p.likes + 1 : p.likes - 1) }
            : p
        )
      )
      toast.error('Could not update like')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!userProfile) return
    const prevPosts = posts
    // Optimistic removal
    setPosts(prev => prev.filter(p => p.id !== postId))
    try {
      const res = await fetch(
        `/api/community?postId=${encodeURIComponent(postId)}&userId=${encodeURIComponent(userProfile.id)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete post')
      }
      toast.success('Post deleted')
    } catch (e) {
      setPosts(prevPosts)
      toast.error(e instanceof Error ? e.message : 'Could not delete post')
    }
  }

  // ─── Report a post (moderation flow) ────────────────────────────────────
  const handleReportPost = async (postId: string, reason: string) => {
    const prevPosts = posts
    // The reporter should not keep seeing the flagged post
    setPosts(prev => prev.filter(p => p.id !== postId))
    try {
      const res = await fetch('/api/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action: 'report', reason, userId: userProfile?.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to report post')
      }
      const data = await res.json()
      toast.success(data.message || 'Report submitted. Thank you for keeping the community safe.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not report post'
      if (msg.toLowerCase().includes('already reported')) {
        // De-duplicated server-side: keep it hidden for the reporter, no error.
        toast.info(msg)
      } else {
        setPosts(prevPosts)
        toast.error(msg)
      }
    }
  }

  // ─── Report a comment (moderation flow, mirrors post reporting) ─────────
  const handleReportComment = async (commentId: string, reason: string) => {
    const prevList = commentsList
    // The reporter should not keep seeing the flagged comment
    setCommentsList(prev => prev.filter(c => c.id !== commentId))
    try {
      const res = await fetch('/api/community/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, action: 'report', reason, userId: userProfile?.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to report comment')
      }
      const data = await res.json()
      toast.success(data.message || 'Report submitted. Thank you for keeping the community safe.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not report comment'
      if (msg.toLowerCase().includes('already reported')) {
        toast.info(msg)
      } else {
        setCommentsList(prevList)
        toast.error(msg)
      }
    }
  }

  // ─── Comments ───────────────────────────────────────────────────
  const openComments = async (postId: string) => {
    setCommentsPostId(postId)
    setCommentsLoading(true)
    setCommentsList([])
    setNewComment('')
    try {
      const res = await fetch(`/api/community/comments?postId=${postId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCommentsList(
        data.map((c: { id: string; content: string; isAnonymous: boolean; createdAt: string; user?: { id: string; name: string | null } }) => ({
          id: c.id,
          content: c.content,
          author: c.isAnonymous ? anonName(c.id) : (c.user?.name || 'Member'),
          timeAgo: timeAgo(c.createdAt),
          isAnonymous: c.isAnonymous,
          isOwn: c.user?.id === userProfile?.id,
        }))
      )
    } catch {
      toast.error('Could not load comments')
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !commentsPostId || !userProfile) return
    setCommentPosting(true)
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: commentsPostId,
          userId: userProfile.id,
          content: newComment.trim(),
          isAnonymous: true,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      const c = created as { id: string; content: string; isAnonymous: boolean; createdAt: string }
      setCommentsList(prev => [
        ...prev,
        {
          id: c.id,
          content: c.content,
          author: anonName(c.id),
          timeAgo: 'Just now',
          isAnonymous: true,
        },
      ])
      setPosts(prev =>
        prev.map(p => (p.id === commentsPostId ? { ...p, comments: p.comments + 1 } : p))
      )
      setNewComment('')
      toast.success('Comment added 💬')
    } catch {
      toast.error('Could not add comment')
    } finally {
      setCommentPosting(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    setSupportGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? {
              ...g,
              joined: !g.joined,
              members: g.joined ? g.members - 1 : g.members + 1,
            }
          : g
      )
    )
  }

  const toggleChallenge = (challengeId: string) => {
    setChallenges(prev =>
      prev.map(c =>
        c.id === challengeId
          ? {
              ...c,
              joined: !c.joined,
              participants: c.joined ? c.participants - 1 : c.participants + 1,
            }
          : c
      )
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-blush text-primary shrink-0">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            Community
          </h1>
          <p className="text-muted-foreground mt-1">Connect, share, and support each other</p>
          <span aria-hidden="true" className="gold-divider text-[10px] mt-1.5"><span>✦</span></span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-plum rounded-full px-6 min-h-11 font-semibold">
              <Plus className="h-4 w-4 mr-1.5" /> Create Post
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a Post</DialogTitle>
              <DialogDescription>Share your thoughts with the community</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Title</Label>
                <Input
                  placeholder="What's on your mind?"
                  value={newPost.title}
                  onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Content</Label>
                <Textarea
                  placeholder="Share your experience, ask a question, or offer support..."
                  rows={4}
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Category</Label>
                <Select
                  value={newPost.category}
                  onValueChange={(v) => setNewPost(prev => ({ ...prev, category: v as Category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {newPost.anonymous ? <EyeOff className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  <Label className="text-sm">Post anonymously</Label>
                </div>
                <Switch
                  checked={newPost.anonymous}
                  onCheckedChange={(v) => setNewPost(prev => ({ ...prev, anonymous: v }))}
                />
              </div>
              {newPost.anonymous && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Your username will appear as a random flower name like &quot;Lotus_42&quot;
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreatePost}
                  className="btn-plum rounded-full px-6 min-h-11 font-semibold"
                  disabled={!newPost.title.trim() || !newPost.content.trim() || posting}
                >
                  {posting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  {posting ? 'Posting…' : 'Post'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Gamification Bar */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="card-blush relative overflow-hidden">
          <CardContent className="relative py-4">
            <div aria-hidden="true" className="lotus-watermark absolute inset-0" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-plum-soft flex items-center justify-center text-gold font-bold text-lg shadow-sm shrink-0">
                  {level}
                </div>
                <div>
                  <p className="font-semibold text-sm">Level {level} — {levelName}</p>
                  <p className="text-xs text-muted-foreground">{supportScore} / {level * nextLevel} points to Level {level + 1}</p>
                </div>
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <Progress value={((supportScore % nextLevel) / nextLevel) * 100} className="h-2.5" />
              </div>
              <div className="flex items-center gap-1.5">
                {earnedBadges.filter(b => b.earned).map(badge => {
                  const Icon = badge.icon
                  return (
                    <div
                      key={badge.id}
                      className="h-8 w-8 rounded-full bg-card border border-gold/40 flex items-center justify-center shadow-sm"
                      title={`${badge.name}: ${badge.description}`}
                    >
                      <Icon className={`h-4 w-4 ${badge.color}`} />
                    </div>
                  )
                })}
                <div className="h-8 w-8 rounded-full bg-muted border border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground font-medium">+{earnedBadges.filter(b => !b.earned).length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 bg-muted rounded-lg p-1 w-fit max-w-full">
        {[
          { key: 'feed' as const, label: 'Feed', icon: MessageCircle },
          { key: 'groups' as const, label: 'Groups', icon: Users },
          { key: 'challenges' as const, label: 'Challenges', icon: Trophy },
        ].map(tab => (
          <Button
            key={tab.key}
            size="sm"
            variant={activeTab === tab.key ? 'default' : 'ghost'}
            className="text-xs px-4 min-h-11"
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon className="h-3.5 w-3.5 mr-1.5" />
            {tab.label}
          </Button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'feed' && (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {/* Feed Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Category Filters */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={activeCategory === 'All' ? 'default' : 'outline'}
                  className={`text-xs shrink-0 rounded-full min-h-11 ${activeCategory === 'All' ? '' : 'chip-soft text-muted-foreground hover:text-primary'}`}
                  onClick={() => setActiveCategory('All')}
                >
                  <Filter className="h-3 w-3 mr-1" /> All
                  <span className={`ml-1.5 rounded-full px-1.5 text-[10px] leading-4 ${activeCategory === 'All' ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'}`}>
                    {totalPosts}
                  </span>
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={activeCategory === cat ? 'default' : 'outline'}
                    className={`text-xs shrink-0 rounded-full min-h-11 ${activeCategory === cat ? '' : 'chip-soft text-muted-foreground hover:text-primary'}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    <Hash className="h-3 w-3 mr-1" />
                    {cat}
                    <span className={`ml-1.5 rounded-full px-1.5 text-[10px] leading-4 ${activeCategory === cat ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'}`}>
                      {categoryCounts[cat] ?? 0}
                    </span>
                  </Button>
                ))}
              </div>

              {/* Posts */}
              {loading ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground mt-3">Loading community feed…</p>
                  </CardContent>
                </Card>
              ) : filteredPosts.length === 0 ? (
                <Card className="border-dashed border-primary/30">
                  <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blush mb-3">
                      <MessageCircle className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {activeCategory === 'All' ? 'Be the first to post' : `No ${activeCategory} posts yet`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Share a question, story, or encouragement. The community grows when you take the first step.
                    </p>
                    <Button
                      size="sm"
                      className="btn-plum mt-4 rounded-full px-6 min-h-11 font-semibold"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Create the first post
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="max-h-[600px] chandracycle-scroll">
                  <div className="space-y-3">
                    {filteredPosts.map((post, idx) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="py-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarFallback className="bg-blush text-primary text-xs font-semibold">
                                  {post.username.split('_')[0][0]}{post.username.split('_')[1]?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold">{post.username}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] border-0 ${categoryColors[post.category]}`}
                                  >
                                    {post.category}
                                  </Badge>
                                  {post.isOwn && post.reportedCount > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 gap-1"
                                      title="Some members flagged this post — a moderator will review it"
                                    >
                                      <Flag className="h-2.5 w-2.5" />
                                      {post.reportedCount} report{post.reportedCount === 1 ? '' : 's'} · under review
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">{post.timeAgo}</span>
                                </div>
                                <h3 className="font-semibold text-sm mt-1 leading-snug">{post.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{post.content}</p>
                                <div className="flex items-center gap-4 mt-3">
                                  <button
                                    onClick={() => toggleLike(post.id)}
                                    className={`flex items-center gap-1.5 text-xs min-h-11 px-1 -mx-1 rounded-md transition-colors ${
                                      post.liked
                                        ? 'text-primary font-medium'
                                        : 'text-muted-foreground hover:text-primary'
                                    }`}
                                  >
                                    <Heart
                                      className={`h-3.5 w-3.5 transition-transform ${post.liked ? 'fill-primary text-primary scale-110' : ''}`}
                                    />
                                    {post.likes}
                                  </button>
                                  <button
                                    onClick={() => openComments(post.id)}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-11 px-1 -mx-1 rounded-md"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    {post.comments}
                                  </button>
                                  {!post.isOwn && (
                                    <button
                                      onClick={() => {
                                        setReportReason(REPORT_REASONS[0])
                                        setReportPost(post)
                                      }}
                                      aria-label="Report post"
                                      title="Report post"
                                      className="group/flag flex items-center gap-1.5 text-xs text-muted-foreground hover:text-orange-500 transition-colors min-h-11 px-1 rounded-md ml-auto"
                                    >
                                      <Flag className="h-3.5 w-3.5 transition-transform group-hover/flag:scale-125 group-hover/flag:-rotate-12" />
                                    </button>
                                  )}
                                  {post.isOwn && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          aria-label="Delete post"
                                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors min-h-11 px-1 rounded-md ml-auto"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            &quot;{post.title}&quot; and all its comments will be permanently removed. This cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-red-500 hover:bg-red-600 text-white"
                                            onClick={() => handleDeletePost(post.id)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}

                    {/* Load more — pagination footer */}
                    {hasMore && (
                      <button
                        onClick={loadMorePosts}
                        disabled={loadingMore}
                        className="w-full flex items-center justify-center gap-2 py-3 min-h-11 rounded-xl border border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-blush/60 dark:hover:bg-primary/10 transition-colors disabled:opacity-60"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> Load more posts
                            <span className="text-[10px] text-muted-foreground">
                              {posts.length} of {totalPosts}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                    {!hasMore && posts.length > 0 && (
                      <div className="text-center py-2">
                        <p className="text-[11px] text-muted-foreground">
                          You're all caught up 🌙 {totalPosts} post{totalPosts === 1 ? '' : 's'} in the community
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Trending Topics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Trending Topics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendingTopics.length === 0 ? (
                    <div className="py-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        No trending topics yet. As the community grows, popular topics will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {trendingTopics.map((topic, idx) => (
                        <motion.div
                          key={topic.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + idx * 0.04 }}
                          className="flex items-center justify-between group cursor-pointer"
                          onClick={() => {
                            const cat = topic.topic.replace('#', '') as Category
                            const matched = categories.find(c => c.replace(' ', '') === cat.replace(' ', ''))
                            if (matched) setActiveCategory(matched)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground w-5">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-medium group-hover:text-primary transition-colors">{topic.topic}</p>
                              <p className="text-[10px] text-muted-foreground">{topic.posts} posts</p>
                            </div>
                          </div>
                          {topic.trending && (
                            <Flame className="h-3.5 w-3.5 text-orange-500" />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Badges */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-gold" />
                    Your Badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {earnedBadges.map(badge => {
                      const Icon = badge.icon
                      return (
                        <div
                          key={badge.id}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border ${
                            badge.earned
                              ? 'border-gold/40 bg-gold-soft/50'
                              : 'border-dashed border-muted-foreground/20 opacity-50'
                          }`}
                          title={badge.description}
                        >
                          <Icon className={`h-5 w-5 ${badge.earned ? badge.color : 'text-muted-foreground'}`} />
                          <span className="text-[11px] text-center font-medium leading-tight">{badge.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {activeTab === 'groups' && (
          <motion.div
            key="groups"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {supportGroups.length === 0 ? (
              <Card className="border-dashed border-primary/30">
                <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blush mb-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No support groups yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Support groups will appear here as they become available. In the meantime, head to the feed to connect with the community.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 rounded-full px-5 min-h-11 border-primary/40 text-primary hover:bg-blush/60 dark:hover:bg-primary/10"
                    onClick={() => setActiveTab('feed')}
                  >
                    Browse the feed
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {supportGroups.map((group, idx) => {
                  const Icon = group.icon
                  return (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                    >
                      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${group.color} shadow-lg`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-sm">{group.name}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">{group.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-auto">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <UserCircle className="h-3.5 w-3.5" />
                              {group.members.toLocaleString()} members
                            </div>
                            <Button
                              size="sm"
                              variant={group.joined ? 'outline' : 'default'}
                              className={`text-xs rounded-full min-h-11 px-5 font-semibold ${
                                group.joined
                                  ? 'border-primary/40 text-primary'
                                  : 'btn-plum'
                              }`}
                              onClick={() => toggleGroup(group.id)}
                            >
                              {group.joined ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Joined
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" /> Join
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'challenges' && (
          <motion.div
            key="challenges"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {challenges.length === 0 ? (
              <Card className="border-dashed border-primary/30">
                <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blush mb-3">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No challenges yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Community challenges will appear here when they launch. Check back soon for goals you can join.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 rounded-full px-5 min-h-11 border-primary/40 text-primary hover:bg-blush/60 dark:hover:bg-primary/10"
                    onClick={() => setActiveTab('feed')}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Explore the feed
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {challenges.map((challenge, idx) => (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shrink-0">
                              <Target className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-sm">{challenge.name}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">{challenge.description}</CardDescription>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Users className="h-3 w-3" /> {challenge.participants} joined
                                </span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Zap className="h-3 w-3" /> {challenge.daysLeft} days left
                                </span>
                              </div>
                              <Progress value={challenge.progress} className="h-1.5 mt-2 max-w-xs" />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={challenge.joined ? 'outline' : 'default'}
                            className={`text-xs rounded-full min-h-11 px-5 font-semibold shrink-0 ${
                              challenge.joined
                                ? 'border-primary/40 text-primary'
                                : 'btn-plum'
                            }`}
                            onClick={() => toggleChallenge(challenge.id)}
                          >
                            {challenge.joined ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                            {challenge.joined ? 'Joined' : 'Join'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Dialog */}
      <Dialog open={!!commentsPostId} onOpenChange={(open) => !open && setCommentsPostId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
            <DialogDescription>Support others with a kind reply</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <ScrollArea className="max-h-64 chandracycle-scroll">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : commentsList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No comments yet. Be the first to reply 💙
                </p>
              ) : (
                <div className="space-y-3 pr-2">
                  {commentsList.map(c => (
                    <div key={c.id} className="group flex items-start gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-blush text-primary text-[10px] font-semibold">
                          {c.author.split('_')[0][0]}{c.author.split('_')[1]?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted/60 group-hover:bg-muted rounded-xl rounded-tl-sm px-3 py-2 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{c.author}</span>
                          <span className="text-[10px] text-muted-foreground">{c.timeAgo}</span>
                        </div>
                        <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed">{c.content}</p>
                      </div>
                      {!c.isOwn && (
                        <button
                          onClick={() => { setReportReason(REPORT_REASONS[0]); setReportComment(c) }}
                          className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 shrink-0 rounded-md p-1.5 text-muted-foreground/70 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-all"
                          aria-label="Report comment"
                          title="Report comment"
                        >
                          <Flag className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <Separator />
            <div className="flex items-center gap-2">
              <Input
                placeholder="Write a supportive comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                disabled={commentPosting}
              />
              <Button
                size="icon"
                className="btn-plum shrink-0 rounded-full h-11 w-11 min-w-11"
                onClick={handleAddComment}
                disabled={!newComment.trim() || commentPosting}
              >
                {commentPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Post / Comment Dialog */}
      <Dialog
        open={!!reportPost || !!reportComment}
        onOpenChange={(open) => { if (!open) { setReportPost(null); setReportComment(null) } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-orange-500" />
              {reportComment ? 'Report this comment?' : 'Report this post?'}
            </DialogTitle>
            <DialogDescription>
              {reportComment
                ? `"${reportComment.content.slice(0, 90)}${reportComment.content.length > 90 ? '…' : ''}" — your report is anonymous and helps keep this space safe.`
                : `"${reportPost?.title}" — your report is anonymous and helps keep this space safe.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              {REPORT_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`w-full text-left text-xs rounded-lg border px-3 py-2.5 min-h-11 flex items-center transition-colors ${
                    reportReason === reason
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-foreground font-medium'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setReportPost(null); setReportComment(null) }}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  const postId = reportPost?.id
                  const commentId = reportComment?.id
                  setReportPost(null)
                  setReportComment(null)
                  if (postId) void handleReportPost(postId, reportReason)
                  if (commentId) void handleReportComment(commentId, reportReason)
                }}
              >
                <Flag className="h-3.5 w-3.5 mr-1.5" />
                Submit report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
