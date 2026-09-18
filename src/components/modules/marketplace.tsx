'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  Star,
  Heart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  X,
  ChevronRight,
  ChevronLeft,
  Flame,
  Clock,
  Gift,
  Award,
  Package,
  CreditCard,
  RotateCcw,
  BadgePercent,
  Leaf,
  Baby,
  Dumbbell,
  Droplet,
  Pill,
  Flower2,
  ThermometerSun,
  FlaskConical,
  BookOpen,
  Wind,
  Activity,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryId =
  | 'all'
  | 'period'
  | 'supplements'
  | 'skincare'
  | 'fertility'
  | 'pregnancy'
  | 'wellness'
  | 'fitness'

interface Product {
  id: string
  name: string
  brand: string
  category: Exclude<CategoryId, 'all'>
  categoryLabel: string
  price: number
  originalPrice: number
  rating: number
  reviews: number
  emoji: string
  gradient: string
  description: string
  bestSeller?: boolean
  aiRecommended?: boolean
  trending?: boolean
}

interface CartItem {
  product: Product
  quantity: number
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const CATEGORIES: { id: CategoryId; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All Products', icon: ShoppingBag },
  { id: 'period', label: 'Period Care', icon: Droplet },
  { id: 'supplements', label: 'Supplements', icon: Pill },
  { id: 'skincare', label: 'Skincare', icon: Flower2 },
  { id: 'fertility', label: 'Fertility', icon: ThermometerSun },
  { id: 'pregnancy', label: 'Pregnancy', icon: Baby },
  { id: 'wellness', label: 'Wellness', icon: Leaf },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
]

// NOTE: Demo / placeholder product listings were removed. The marketplace has no
// real product backend yet — when one is wired up, fetch products from the API
// and populate this array (or replace the constant with a fetch + state).
const PRODUCTS: Product[] = []

// Featured products: top 4 best sellers
const FEATURED: Product[] = []

// AI recommendation groups — empty until a real personalization backend exists.
const AI_GROUP_PCODS: Product[] = []
const AI_GROUP_CYCLE: Product[] = []
const AI_GROUP_TRENDING: Product[] = []

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`

const discountPct = (p: Product) =>
  Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-muted text-muted-foreground/40'
          )}
        />
      ))}
    </div>
  )
}

function ProductImage({ product, className }: { product: Product; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center bg-gradient-to-br overflow-hidden',
        product.gradient,
        className
      )}
    >
      {/* Decorative blurred blobs */}
      <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-blush/40 blur-2xl" />
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-blush/40 blur-2xl" />
      <span className="relative text-5xl drop-shadow-lg select-none" role="img" aria-hidden="true">
        {product.emoji}
      </span>
    </div>
  )
}

function ProductCard({
  product,
  onAdd,
  inCart,
  layout = 'grid',
}: {
  product: Product
  onAdd: (p: Product) => void
  inCart: boolean
  layout?: 'grid' | 'wide'
}) {
  const [liked, setLiked] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card className="group relative h-full overflow-hidden border-border hover:shadow-xl hover:shadow-primary/10 transition-shadow duration-300 py-0 gap-0">
        {/* Image area */}
        <div className={cn('relative', layout === 'grid' ? 'aspect-square' : 'aspect-[4/3]')}>
          <ProductImage product={product} className="h-full w-full" />

          {/* Top-left badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
            {product.bestSeller && (
              <Badge className="bg-gold text-plum border-0 shadow-sm text-[10px] gap-1">
                <Award className="h-3 w-3" /> Best Seller
              </Badge>
            )}
            {product.aiRecommended && (
              <Badge className="bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white border-0 shadow-sm text-[10px] gap-1">
                <Sparkles className="h-3 w-3" /> AI Recommended
              </Badge>
            )}
          </div>

          {/* Discount badge */}
          <div className="absolute top-2 right-2">
            <Badge className="bg-rose-600 text-white border-0 shadow-sm text-[10px]">
              -{discountPct(product)}%
            </Badge>
          </div>

          {/* Heart / wishlist button */}
          <button
            onClick={() => setLiked((v) => !v)}
            aria-label="Toggle wishlist"
            className="absolute bottom-2 right-2 h-11 w-11 min-w-11 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
          >
            <Heart
              className={cn(
                'h-4 w-4 transition-colors',
                liked ? 'fill-rose-500 text-rose-500' : 'text-rose-400'
              )}
            />
          </button>

          {/* Category tag */}
          <div className="absolute bottom-2 left-2">
            <Badge
              variant="secondary"
              className="bg-card/90 backdrop-blur-sm text-[10px] border-0 text-primary dark:text-gold"
            >
              {product.categoryLabel}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-3 space-y-2 flex-1">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">
              {product.brand}
            </p>
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 mt-0.5">
              {product.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>

          <div className="flex items-center gap-1.5">
            <Stars rating={product.rating} />
            <span className="text-[11px] text-muted-foreground">
              {product.rating.toFixed(1)} ({product.reviews.toLocaleString('en-IN')})
            </span>
          </div>

          <div className="flex items-end gap-2 pt-0.5">
            <span className="text-lg font-bold text-amber-600 dark:text-gold">
              {formatINR(product.price)}
            </span>
            <span className="text-xs text-muted-foreground line-through">
              {formatINR(product.originalPrice)}
            </span>
          </div>
        </CardContent>

        <CardFooter className="p-3 pt-0">
          <Button
            onClick={() => onAdd(product)}
            className={cn(
              'w-full min-h-11 rounded-full text-xs font-semibold gap-1.5 transition-all',
              inCart
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'btn-plum'
            )}
          >
            {inCart ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Added to Cart
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

function FeaturedCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-w-[280px] sm:min-w-[340px] snap-center"
    >
      <Card className="overflow-hidden border-border shadow-xl shadow-primary/10 py-0 gap-0">
        <div className="relative h-44">
          <ProductImage product={product} className="h-full w-full" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Badge className="bg-gold text-plum border-0 shadow-sm gap-1">
              <Award className="h-3 w-3" /> Best Seller
            </Badge>
            <Badge className="bg-rose-600 text-white border-0 shadow-sm">
              -{discountPct(product)}% OFF
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">
              {product.brand}
            </p>
            <h3 className="font-bold text-base leading-tight mt-0.5">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Stars rating={product.rating} />
            <span className="text-xs text-muted-foreground">
              {product.rating.toFixed(1)} · {product.reviews.toLocaleString('en-IN')} reviews
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold text-amber-600 dark:text-gold">
                {formatINR(product.price)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                {formatINR(product.originalPrice)}
              </span>
            </div>
            <Button
              onClick={() => onAdd(product)}
              className="btn-plum rounded-full min-h-11 px-5 font-semibold gap-1.5"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function RecommendationRow({
  title,
  subtitle,
  icon: Icon,
  iconBg,
  products,
  onAdd,
  cartIds,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  iconBg: string
  products: Product[]
  onAdd: (p: Product) => void
  cartIds: Set<string>
}) {
  return (
    <Card className="overflow-hidden border-border py-0 gap-0">
      <CardHeader className="pb-3 pt-4 bg-blush/60 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-11 w-11 rounded-full bg-blush flex items-center justify-center text-primary shadow-sm',
              iconBg
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {title}
              <Badge className="chip-soft text-plum border-0 text-[10px] gap-1">
                <Sparkles className="h-3 w-3" /> AI
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={`${title}-${product.id}`}
              className="flex gap-3 p-2 rounded-xl border border-border hover:border-primary/30 transition-colors"
            >
              <ProductImage
                product={product}
                className="h-16 w-16 rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                    {product.brand}
                  </p>
                  <h4 className="text-xs font-semibold leading-tight line-clamp-1">
                    {product.name}
                  </h4>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Stars rating={product.rating} className="scale-90" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-600 dark:text-gold">
                    {formatINR(product.price)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAdd(product)}
                    className={cn(
                      'h-9 px-3 rounded-full text-[11px] gap-1',
                      cartIds.has(product.id)
                        ? 'border-teal-500 text-teal-600'
                        : 'border-primary/40 text-primary hover:bg-blush/60'
                    )}
                  >
                    {cartIds.has(product.id) ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {cartIds.has(product.id) ? 'Added' : 'Add'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MarketplaceModule() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [featuredIndex, setFeaturedIndex] = useState(0)

  // Cart helpers
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    toast.success(`${product.name} added to cart`, {
      description: formatINR(product.price),
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  const clearCart = () => {
    setCart([])
    toast.info('Cart cleared')
  }

  // Cart derived values
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49
  const total = subtotal + shipping
  const cartIds = useMemo(() => new Set(cart.map((i) => i.product.id)), [cart])

  // Filtered products by category + search
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return PRODUCTS.filter((p) => {
      const catMatch = activeCategory === 'all' || p.category === activeCategory
      const searchMatch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      return catMatch && searchMatch
    })
  }, [activeCategory, searchQuery])

  return (
    <div className="space-y-6">
      {/* ─── 1. HEADER ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-plum relative p-6 sm:p-8"
      >
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-plum-soft/50 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-plum-soft/50 blur-3xl" />
        <div className="absolute top-4 right-32 h-24 w-24 rounded-full bg-gold/20 blur-2xl" />
        <div aria-hidden="true" className="lotus-watermark absolute inset-0" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full chip-soft text-plum text-xs font-medium">
              <ShoppingBag className="h-3.5 w-3.5 text-gold" />
              Nuvia Marketplace
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="gold-shine">Wellness Market</span>
            </h1>
            <div aria-hidden="true">
              <span className="gold-divider text-[10px]"><span>✦</span></span>
            </div>
            <p className="text-white/90 text-sm sm:text-base">
              Curated products for your health journey
            </p>
          </div>

          {/* Search + Cart */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands..."
                className="pl-10 h-11 bg-card/95 text-foreground border-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-gold/60"
              />
            </div>
            <Button
              onClick={() => setCartOpen(true)}
              variant="ghost"
              className="relative h-11 w-11 min-w-11 rounded-full bg-gold-soft text-plum hover:bg-gold hover:text-plum shadow-lg shrink-0"
            >
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-gold text-plum text-[10px] font-bold flex items-center justify-center shadow-md border-2 border-gold-soft"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── 8. TRUST & INFO ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Truck, title: 'Free Shipping', sub: 'On orders above ₹499', color: 'text-rose-500' },
          { icon: RotateCcw, title: '7-Day Returns', sub: 'Hassle-free returns', color: 'text-pink-500' },
          { icon: ShieldCheck, title: 'Secure Payments', sub: '100% protected', color: 'text-fuchsia-500' },
          { icon: BadgePercent, title: 'Authentic Products', sub: 'Verified & tested', color: 'text-amber-500' },
        ].map((item) => (
          <Card key={item.title} className="py-0 gap-0">
            <CardContent className="flex items-center gap-3 p-3">
              <div className={cn('h-11 w-11 rounded-full bg-blush flex items-center justify-center shrink-0', item.color)}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">{item.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── 7. SPECIAL OFFERS BANNER ─────────────────────────────────────── */}
      {/* Removed: "Flash Sale Live!" banner with a fake countdown timer. The
          marketplace has no real products yet, so any sale / coupon expiry
          countdown would be misleading. Add this back when there is a real
          promotional calendar tied to live inventory. */}

      {/* ─── 3. FEATURED PRODUCTS (Hero Carousel) ─────────────────────────── */}
      {/* Removed: empty carousel of fake best-sellers. The marketplace has no
          real products yet, so a featured-products carousel would render
          nothing or rely on demo data. Restore when there are real featured
          products to showcase. */}

      {/* ─── 2. CATEGORY TABS ─────────────────────────────────────────────── */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-md border-y border-border">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 min-w-max pb-1">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 rounded-full text-sm font-medium border transition-all whitespace-nowrap min-h-11',
                    active
                      ? 'bg-primary text-primary-foreground border-transparent shadow-md shadow-primary/20'
                      : 'chip-soft text-muted-foreground hover:text-primary'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ─── 6. AI RECOMMENDATIONS ───────────────────────────────────────── */}
      {/* Removed: "AI-Powered Recommendations" rows that relied on fake
          per-persona product groups (and a fake "50,000+ Nuvia women"
          claim). Restore this section once there is a real personalization
          backend that returns recommended SKUs based on the user's profile. */}

      {/* ─── 4. PRODUCT GRID ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">
              {activeCategory === 'all'
                ? 'All Products'
                : CATEGORIES.find((c) => c.id === activeCategory)?.label}
            </h2>
            <Badge variant="secondary" className="chip-soft text-plum border-0">
              {filteredProducts.length} items
            </Badge>
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:bg-blush/60 min-h-11"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3.5 w-3.5" /> Clear search
            </Button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="border-dashed border-primary/30 py-16">
            <CardContent className="flex flex-col items-center justify-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-blush flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-base">Coming soon</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {searchQuery || activeCategory !== 'all'
                    ? `No products match your ${searchQuery ? 'search' : 'category'} yet. We're curating the best wellness products — check back soon.`
                    : "We're curating the best wellness products for you. The marketplace will open once our first collection is ready."}
                </p>
              </div>
              {(searchQuery || activeCategory !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-5 min-h-11 border-primary/40 text-primary hover:bg-blush/60"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveCategory('all')
                  }}
                >
                  Reset filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                  inCart={cartIds.has(product.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ─── Footer Promo ─────────────────────────────────────────────────── */}
      <Card className="card-plum border-0 py-0 gap-0">
        <CardContent className="relative p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <Gift className="h-8 w-8 shrink-0 text-gold" />
            <div>
              <p className="gold-shine font-serif text-lg font-bold">Become a Premium Member</p>
              <p className="text-sm text-white/90">Get 15% off all marketplace orders + free shipping</p>
            </div>
          </div>
          <Button variant="ghost" className="bg-gold-soft text-plum hover:bg-gold hover:text-plum rounded-full px-6 min-h-11 font-semibold gap-1.5 shrink-0">
            Upgrade Now <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* ─── 6. SHOPPING CART (Sheet) ─────────────────────────────────────── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col bg-card"
        >
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Your Cart
              {cartCount > 0 && (
                <Badge className="bg-primary text-primary-foreground border-0">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {cartCount === 0
                ? 'Your cart is currently empty'
                : 'Review your items and proceed to checkout'}
            </SheetDescription>
          </SheetHeader>

          {/* Body */}
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="h-20 w-20 rounded-full bg-blush flex items-center justify-center"
              >
                <ShoppingBag className="h-9 w-9 text-primary" />
              </motion.div>
              <div className="space-y-1">
                <p className="font-semibold">Your cart is empty</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Browse our wellness collection and find products curated for your journey.
                </p>
              </div>
              <Button
                onClick={() => setCartOpen(false)}
                className="btn-plum rounded-full px-6 min-h-11 font-semibold gap-1.5"
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> Continue Shopping
              </Button>
            </div>
          ) : (
            <>
              {/* Free shipping progress */}
              <div className="px-5 py-3 bg-blush/60 border-b border-border">
                {subtotal >= 499 ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    You&apos;ve unlocked <strong>FREE shipping!</strong>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-primary mb-1.5">
                      Add <strong>{formatINR(499 - subtotal)}</strong> more for FREE shipping
                    </p>
                    <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (subtotal / 499) * 100)}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Items list */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <motion.div
                        key={item.product.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex gap-3 p-2 rounded-xl border border-border bg-card/60"
                      >
                        <ProductImage
                          product={item.product}
                          className="h-16 w-16 rounded-lg shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold truncate">
                                {item.product.brand}
                              </p>
                              <h4 className="text-xs font-semibold leading-tight line-clamp-1">
                                {item.product.name}
                              </h4>
                            </div>
                            <Button
                              variant="ghost"
                              className="h-11 w-11 min-w-11 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            {/* Quantity stepper */}
                            <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                              <button
                                onClick={() => updateQty(item.product.id, -1)}
                                className="h-11 w-11 flex items-center justify-center hover:bg-blush/60 text-primary transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-8 text-center text-xs font-semibold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQty(item.product.id, 1)}
                                className="h-11 w-11 flex items-center justify-center hover:bg-blush/60 text-primary transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-bold text-amber-600 dark:text-gold">
                                {formatINR(item.product.price * item.quantity)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatINR(item.product.price)} each
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button
                    onClick={clearCart}
                    className="w-full text-xs text-muted-foreground hover:text-primary transition-colors py-2 min-h-11 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3 w-3" /> Clear cart
                  </button>
                </div>
              </ScrollArea>

              {/* Footer: totals + checkout */}
              <SheetFooter className="border-t border-border p-4 space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-medium text-foreground">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className="font-medium text-foreground">
                      {shipping === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">FREE</span>
                      ) : (
                        formatINR(shipping)
                      )}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-amber-600 dark:text-gold">
                      {formatINR(total)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right">
                    Inclusive of all taxes · Save {formatINR(
                      cart.reduce(
                        (sum, i) => sum + (i.product.originalPrice - i.product.price) * i.quantity,
                        0
                      )
                    )} on this order
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full btn-plum rounded-full px-6 min-h-11 font-semibold gap-1.5"
                    onClick={() => {
                      toast.success('Order placed successfully! 🎉', {
                        description: `${cartCount} items · ${formatINR(total)}`,
                      })
                      setCart([])
                      setCartOpen(false)
                    }}
                  >
                    <CreditCard className="h-4 w-4" /> Proceed to Checkout
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-full min-h-11 border-primary/40 text-primary hover:bg-blush/60 dark:hover:bg-primary/10"
                    onClick={() => setCartOpen(false)}
                  >
                    Continue Shopping
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
