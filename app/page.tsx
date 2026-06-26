'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { memo } from 'react'
import {
    Wine,
    Search,
    ShoppingCart,
    Trash2,
    CreditCard,
    Banknote,
    Split,
    CheckCircle2,
    Plus,
    Minus,
    History,
    LayoutDashboard,
    ShieldCheck,
    Users,
    X,
    Loader2,
    LogOut,
    Power,
    ArrowRight,
    BarChart3,
    Wallet,
    LayoutGrid,
    Zap,
    UserPlus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'
import Link from 'next/link'
import CashierSidebar from '@/components/CashierSidebar'
import CardReaderIndicator from '@/components/CardReaderIndicator'
import { ReceiptModal } from '@/components/ReceiptModal'

// --- Memoized Components for Performance ---

const ProductCard = memo(({ product, onAdd, isAlcohol, ageVerified, index }: {
    product: Product,
    onAdd: (p: Product) => void,
    isAlcohol?: boolean,
    ageVerified: boolean,
    index?: number
}) => {
    return (
        <div
            id={`product-${product.id}`}
            onClick={() => onAdd(product)}
            className="group bg-white rounded-2xl p-4 border border-purple-100 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer flex flex-col animate-entry"
            style={{ animationDelay: index ? `${index * 30}ms` : '0ms' }}
        >
            {/* Top: stock status + restricted */}
            <div className="flex items-center justify-between gap-2">
                <span className={cn(
                    "text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                    product.stock <= 0 ? "bg-red-50 text-red-600" :
                        product.stock <= product.lowStockThreshold ? "bg-amber-50 text-amber-600" :
                            "bg-purple-50 text-purple-600"
                )}>
                    {product.stock <= 0 ? 'Out of stock' : product.stock <= product.lowStockThreshold ? `Low (${product.stock})` : `${product.stock} in stock`}
                </span>
                {product.isAlcohol && (
                    <span className="text-[8px] font-bold bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                        Restricted
                    </span>
                )}
            </div>

            {/* Centered product icon */}
            <div className="flex items-center justify-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-primary/70">
                    <Wine size={26} />
                </div>
            </div>

            {/* Name + price/category */}
            <h3 className="font-bold text-black text-sm leading-tight tracking-tight line-clamp-1">{product.name || 'Unnamed Product'}</h3>
            <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-base font-black text-primary font-outfit tracking-tight">${parseFloat(product.price).toFixed(2)}</span>
                <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wide truncate">{product.category?.name || 'Unassigned'}</span>
            </div>
        </div>
    )
})

ProductCard.displayName = 'ProductCard'

interface Product {
    id: number
    name: string
    sku: string
    barcode?: string
    price: string
    stock: number
    lowStockThreshold: number
    category: { id: number; name: string }
    isAlcohol?: boolean
}

interface CartItem {
    productId: number
    product: Product
    quantity: number
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [cart, setCart] = useState<CartItem[]>([])
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 300)

        return () => clearTimeout(timer)
    }, [search])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash')
    const [ageVerified, setAgeVerified] = useState(false)
    const [showAgeModal, setShowAgeModal] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState('Everything')
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
    const [registerId, setRegisterId] = useState<number | null>(null)
    const [customers, setCustomers] = useState<{ id: number; name: string; phone: string; loyalty_points: number }[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string; phone: string; loyalty_points: number } | null>(null)
    const [pointsToRedeem, setPointsToRedeem] = useState(0)
    const [customerSearch, setCustomerSearch] = useState('')
    const [isAuthenticating, setIsAuthenticating] = useState(true)
    const [user, setUser] = useState<{ name: string; role: string } | null>(null)
    const [isOnline, setIsOnline] = useState(true)
    const [showZReportModal, setShowZReportModal] = useState(false)
    const [zReportData, setZReportData] = useState<any>(null)
    const [registerData, setRegisterData] = useState<any>(null)
    const [sessionData, setSessionData] = useState<any>(null)
    const [showHoldModal, setShowHoldModal] = useState(false)
    const [holdNotes, setHoldNotes] = useState('')
    const [heldBills, setHeldBills] = useState<any[]>([])
    const [showHeldBillsModal, setShowHeldBillsModal] = useState(false)
    const [cashReceived, setCashReceived] = useState<string>('')
    const [splitPayments, setSplitPayments] = useState<{ cash: number; card: number }>({ cash: 0, card: 0 })
    const [checkoutLoading, setCheckoutLoading] = useState(false)
    const [receiptData, setReceiptData] = useState<any>(null)
    const [showReceipt, setShowReceipt] = useState(false)
    const [mobileCartOpen, setMobileCartOpen] = useState(false)
    const [showOpenRegisterModal, setShowOpenRegisterModal] = useState(false)
    const [openingFloat, setOpeningFloat] = useState<string>('')
    const [isOpeningCashSet, setIsOpeningCashSet] = useState(false)
    const [bannerDismissed, setBannerDismissed] = useState(false)
    const [editingOpeningCash, setEditingOpeningCash] = useState(false)
    const [bannerCash, setBannerCash] = useState('')
    const [isCardReaderConnected, setIsCardReaderConnected] = useState(false)
    const [cardReaderStatus, setCardReaderStatus] = useState<'idle' | 'waiting' | 'processing' | 'success'>('idle')

    const router = useRouter()
    const apiUrl = API_URL
    const barcodeInputRef = useRef<HTMLInputElement>(null)
    const normalizedRole = user?.role?.toUpperCase()
    const historyHref = normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' ? '/admin/sales' : '/cashier/history'

    const openRegister = useCallback(async (overrideAmount?: number) => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        const amount = overrideAmount !== undefined ? overrideAmount : (parseFloat(openingFloat) || 0)

        // If register is already open but we need to set opening cash
        if (registerId) {
            await updateOpeningCash(amount)
            setShowOpenRegisterModal(false)
            return
        }

        try {
            const res = await fetch(`${apiUrl}/register/open`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ openingCash: amount }),
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setRegisterId(data.id)
                setRegisterData(data)
                setShowOpenRegisterModal(false)
                setIsOpeningCashSet(amount > 0)
                // The backend opens a session at the same time; seed it locally so the
                // first sale carries a session_id without needing a page reload.
                if (data.sessionId) {
                    setSessionData({ id: data.sessionId, register_id: data.id, opening_cash: amount > 0 ? amount : null })
                }
            } else {
                const data = await res.json()
                alert(data.error || 'Opening failed')
            }
        } catch (err) {
            console.error('Register open failed', err)
        }
    }, [apiUrl, openingFloat])

    const updateOpeningCash = useCallback(async (amount: number) => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/pos/session/opening-cash`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ opening_cash: amount }),
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setSessionData(data.session)
                setIsOpeningCashSet(true)
            } else {
                const data = await res.json()
                alert(data.error || 'Update failed')
            }
        } catch (err) {
            console.error('Update opening cash failed', err)
        }
    }, [apiUrl])

    const fetchCurrentSession = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/pos/session/current`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setSessionData(data)
                setIsOpeningCashSet(data.opening_cash !== null)
            }
        } catch (err) {
            console.error('Session fetch failed', err)
        }
    }, [apiUrl])

    const fetchCurrentRegister = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/register/current`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setRegisterId(data.id)
                setRegisterData(data)
                setShowOpenRegisterModal(false)

                // Also fetch session data
                await fetchCurrentSession()
            } else if (res.status === 404) {
                setShowOpenRegisterModal(true)
            }
        } catch (err) {
            console.error(`Register fetch failed`, err)
        }
    }, [apiUrl, fetchCurrentSession])

    // Change/correct the opening cash after it has already been set.
    // The backend adjusts current_cash by the delta and keeps the session in sync.
    const changeOpeningCash = useCallback(async (amount: number) => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return
        if (isNaN(amount) || amount < 0) {
            alert('Enter a valid opening cash amount')
            return
        }

        try {
            const res = await fetch(`${apiUrl}/register/update-opening-cash`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ openingCash: amount }),
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setSessionData((prev: any) => prev ? { ...prev, opening_cash: data.openingCash } : prev)
                setIsOpeningCashSet(true)
                setEditingOpeningCash(false)
                // Refresh register so the adjusted current_cash is reflected.
                fetchCurrentRegister()
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to update opening cash')
            }
        } catch (err) {
            console.error('Change opening cash failed', err)
            alert('Network error while updating opening cash')
        }
    }, [apiUrl, fetchCurrentRegister])

    const fetchCustomers = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const cachedCustomers = localStorage.getItem('cachedCustomers')
            const cacheTimestamp = localStorage.getItem('customersCacheTimestamp')
            const now = Date.now()
            const CACHE_TTL = 10 * 60 * 1000

            if (cachedCustomers && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_TTL) {
                const parsedCustomers = JSON.parse(cachedCustomers)
                setCustomers(Array.isArray(parsedCustomers) ? parsedCustomers : [])
            }

            const res = await fetch(`${apiUrl}/admin/customers`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setCustomers(Array.isArray(data.customers) ? data.customers : [])
                localStorage.setItem('cachedCustomers', JSON.stringify(data.customers))
                localStorage.setItem('customersCacheTimestamp', Date.now().toString())
            }
        } catch (err) {
            console.error(`Customers fetch failed`, err)

            const cachedCustomers = localStorage.getItem('cachedCustomers')
            if (cachedCustomers) {
                const parsedCustomers = JSON.parse(cachedCustomers)
                setCustomers(Array.isArray(parsedCustomers) ? parsedCustomers : [])
            }
        }
    }, [apiUrl])

    const fetchCategories = useCallback(async () => {
        if (!apiUrl) {
            console.error('POS: API URL not defined for categories')
            return
        }
        const token = localStorage.getItem('token')
        if (!token) {
            console.warn('POS: No token found, skipping category fetch')
            return
        }

        try {
            console.log('POS: Fetching categories...')
            const cachedCategories = localStorage.getItem('cachedCategories')
            const cacheTimestamp = localStorage.getItem('categoriesCacheTimestamp')
            const now = Date.now()
            const CACHE_TTL = 15 * 60 * 1000

            if (cachedCategories && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_TTL) {
                const parsedCategories = JSON.parse(cachedCategories)
                setCategories(Array.isArray(parsedCategories) ? parsedCategories : [])
                return
            }

            const res = await fetch(`${apiUrl}/categories`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setCategories(Array.isArray(data) ? data : [])
                localStorage.setItem('cachedCategories', JSON.stringify(data))
                localStorage.setItem('categoriesCacheTimestamp', now.toString())
            }
        } catch (err) {
            console.error(`Category fetch failed`, err)

            const cachedCategories = localStorage.getItem('cachedCategories')
            if (cachedCategories) {
                const parsedCategories = JSON.parse(cachedCategories)
                setCategories(Array.isArray(parsedCategories) ? parsedCategories : [])
            }
        }
    }, [apiUrl])

    const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')

    useEffect(() => {
        if (products.length > 0) {
            console.log(`POS: Products state updated with ${products.length} items`)
        }
    }, [products])

    useEffect(() => {
        const checkHealth = async () => {
            if (!apiUrl) return
            try {
                const res = await fetch(`${apiUrl}/health`, { cache: 'no-store' })
                setApiStatus(res.ok ? 'online' : 'offline')
                setIsOnline(res.ok)
            } catch (err) {
                setApiStatus('offline')
                setIsOnline(false)
            }
        }
        checkHealth()
        const interval = setInterval(checkHealth, 30000)
        return () => clearInterval(interval)
    }, [apiUrl])

    const [fetchProgress, setFetchProgress] = useState<string>('')

    // Latest search/category, read by fetchProducts so callers (retry buttons,
    // post-sale refresh) always refetch with the active filters.
    const searchRef = useRef('')
    const categoryIdRef = useRef<number | null>(null)

    // Server-side search: fetch only the matching page (max 200) instead of the
    // entire ~14k catalog. Keeps the POS terminal fast regardless of catalog size.
    const fetchProducts = useCallback(async () => {
        if (!apiUrl) return
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            setError(null)
            setLoading(true)

            const params = new URLSearchParams()
            const q = searchRef.current.trim()
            if (q) params.set('q', q)
            if (categoryIdRef.current != null) params.set('category_id', String(categoryIdRef.current))
            params.set('limit', '200')

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)

            const res = await fetch(`${apiUrl}/pos/products/search?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                cache: 'no-store',
                signal: controller.signal
            })
            clearTimeout(timeoutId)

            if (res.ok) {
                const data = await res.json()
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
                setProducts(list)
            } else {
                setError(`API Error ${res.status}`)
                setProducts([])
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return
            setError(err instanceof Error ? err.message : 'Network error')
        } finally {
            setLoading(false)
        }
    }, [apiUrl])

    // Drive product fetches from the debounced search + selected category.
    useEffect(() => {
        searchRef.current = debouncedSearch
        categoryIdRef.current = selectedCategory === 'Everything'
            ? null
            : (categories.find(c => c.name === selectedCategory)?.id ?? null)
        setVisibleCount(100)
        fetchProducts()
    }, [debouncedSearch, selectedCategory, categories, fetchProducts])

    const fetchZReport = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/register/z-report`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setZReportData(data)
                setShowZReportModal(true)
            }
        } catch (err) {
            console.error('Failed to fetch Z-report', err)
        }
    }, [apiUrl])

    const fetchHeldBills = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/pos/bills/hold`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                const data = await res.json()
                setHeldBills(data)
            }
        } catch (err) {
            console.error('Failed to fetch held bills', err)
        }
    }, [apiUrl])
    const handleHoldBill = async () => {
        if (cart.length === 0) return
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/pos/bills/hold`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: JSON.stringify(cart.map(i => ({ productId: i.productId, quantity: i.quantity, manual: i.product.sku === 'MANUAL' }))),
                    notes: holdNotes
                }),
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                setCart([])
                setHoldNotes('')
                setShowHoldModal(false)
                fetchHeldBills()
                alert('Bill held successfully')
            }
        } catch (err) {
            console.error('Hold bill failed', err)
        }
    }

    const handleAddManualItem = () => {
        const price = parseFloat(manualItem.price)
        if (!manualItem.name || isNaN(price)) return

        // Auto-detect alcohol for age verification
        const alcoholKeywords = ['wine', 'vodka', 'whiskey', 'rum', 'tequila', 'gin', 'beer', 'cider', 'spirit', 'liquor', 'alcohol', 'shot', 'cocktail']
        const isAlcoholic = alcoholKeywords.some(keyword =>
            manualItem.name.toLowerCase().includes(keyword) ||
            (manualItem.category && manualItem.category.toLowerCase().includes(keyword))
        )

        const product: Product = {
            id: Math.floor(Math.random() * -100000), // Negative ID for manual items
            name: manualItem.name,
            sku: 'MANUAL',
            price: price.toString(),
            stock: 999999,
            lowStockThreshold: 0,
            category: { id: 0, name: manualItem.category || 'General' },
            isAlcohol: isAlcoholic
        }

        setCart(prev => [...prev, { productId: product.id, product, quantity: 1 }])
        setManualItem({ name: '', price: '', category: 'General' })
        setShowManualModal(false)
    }

    const handleQuickAddProduct = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!apiUrl) return
        const token = localStorage.getItem('token')
        if (!token) return

        setIsSavingProduct(true)
        try {
            // Auto-detect alcohol for backend
            const alcoholKeywords = ['wine', 'vodka', 'whiskey', 'rum', 'tequila', 'gin', 'beer', 'cider', 'spirit', 'liquor', 'alcohol']
            const selectedCategoryName = categories.find(c => c.id.toString() === quickAddProduct.categoryId)?.name || ''
            const isAlcoholic = alcoholKeywords.some(keyword =>
                quickAddProduct.name.toLowerCase().includes(keyword) ||
                selectedCategoryName.toLowerCase().includes(keyword)
            )

            const res = await fetch(`${apiUrl}/admin/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...quickAddProduct,
                    price: parseFloat(quickAddProduct.price),
                    stock: parseInt(quickAddProduct.stock),
                    categoryId: quickAddProduct.categoryId || categories[0]?.id,
                    isAlcohol: isAlcoholic
                })
            })

            if (res.ok) {
                await fetchProducts(true)
                setShowQuickAddModal(false)
                setQuickAddProduct({ name: '', sku: '', price: '', stock: '100', categoryId: '' })
                alert('Product added to database!')
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to add product')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSavingProduct(false)
        }
    }
    const resumeHeldBill = (bill: any) => {
        try {
            const items = JSON.parse(bill.items)
            const newCart: CartItem[] = items.map((item: any) => {
                const product = products.find(p => p.id === item.productId)
                return {
                    productId: item.productId,
                    product: product || { id: item.productId, name: 'Unknown Product', price: '0', stock: 0, category: { id: 0, name: '' }, sku: '' },
                    quantity: item.quantity
                }
            })
            setCart(newCart)
            setShowHeldBillsModal(false)

            // Delete the held bill after resuming
            if (!apiUrl) throw new Error('API URL not defined')
            const token = localStorage.getItem('token')
            if (!token) return

            fetch(`${apiUrl}/pos/bills/hold/${bill.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            }).then(() => fetchHeldBills())

        } catch (err) {
            console.error('Resume bill failed', err)
        }
    }

    const handleCloseRegister = useCallback(async () => {
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const res = await fetch(`${apiUrl}/register/close`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })
            if (res.ok) {
                setShowZReportModal(false)
                setRegisterId(null)
                alert('Register closed successfully!')
                router.replace('/admin')
            }
        } catch (err) {
            console.error('Failed to close register', err)
        }
    }, [apiUrl, router])

    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + parseFloat(item.product.price) * item.quantity, 0)
    }, [cart])

    const tax = useMemo(() => subtotal * 0.0825, [subtotal])
    const loyaltyDiscount = useMemo(() => pointsToRedeem * 0.1, [pointsToRedeem])
    const total = useMemo(() => Math.max(0, (subtotal + tax) - loyaltyDiscount), [subtotal, tax, loyaltyDiscount])

    const handleCompleteOrder = useCallback(async () => {
        // Guard against double-submit (rapid clicks or Ctrl+Enter pressed twice).
        if (checkoutLoading) return

        if (!registerId) {
            setShowOpenRegisterModal(true)
            return
        }

        if (!isOpeningCashSet) {
            setShowOpenRegisterModal(true)
            return
        }

        // --- Age Verification Check ---
        const hasAlcohol = cart.some(item => item.product.isAlcohol)
        if (hasAlcohol && !ageVerified) {
            setShowAgeModal(true)
            return
        }

        if (paymentMethod === 'split') {
            const splitTotal = splitPayments.cash + splitPayments.card
            if (Math.abs(splitTotal - total) > 0.01) {
                alert(`Split total ($${splitTotal.toFixed(2)}) must match order total ($${total.toFixed(2)})`)
                return
            }
        }

        if (paymentMethod === 'cash') {
            const cash = parseFloat(cashReceived) || 0
            if (cash < total) {
                alert(`Cash received ($${cash.toFixed(2)}) is less than total ($${total.toFixed(2)})`)
                return
            }
        }

        if (paymentMethod === 'card' && isCardReaderConnected) {
            setCardReaderStatus('waiting')
            // Simulate waiting for hardware interaction
            await new Promise(resolve => setTimeout(resolve, 2000))
            setCardReaderStatus('processing')
            await new Promise(resolve => setTimeout(resolve, 1500))
            setCardReaderStatus('success')
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        setCheckoutLoading(true)
        if (!apiUrl) throw new Error('API URL not defined')
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            // First clear the cart to prevent double submission
            const currentCart = [...cart]

            const res = await fetch(`${apiUrl}/pos/sales`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionData?.id,
                    register_id: registerId,
                    subtotal,
                    tax,
                    total,
                    items: currentCart.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        price: i.product.price,
                        subtotal: parseFloat(i.product.price) * i.quantity
                    })),
                    paymentMethod,
                    age_verified: ageVerified ? 1 : 0,
                    customerId: selectedCustomer?.id,
                    loyalty: { redeem: pointsToRedeem },
                    payments: paymentMethod === 'split' ? [
                        { method: 'cash', amount: splitPayments.cash },
                        { method: 'card', amount: splitPayments.card }
                    ] : [
                        { method: paymentMethod, amount: total }
                    ]
                }),
                credentials: 'include',
                cache: 'no-store'
            })

            if (res.ok) {
                const text = await res.text()
                let data
                try {
                    data = JSON.parse(text)
                } catch (e) {
                    console.error('POS Checkout JSON Parse Error:', text)
                    throw new Error('Invalid server response')
                }

                // Build the customer bill BEFORE clearing the cart.
                const cashGiven = paymentMethod === 'cash' ? (parseFloat(cashReceived) || 0) : 0
                setReceiptData({
                    receiptNumber: data.receiptNumber,
                    createdAt: new Date().toISOString(),
                    items: currentCart.map(i => ({
                        name: i.product.name,
                        qty: i.quantity,
                        price: parseFloat(i.product.price),
                        lineTotal: parseFloat(i.product.price) * i.quantity,
                    })),
                    subtotal,
                    tax,
                    discount: loyaltyDiscount,
                    total,
                    paymentMethod,
                    cashReceived: cashGiven,
                    change: paymentMethod === 'cash' ? Math.max(0, cashGiven - total) : 0,
                    splitPayments: paymentMethod === 'split' ? { ...splitPayments } : null,
                    customer: selectedCustomer ? { name: selectedCustomer.name, phone: selectedCustomer.phone } : null,
                })
                setShowReceipt(true)

                // Clear UI state for the next sale.
                setMobileCartOpen(false)
                setCart([])
                setAgeVerified(false)
                setPointsToRedeem(0)
                setSelectedCustomer(null)
                setCustomerSearch('')
                setCashReceived('')
                setSplitPayments({ cash: 0, card: 0 })
                setCardReaderStatus('idle')
                fetchProducts()
                fetchCustomers()
                fetchCurrentRegister()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error || 'Failed to complete order'}`)
            }
        } catch (err) {
            console.error('Checkout failed', err)
            alert('Network error during checkout')
        } finally {
            setCheckoutLoading(false)
        }
    }, [apiUrl, registerId, cart, paymentMethod, ageVerified, selectedCustomer, pointsToRedeem, splitPayments, total, cashReceived, fetchProducts, fetchCustomers, fetchCurrentRegister, sessionData, subtotal, tax, checkoutLoading, loyaltyDiscount])

    useEffect(() => {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')
        if (!token) {
            router.replace('/admin/login')
        } else {
            setIsAuthenticating(false)
            if (userData) setUser(JSON.parse(userData))

            // Products are loaded by the search-driven effect. Fetch the rest in parallel.
            Promise.all([
                fetchCurrentRegister(),
                fetchCustomers(),
                fetchCategories(),
                fetchHeldBills()
            ]).catch(err => {
                console.error('Some data fetch failed:', err)
            })
        }
    }, [router, fetchCurrentRegister, fetchCustomers, fetchCategories, fetchHeldBills])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
                barcodeInputRef.current?.focus()
                e.preventDefault()
            }

            // If user starts typing and no input is focused, focus the barcode input
            if (
                /^[a-zA-Z0-9]$/.test(e.key) &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA'
            ) {
                barcodeInputRef.current?.focus()
            }

            // Global shortcut for checkout (e.g., F12 or Ctrl+Enter)
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && cart.length > 0 && !checkoutLoading) {
                handleCompleteOrder()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleCompleteOrder, cart.length, checkoutLoading])

    const addToCart = (product: Product) => {
        if (product.stock <= 0) return

        if (product.isAlcohol && !ageVerified) {
            setShowAgeModal(true)
            return
        }

        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id)
            if (existing) {
                if (existing.quantity >= product.stock) return prev
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }
            return [...prev, { productId: product.id, product, quantity: 1 }]
        })

        const element = document.getElementById(`product-${product.id}`)
        if (element) {
            element.classList.add('add-to-cart-animation')
            setTimeout(() => {
                element.classList.remove('add-to-cart-animation')
            }, 300)
        }
    }

    const [visibleCount, setVisibleCount] = useState(100)
    const [showManualModal, setShowManualModal] = useState(false)
    const [manualItem, setManualItem] = useState({ name: '', price: '', category: 'General' })
    const [isSavingProduct, setIsSavingProduct] = useState(false)
    const [showQuickAddModal, setShowQuickAddModal] = useState(false)
    const [quickAddProduct, setQuickAddProduct] = useState({ name: '', sku: '', price: '', stock: '100', categoryId: '' })

    // Filtering happens server-side (see fetchProducts); `products` is already
    // scoped to the active search + category.
    const filteredProducts = Array.isArray(products) ? products : []

    const displayedProducts = useMemo(() => {
        return filteredProducts.slice(0, visibleCount)
    }, [filteredProducts, visibleCount])

    const filteredCustomers = useMemo(() => {
        if (!customerSearch || selectedCustomer) return []
        const search = customerSearch.toLowerCase()
        return customers.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.phone.includes(search)
        ).slice(0, 5) // Only show top 5 for speed
    }, [customers, customerSearch, selectedCustomer])

    const [showCustomerModal, setShowCustomerModal] = useState(false)
    const [customerData, setCustomerData] = useState({ name: '', phone: '' })

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.replace('/admin/login')
    }

    useEffect(() => {
        if (paymentMethod === 'split' && total > 0) {
            // Only auto-split if not already set or if total changed significantly
            const currentTotal = splitPayments.cash + splitPayments.card
            if (Math.abs(currentTotal - total) > 0.01) {
                const half = total / 2
                setSplitPayments({ cash: half, card: half })
            }
        }
    }, [total, paymentMethod, splitPayments])

    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const query = search.trim()
            if (!query) return

            // Look for an exact SKU or Barcode match first
            const product = products.find(p =>
                p.sku.toLowerCase() === query.toLowerCase() ||
                p.barcode?.toLowerCase() === query.toLowerCase()
            )
            if (product) {
                addToCart(product)
                setSearch('')
                setDebouncedSearch('')
                return
            }

            // If no exact SKU match, and only one product is filtered, maybe add that?
            // But for hardware scanning, exact SKU match is safer.
            if (filteredProducts.length === 1) {
                addToCart(filteredProducts[0])
                setSearch('')
                setDebouncedSearch('')
            }
        }
    }

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${apiUrl}/admin/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(customerData)
            })
            if (res.ok) {
                setShowCustomerModal(false)
                setCustomerData({ name: '', phone: '' })
                fetchCustomers()
                alert('Customer added successfully!')
            }
        } catch (err) {
            console.error(err)
        }
    }

    if (isAuthenticating) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#09090B] gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-600">Securing Session...</p>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-white text-purple-900 overflow-hidden font-sans">
            <CashierSidebar />

            <main className="flex-1 flex flex-col bg-[#faf8fc] p-3 lg:p-6 overflow-hidden">
                <div className="flex flex-col gap-2.5 mb-3 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:mb-6">
                    <div className="flex flex-col shrink-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl lg:text-3xl font-black text-primary font-outfit tracking-tight uppercase leading-none">Spirited POS</h2>
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                isOnline ? "bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500"
                            )}></div>
                        </div>
                        <p className="text-purple-600 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                            {isOnline ? "Terminal Secured & Live" : "Offline Mode Active"}
                        </p>
                    </div>

                    {/* Controls: on mobile the action pills become one horizontally-scrollable strip and
                        the search drops to its own full-width row. On desktop (lg:contents) the wrapper
                        dissolves so buttons + search render exactly as the original single right-aligned row. */}
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 lg:flex-wrap lg:justify-end">
                        {/* On mobile each button collapses to a single distinct icon so all of them fit
                            on one row (no scroll). On desktop (lg:contents) the wrapper dissolves and the
                            full labeled pills render exactly as before. */}
                        <div className="flex items-center gap-1.5 lg:gap-2 lg:contents">
                            <button
                                onClick={() => setShowManualModal(true)}
                                title="Add manual item"
                                className="p-2.5 lg:px-4 lg:py-3 rounded-xl lg:rounded-2xl bg-white text-primary border border-purple-100 text-[10px] font-black uppercase tracking-widest hover:bg-purple-50 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                            >
                                <Plus size={18} className="lg:hidden" />
                                <Plus size={14} className="hidden lg:block" />
                                <span className="hidden lg:inline">Manual Item</span>
                            </button>
                            {(user?.role?.toUpperCase() === 'OWNER' || user?.role?.toUpperCase() === 'MANAGER') && (
                                <button
                                    onClick={() => setShowQuickAddModal(true)}
                                    title="Quick add product"
                                    className="p-2.5 lg:px-4 lg:py-3 rounded-xl lg:rounded-2xl bg-white text-primary border border-purple-100 text-[10px] font-black uppercase tracking-widest hover:bg-purple-50 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                                >
                                    <Zap size={18} className="lg:hidden" />
                                    <Plus size={14} className="hidden lg:block" />
                                    <span className="hidden lg:inline">Quick Add</span>
                                </button>
                            )}
                            <button
                                onClick={() => fetchProducts(true)}
                                className="p-2.5 lg:px-4 lg:py-3 rounded-xl lg:rounded-2xl bg-white border border-purple-100 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-purple-50 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                                title="Force sync data from server"
                            >
                                <Power size={18} className={cn("lg:hidden", loading && "animate-spin text-primary")} />
                                <Power size={16} className={cn("hidden lg:block", loading && "animate-spin text-primary")} />
                                <span className="hidden lg:inline">Sync ({products.length})</span>
                            </button>
                            <button
                                onClick={() => setShowHeldBillsModal(true)}
                                title="Resume held bills"
                                className="relative p-2.5 lg:px-4 lg:py-3 rounded-xl lg:rounded-2xl bg-white border border-purple-100 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-purple-50 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                            >
                                <History size={18} className="lg:hidden" />
                                <History size={16} className="hidden lg:block" />
                                <span className="hidden lg:inline">Resume ({heldBills.length})</span>
                                {heldBills.length > 0 && (
                                    <span className="lg:hidden absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                                        {heldBills.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setShowCustomerModal(true)}
                                title="Add customer"
                                className="p-2.5 lg:px-4 lg:py-3 rounded-xl lg:rounded-2xl bg-primary text-white border border-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shrink-0 whitespace-nowrap shadow-sm shadow-primary/20"
                            >
                                <UserPlus size={18} className="lg:hidden" />
                                <Plus size={16} className="hidden lg:block" />
                                <span className="hidden lg:inline">Add Customer</span>
                            </button>
                        </div>
                        <div className="relative group w-full lg:w-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search products (Ctrl+/)..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleBarcodeScan}
                                ref={barcodeInputRef}
                                className="bg-white border border-purple-100 rounded-2xl pl-12 pr-6 py-3 w-full lg:w-80 focus:ring-2 focus:ring-primary/10 focus:border-primary/20 outline-none transition-all text-sm font-semibold text-purple-900"
                                autoFocus
                            />
                        </div>
                    </div>
                </div>

                {/* Soft Prompt Banner for Opening Cash */}
                {/* Always show if not dismissed, to allow updates */}
                {
                    !bannerDismissed && (
                        <div className="mb-3 lg:mb-6 animate-in slide-in-from-top-4 duration-300">
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl lg:rounded-3xl p-3 lg:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
                                <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                                    <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                        <Banknote size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-primary uppercase tracking-wider">
                                            {isOpeningCashSet ? 'Opening Cash Set' : 'Opening Cash Not Set'}
                                        </p>
                                        <p className="text-[10px] text-purple-600 font-bold uppercase tracking-tight">
                                            {editingOpeningCash
                                                ? 'Editing — enter the corrected opening cash.'
                                                : isOpeningCashSet
                                                    ? `Confirmed for this shift${sessionData?.opening_cash != null ? ` ($${Number(sessionData.opening_cash).toFixed(2)})` : ''}.`
                                                    : 'Please enter the cash currently in the drawer for accurate reporting.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-xs">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bannerCash}
                                            onChange={(e) => setBannerCash(e.target.value)}
                                            disabled={isOpeningCashSet && !editingOpeningCash}
                                            placeholder={sessionData?.opening_cash || "0.00"}
                                            className={cn(
                                                "bg-white border border-primary/20 rounded-xl pl-8 pr-4 py-2 w-32 text-sm font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all",
                                                (isOpeningCashSet && !editingOpeningCash) && "opacity-50 cursor-not-allowed bg-purple-50"
                                            )}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Enter') return
                                                const val = parseFloat(bannerCash)
                                                if (isNaN(val)) return
                                                if (editingOpeningCash) changeOpeningCash(val)
                                                else if (!isOpeningCashSet) updateOpeningCash(val)
                                            }}
                                        />
                                    </div>
                                    {!isOpeningCashSet && (
                                        <button
                                            onClick={() => {
                                                const val = parseFloat(bannerCash)
                                                if (!isNaN(val)) updateOpeningCash(val)
                                            }}
                                            className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20"
                                        >
                                            Set Cash
                                        </button>
                                    )}
                                    {isOpeningCashSet && !editingOpeningCash && (
                                        <button
                                            onClick={() => {
                                                setBannerCash(sessionData?.opening_cash != null ? String(sessionData.opening_cash) : '')
                                                setEditingOpeningCash(true)
                                            }}
                                            className="bg-white border border-primary/30 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all"
                                        >
                                            Change
                                        </button>
                                    )}
                                    {editingOpeningCash && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const val = parseFloat(bannerCash)
                                                    if (!isNaN(val)) changeOpeningCash(val)
                                                }}
                                                className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20"
                                            >
                                                Update
                                            </button>
                                            <button
                                                onClick={() => { setEditingOpeningCash(false); setBannerCash('') }}
                                                className="bg-white border border-purple-200 text-purple-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-50 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setBannerDismissed(true)}
                                        className="p-2 text-purple-400 hover:text-purple-600 transition-colors relative z-50"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Category rail (vertical) + product grid */}
                <div className="flex-1 flex gap-2 lg:gap-5 overflow-hidden">

                {/* Category rail */}
                <div className="w-20 lg:w-28 shrink-0 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
                    {
                        ['Everything', ...categories.map(c => c.name)].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-2 rounded-2xl py-4 px-2 border transition-all text-center",
                                    selectedCategory === cat
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                        : "bg-white border-purple-100 text-black hover:bg-purple-50"
                                )}
                            >
                                <span className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                    selectedCategory === cat ? "bg-white/15 text-white" : "bg-purple-50 text-primary"
                                )}>
                                    {cat === 'Everything' ? <LayoutGrid size={18} /> : <Wine size={18} />}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-wider leading-tight line-clamp-2">{cat}</span>
                            </button>
                        ))
                    }
                </div>

                {/* Product Grid */}
                < div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-36 lg:pb-2" >
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-entry">
                            <X size={20} className="shrink-0" />
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest">Connection Error</p>
                                <p className="text-xs font-bold">{error}</p>
                            </div>
                            <button
                                onClick={() => fetchProducts(true)}
                                className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {
                        loading ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4" >
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className="h-48 rounded-3xl bg-purple-50/50 animate-pulse" />
                                ))
                                }
                            </div >
                        ) : (
                            <div className="space-y-8">
                                {displayedProducts.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                        {displayedProducts.map((p, index) => (
                                            <ProductCard
                                                key={p.id}
                                                product={p}
                                                onAdd={addToCart}
                                                ageVerified={ageVerified}
                                                index={index}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 bg-purple-50/30 rounded-[40px] border-2 border-dashed border-purple-100 animate-entry">
                                        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-purple-200 mb-6 shadow-xl shadow-purple-500/5">
                                            <Search size={40} />
                                        </div>
                                        <h3 className="text-xl font-black text-primary uppercase tracking-tight mb-2">No Products Found</h3>
                                        <div className="flex flex-col items-center gap-1 mb-4">
                                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                                Debug: {products.length} total, {filteredProducts.length} filtered
                                            </p>
                                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                                Category: {selectedCategory} | Search: &quot;{search}&quot;
                                            </p>
                                            <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                                                API: {apiUrl} | Status: {apiStatus}
                                            </p>
                                            {fetchProgress && (
                                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">
                                                    Progress: {fetchProgress}
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-sm text-purple-600 font-bold uppercase tracking-widest text-center max-w-xs px-6">
                                            {search ? `No results for "${search}"` : 'Your product catalog is currently empty or still loading.'}
                                        </p>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => fetchProducts(true)}
                                                className="mt-8 px-6 py-3 bg-white border border-purple-100 rounded-2xl text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:bg-purple-50 transition-all shadow-sm"
                                            >
                                                Try Refreshing Data
                                            </button>
                                            <button
                                                onClick={() => {
                                                    localStorage.clear();
                                                    window.location.reload();
                                                }}
                                                className="mt-8 px-6 py-3 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black text-red-600 uppercase tracking-[0.2em] hover:bg-red-100 transition-all shadow-sm"
                                            >
                                                Clear All Cache
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {filteredProducts.length > visibleCount && (
                                    <div className="flex justify-center py-8">
                                        <button
                                            onClick={() => setVisibleCount(prev => prev + 40)}
                                            className="px-8 py-4 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs flex items-center gap-3"
                                        >
                                            <Plus size={18} />
                                            Reveal {filteredProducts.length - visibleCount} More Products
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    }
                </div>
                </div>
            </main>

            {/* Right Checkout Cart */}
            <aside className={cn(
                "fixed inset-y-0 right-0 w-full max-w-md z-50 bg-white border-l border-purple-50 flex flex-col shadow-2xl transition-transform duration-300",
                "lg:static lg:translate-x-0 lg:w-[420px] lg:max-w-none lg:z-20",
                mobileCartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
            )}>
                <div className="px-5 pt-4 pb-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMobileCartOpen(false)}
                                className="lg:hidden w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-purple-600 hover:bg-purple-50"
                                title="Close cart"
                            >
                                <X size={20} />
                            </button>
                            <h2 className="text-lg font-bold font-outfit text-primary flex items-center gap-2 uppercase tracking-tight">
                                Checkout
                                <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-black">{cart.length}</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowHeldBillsModal(true)}
                                className="text-primary hover:text-primary transition-colors p-1.5 hover:bg-purple-50 rounded-lg flex items-center gap-1.5"
                                title="Held Bills"
                            >
                                <History size={18} />
                                <span className="text-[10px] font-black uppercase">Recall</span>
                            </button>
                            <button
                                onClick={() => setCart([])}
                                className="text-purple-600 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Customer Selection */}
                    <div className="space-y-2.5">
                        <div className="relative">
                            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50/50 border border-purple-100 rounded-2xl focus-within:border-primary/40 transition-all">
                                <Users size={16} className="text-purple-600" />
                                <input
                                    type="text"
                                    placeholder="Search Patron..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="bg-transparent border-none outline-none text-xs font-bold text-primary placeholder:text-purple-600 flex-1"
                                />
                                {selectedCustomer && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setSelectedCustomer(null)
                                            setPointsToRedeem(0)
                                        }} 
                                        className="text-red-400 hover:text-red-600 relative z-50"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {filteredCustomers.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-purple-100 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {filteredCustomers.map(cust => (
                                        <button
                                            key={cust.id}
                                            onClick={() => {
                                                setSelectedCustomer(cust)
                                                setCustomerSearch(cust.name)
                                                setPointsToRedeem(0)
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-purple-50 last:border-0"
                                        >
                                            <p className="text-xs font-black text-primary uppercase">{cust.name}</p>
                                            <p className="text-[9px] text-purple-600 font-bold uppercase tracking-widest">{cust.phone}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedCustomer && (
                            <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-3 animate-entry shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-purple-600" />
                                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                            Loyalty: {selectedCustomer.loyalty_points} Points
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-primary bg-white px-2 py-0.5 rounded-lg border border-purple-100 shadow-sm">
                                        Value: ${(selectedCustomer.loyalty_points * 0.1).toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1 max-w-[120px]">
                                        <input
                                            type="number"
                                            placeholder="Redeem"
                                            value={pointsToRedeem || ''}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0
                                                setPointsToRedeem(Math.min(val, selectedCustomer.loyalty_points))
                                            }}
                                            className="bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs font-bold text-primary w-full outline-none focus:ring-2 focus:ring-primary/10 transition-all pr-8"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-purple-400">PTS</div>
                                    </div>
                                    <button
                                        onClick={() => setPointsToRedeem(selectedCustomer.loyalty_points)}
                                        className="px-3 py-2 rounded-xl bg-primary/5 text-[9px] font-black text-primary uppercase hover:bg-primary/10 transition-colors"
                                    >
                                        Max Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-5 pb-3 space-y-2.5">
                    {/* Compact segmented payment selector */}
                    <div className="grid grid-cols-3 gap-1.5 bg-purple-50/50 border border-purple-100 rounded-xl p-1">
                        {(['cash', 'card', 'split'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => {
                                    setPaymentMethod(m)
                                    if (m === 'cash') setCashReceived(total.toFixed(2))
                                    if (m === 'split') {
                                        const half = total / 2
                                        setSplitPayments({ cash: half, card: half })
                                    }
                                }}
                                className={cn(
                                    "py-2 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all flex items-center justify-center gap-1",
                                    paymentMethod === m
                                        ? "bg-primary text-white shadow-sm shadow-primary/20"
                                        : "text-purple-600 hover:bg-white"
                                )}
                            >
                                {m === 'cash' ? <Banknote size={12} /> :
                                    m === 'card' ? <CreditCard size={12} /> :
                                        <Split size={12} />}
                                <span className="truncate">{m}</span>
                            </button>
                        ))}
                    </div>

                    {/* Card reader status — only relevant when paying by card or split */}
                    {(paymentMethod === 'card' || paymentMethod === 'split') && (
                        <CardReaderIndicator onConnectionChange={setIsCardReaderConnected} />
                    )}

                    {paymentMethod === 'cash' && (
                        <div className="bg-green-50 border border-green-100 rounded-2xl p-2.5 space-y-2 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="text-[8px] font-black text-green-700 uppercase tracking-widest shrink-0">Recv $</span>
                                    <input
                                        type="number"
                                        value={cashReceived}
                                        onChange={(e) => setCashReceived(e.target.value)}
                                        className="bg-transparent border-none outline-none text-lg font-black text-green-700 w-full min-w-0"
                                        autoFocus
                                    />
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[8px] font-black text-green-700 uppercase tracking-widest">Change </span>
                                    <span className="text-lg font-black text-green-700">
                                        ${Math.max(0, (parseFloat(cashReceived) || 0) - total).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                                {[10, 20, 50, 100].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setCashReceived(((parseFloat(cashReceived) || 0) + amt).toString())}
                                        className="py-1 rounded-lg bg-white border border-green-200 text-[9px] font-black text-green-700 uppercase hover:bg-green-100 transition-colors"
                                    >
                                        +${amt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'split' && (
                        <div className="bg-purple-50 border border-primary/20 rounded-2xl p-3 space-y-2.5 shadow-sm">
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-black text-black font-outfit tracking-tight">Total: ${total.toFixed(2)}</p>
                                <div className={cn(
                                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                    Math.abs(splitPayments.cash + splitPayments.card - total) < 0.01
                                        ? "bg-green-100 text-green-700"
                                        : "bg-amber-100 text-amber-700"
                                )}>
                                    {Math.abs(splitPayments.cash + splitPayments.card - total) < 0.01
                                        ? <><CheckCircle2 size={11} /> Balanced</>
                                        : <><Loader2 size={11} className="animate-spin" /> Unbalanced</>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2.5 rounded-xl border border-purple-100 focus-within:border-primary transition-all">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Banknote size={11} className="text-primary" />
                                        <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Cash Part</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-bold text-primary">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={splitPayments.cash || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                const validCash = Math.max(0, Math.min(total, val))
                                                setSplitPayments({
                                                    cash: validCash,
                                                    card: Math.max(0, total - validCash)
                                                })
                                            }}
                                            onBlur={() => {
                                                setSplitPayments(prev => ({
                                                    ...prev,
                                                    cash: Math.round(prev.cash * 100) / 100,
                                                    card: Math.round(prev.card * 100) / 100
                                                }))
                                            }}
                                            className="bg-transparent border-none outline-none text-base font-black text-primary w-full p-0"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-2.5 rounded-xl border border-purple-100 focus-within:border-primary transition-all">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <CreditCard size={11} className="text-primary" />
                                        <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Card Part</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-bold text-primary">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={splitPayments.card || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                const validCard = Math.max(0, Math.min(total, val))
                                                setSplitPayments({
                                                    cash: Math.max(0, total - validCard),
                                                    card: validCard
                                                })
                                            }}
                                            onBlur={() => {
                                                setSplitPayments(prev => ({
                                                    ...prev,
                                                    cash: Math.round(prev.cash * 100) / 100,
                                                    card: Math.round(prev.card * 100) / 100
                                                }))
                                            }}
                                            className="bg-transparent border-none outline-none text-base font-black text-primary w-full p-0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-5 pb-1.5 pt-1">
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em]">Bill Items</span>
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em]">{cart.length} item{cart.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-5 custom-scrollbar space-y-1.5 pb-3 border-t border-purple-50 pt-2">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 py-12 text-purple-600">
                            <ShoppingCart size={52} strokeWidth={1} className="mb-3" />
                            <p className="font-black uppercase tracking-[0.4em] text-[10px] text-purple-600">Empty Cart</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.productId} className="flex items-center gap-2.5 group bg-purple-50/20 hover:bg-purple-50/50 rounded-xl p-2 border border-transparent hover:border-purple-100 transition-colors">
                                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-primary shrink-0 border border-purple-100">
                                    <Wine size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-black truncate uppercase tracking-tight leading-tight">{item.product.name}</h4>
                                    <p className="text-[9px] text-purple-500 font-bold tracking-wide uppercase">${item.product.price} / unit</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => {
                                            if (item.quantity > 1) {
                                                setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity - 1 } : i))
                                            } else {
                                                setCart(prev => prev.filter(i => i.productId !== item.productId))
                                            }
                                        }}
                                        className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-purple-600 hover:text-primary transition-colors border border-purple-100"
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <span className="font-black text-xs w-4 text-center text-primary">{item.quantity}</span>
                                    <button
                                        onClick={() => {
                                            if (item.quantity < item.product.stock) {
                                                setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))
                                            }
                                        }}
                                        className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-purple-600 hover:text-primary transition-colors border border-purple-100"
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                                <div className="text-right shrink-0 w-16">
                                    <p className="text-xs font-black text-black font-outfit">${(parseFloat(item.product.price) * item.quantity).toFixed(2)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="px-5 py-3 bg-white border-t border-purple-100 space-y-3 shadow-[0_-8px_24px_-12px_rgba(126,34,206,0.12)]">
                    <div className="bg-purple-50/50 rounded-2xl p-3 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-purple-500">Subtotal</span>
                            <span className="text-black">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-purple-500">VAT / Tax (8.25%)</span>
                            <span className="text-black">${tax.toFixed(2)}</span>
                        </div>
                        {loyaltyDiscount > 0 && (
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-green-600">
                                <span>Loyalty Applied</span>
                                <span>-${loyaltyDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center font-outfit uppercase border-t border-purple-100 mt-0.5 pt-2">
                            <span className="text-sm font-black text-black">Grand Total</span>
                            <span className="text-xl font-black text-primary tracking-tight">${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex gap-2.5">
                        <button
                            onClick={() => setShowHoldModal(true)}
                            className="flex-1 py-3.5 rounded-2xl bg-white border border-purple-100 text-primary font-bold hover:bg-purple-50 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                        >
                            <History size={14} />
                            Hold Bill
                        </button>
                        <button
                            onClick={handleCompleteOrder}
                            disabled={checkoutLoading || cart.length === 0 || (paymentMethod === 'card' && isCardReaderConnected && cardReaderStatus !== 'idle')}
                            className="flex-[2] py-3.5 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {checkoutLoading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : cardReaderStatus === 'waiting' ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : cardReaderStatus === 'processing' ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <CheckCircle2 size={18} />
                            )}
                            {checkoutLoading
                                ? 'Processing...'
                                : cardReaderStatus === 'waiting'
                                    ? 'Insert/Tap Card'
                                    : cardReaderStatus === 'processing'
                                        ? 'Authorizing'
                                        : cardReaderStatus === 'success'
                                            ? 'Approved!'
                                            : 'Complete Payment'}
                        </button>
                    </div>
                </div>
            </aside >

            {/* Mobile: floating cart bar (opens the drawer) + backdrop. Hidden on desktop. */}
            {!mobileCartOpen && cart.length > 0 && (
                <button
                    onClick={() => setMobileCartOpen(true)}
                    className="lg:hidden fixed bottom-[72px] inset-x-3 z-30 bg-primary text-white rounded-2xl shadow-xl shadow-primary/30 px-5 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
                >
                    <span className="flex items-center gap-2 font-black uppercase tracking-widest text-xs">
                        <ShoppingCart size={18} /> View Cart · {cart.length}
                    </span>
                    <span className="font-black font-outfit text-base">${total.toFixed(2)}</span>
                </button>
            )}
            {mobileCartOpen && (
                <div className="lg:hidden fixed inset-0 z-[45] bg-black/30 backdrop-blur-sm" onClick={() => setMobileCartOpen(false)} />
            )}

            {/* Customer bill / receipt after payment */}
            {showReceipt && <ReceiptModal data={receiptData} onClose={() => setShowReceipt(false)} />}

            {/* Age Verification Overlay */}
            {
                showAgeModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-primary/20">
                        <div className="glass-card rounded-[40px] p-10 w-full max-w-lg text-center relative overflow-hidden border-primary/20 bg-white shadow-2xl">
                            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                            <div className="w-20 h-20 bg-primary/5 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <ShieldCheck size={40} />
                            </div>
                            <h2 className="text-3xl font-black text-primary mb-2 font-outfit tracking-tight uppercase">Legal Gatekeeper</h2>
                            <p className="text-purple-700 mb-8 italic text-sm">Age verification required for restricted alcoholic products.</p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowAgeModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Deny Entry
                                </button>
                                <button
                                    onClick={() => { setAgeVerified(true); setShowAgeModal(false); }}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Verified (21+)
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Hold Bill Modal */}
            {
                showHoldModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                        <div className="glass-card rounded-3xl lg:rounded-[40px] p-6 lg:p-10 w-full max-w-md relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                            <h3 className="text-2xl font-black text-dark mb-2 font-outfit tracking-tight uppercase">Hold Manifest</h3>
                            <p className="text-purple-700 mb-8 italic text-sm">Temporarily stash this order for later retrieval.</p>
                            <textarea
                                value={holdNotes}
                                onChange={(e) => setHoldNotes(e.target.value)}
                                placeholder="Add reference notes (e.g., Table 4, John D.)..."
                                className="bg-purple-50/50 border border-purple-100 rounded-3xl p-4 w-full font-semibold min-h-[120px] mb-8 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                            />
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowHoldModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleHoldBill}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                >
                                    <History size={16} />
                                    Stash Bill
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Held Bills Modal */}
            {
                showHeldBillsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                        <div className="glass-card rounded-3xl lg:rounded-[40px] p-6 lg:p-10 w-full max-w-2xl relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-amber-500/5 rounded-full blur-[80px]" />
                            <h3 className="text-xl lg:text-2xl font-black text-dark mb-2 font-outfit tracking-tight uppercase">Held Manifests</h3>
                            <p className="text-purple-700 mb-6 lg:mb-8 italic text-sm">Review and resume currently staged orders.</p>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 lg:pr-2 custom-scrollbar">
                                {heldBills.length === 0 ? (
                                    <p className="text-center py-20 text-[10px] font-black uppercase text-purple-400 tracking-widest italic">No manifests staged</p>
                                ) : (
                                    heldBills.map((bill) => (
                                        <div key={bill.id} className="p-4 lg:p-6 rounded-2xl lg:rounded-[32px] bg-purple-50/30 border border-purple-100 flex items-center justify-between gap-3 group hover:border-primary/20 transition-all">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest shrink-0">ID #{bill.id}</span>
                                                    <span className="w-1 h-1 rounded-full bg-purple-300 shrink-0" />
                                                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest truncate">{new Date(bill.created_at).toLocaleTimeString()}</span>
                                                </div>
                                                <p className="text-sm font-black text-purple-900 uppercase truncate">{bill.notes || 'Unnamed Stash'}</p>
                                            </div>
                                            <button
                                                onClick={() => resumeHeldBill(bill)}
                                                className="px-4 lg:px-6 py-3 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 hover:scale-105 active:scale-95 transition-all whitespace-nowrap shrink-0"
                                            >
                                                Resume<span className="hidden lg:inline"> Manifest</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex gap-4 pt-6 lg:pt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowHeldBillsModal(false)}
                                    className="w-full py-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Close Ledger
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Customer Modal */}
            {
                showCustomerModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                        <div className="glass-card rounded-3xl lg:rounded-[40px] p-6 lg:p-10 w-full max-w-md relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                            <h3 className="text-2xl font-black text-dark mb-2 font-outfit tracking-tight uppercase">New Patron</h3>
                            <p className="text-purple-700 mb-8 italic text-sm">Register a new customer for loyalty tracking.</p>

                            <form onSubmit={handleAddCustomer} className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={customerData.name}
                                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                                        placeholder="e.g. John Doe"
                                        className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={customerData.phone}
                                        onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                                        placeholder="e.g. +1 234 567 890"
                                        className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                        required
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerModal(false)}
                                        className="flex-1 py-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                    >
                                        Register
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Z-Report Modal */}
            {
                showZReportModal && zReportData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                        <div className="glass-card rounded-[40px] p-10 w-full max-w-lg relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-amber-500/5 rounded-full blur-[80px]" />

                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-black text-dark font-outfit tracking-tight uppercase">Z-Report Summary</h3>
                                    <p className="text-purple-700 italic text-[10px] uppercase tracking-widest font-bold">Session ID: #{zReportData.register.id} • Started: {new Date(zReportData.register.openedAt).toLocaleString()}</p>
                                </div>
                                <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                                    <History size={24} />
                                </div>
                            </div>

                            <div className="space-y-6 relative z-10">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-3xl bg-purple-50/50 border border-purple-100">
                                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Total Sales</p>
                                        <p className="text-2xl font-black text-primary font-outfit">${zReportData.sales.total.toFixed(2)}</p>
                                        <p className="text-[10px] font-bold text-purple-400 uppercase">{zReportData.sales.count} Transactions</p>
                                    </div>
                                    <div className="p-4 rounded-3xl bg-green-50/50 border border-green-100">
                                        <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Cash in Drawer</p>
                                        <p className="text-2xl font-black text-green-700 font-outfit">${zReportData.register.currentCash.toFixed(2)}</p>
                                        <p className="text-[10px] font-bold text-green-400 uppercase">Incl. ${zReportData.register.openingCash.toFixed(2)} Opening</p>
                                    </div>
                                </div>

                                {/* Payment Methods */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest ml-1">Payment Breakdown</h4>
                                    <div className="space-y-2">
                                        {zReportData.payments.map((p: any) => (
                                            <div key={p.method} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-purple-50 shadow-sm">
                                                <span className="text-xs font-black text-purple-700 uppercase">{p.method}</span>
                                                <span className="text-xs font-black text-primary font-outfit">${parseFloat(p.total).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {zReportData.payments.length === 0 && (
                                            <p className="text-center py-4 text-[10px] font-bold text-purple-400 uppercase italic">No payments recorded</p>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Stats */}
                                <div className="flex items-center justify-between px-2 text-[10px] font-black text-purple-400 uppercase tracking-widest">
                                    <span>Items Sold: {zReportData.totalItems}</span>
                                    <span>Tax Collected: ${zReportData.sales.tax.toFixed(2)}</span>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-purple-50">
                                    <button
                                        type="button"
                                        onClick={() => setShowZReportModal(false)}
                                        className="flex-1 py-4 rounded-2xl bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleCloseRegister}
                                        className="flex-2 px-8 py-4 rounded-2xl bg-amber-500 text-white font-black shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                    >
                                        Confirm & Close Session
                                        <Power size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Manual Item Modal */}
            {
                showManualModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                        <div className="glass-card rounded-3xl lg:rounded-[40px] p-6 lg:p-10 w-full max-w-md relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                            <h3 className="text-2xl font-black text-dark mb-2 font-outfit tracking-tight uppercase">Manual Operation</h3>
                            <p className="text-purple-700 mb-8 italic text-sm">Sell an ad-hoc item not found in the manifest.</p>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Item Description</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Miscellaneous Gift"
                                        value={manualItem.name}
                                        onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                                        className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Price ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={manualItem.price}
                                        onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                                        className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-8">
                                <button
                                    onClick={() => setShowManualModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddManualItem}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Quick Add Product Modal */}
            {
                showQuickAddModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
                        <div className="glass-card rounded-3xl lg:rounded-[40px] p-6 lg:p-10 w-full max-w-md relative overflow-hidden border-purple-100 bg-white shadow-2xl">
                            <h3 className="text-2xl font-black text-dark mb-2 font-outfit tracking-tight uppercase">Registry Entry</h3>
                            <p className="text-purple-700 mb-8 italic text-sm">Add a permanent product to the system catalog.</p>

                            <form onSubmit={handleQuickAddProduct} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Product Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={quickAddProduct.name}
                                        onChange={(e) => setQuickAddProduct({ ...quickAddProduct, name: e.target.value })}
                                        className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">SKU / Code</label>
                                        <input
                                            type="text"
                                            required
                                            value={quickAddProduct.sku}
                                            onChange={(e) => setQuickAddProduct({ ...quickAddProduct, sku: e.target.value })}
                                            className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Price ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={quickAddProduct.price}
                                            onChange={(e) => setQuickAddProduct({ ...quickAddProduct, price: e.target.value })}
                                            className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest ml-1">Category</label>
                                    <select
                                        value={quickAddProduct.categoryId}
                                        onChange={(e) => setQuickAddProduct({ ...quickAddProduct, categoryId: e.target.value })}
                                        className="bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-3 w-full font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex gap-4 pt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickAddModal(false)}
                                        className="flex-1 py-4 rounded-2xl bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 transition-colors uppercase tracking-widest text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingProduct}
                                        className="flex-1 py-4 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                    >
                                        {isSavingProduct ? <Loader2 className="animate-spin" size={16} /> : 'Save Product'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Open Register Modal */}
            {
                showOpenRegisterModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
                        <div className="glass-card rounded-3xl lg:rounded-[40px] p-6 lg:p-10 w-full max-w-md relative overflow-hidden border-white/20 bg-white shadow-2xl animate-entry">
                            <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />

                            <div className="relative z-10 text-center space-y-6">
                                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary group">
                                    <Power size={40} className="group-hover:rotate-12 transition-transform" />
                                </div>

                                <div>
                                    <h3 className="text-3xl font-black text-dark font-outfit uppercase tracking-tight">
                                        {registerId ? 'Set Opening Cash' : 'Open Register'}
                                    </h3>
                                    <p className="text-purple-600 text-[10px] font-black uppercase tracking-[0.2em] mt-2">
                                        {registerId ? 'Provide a balance to start selling' : 'Initialize your shift float'}
                                    </p>
                                </div>

                                <div className="space-y-2 text-left">
                                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest ml-1">Opening Cash ($) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={openingFloat}
                                        onChange={(e) => setOpeningFloat(e.target.value)}
                                        className="bg-purple-50/50 border-2 border-primary/20 rounded-3xl px-8 py-5 w-full font-black text-3xl text-center text-primary outline-none focus:border-primary transition-all font-outfit"
                                        placeholder="0.00"
                                        autoFocus
                                        required
                                    />
                                    <p className="text-[9px] text-purple-400 font-bold uppercase text-center mt-2 tracking-widest">Initial drawer balance required</p>
                                </div>

                                <div className="pt-4 space-y-3">
                                    <button
                                        onClick={() => openRegister()}
                                        disabled={openingFloat === '' || parseFloat(openingFloat) < 0}
                                        className="w-full py-5 rounded-[24px] bg-primary text-white font-black shadow-xl shadow-primary/40 hover:bg-opacity-90 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        {registerId ? 'Set Balance & Continue' : 'Initialize Terminal'}
                                        <ArrowRight size={18} />
                                    </button>
                                    {!registerId && (
                                        <button
                                            onClick={() => openRegister(0)}
                                            className="w-full py-4 rounded-[24px] bg-purple-50 text-purple-600 font-black hover:bg-purple-100 transition-all uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3"
                                        >
                                            Skip & Start Selling
                                        </button>
                                    )}
                                    {registerId && (
                                        <button
                                            onClick={() => setShowOpenRegisterModal(false)}
                                            className="w-full py-4 rounded-[24px] bg-purple-50 text-purple-600 font-black hover:bg-purple-100 transition-all uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleLogout()}
                                        className="w-full py-2 text-red-400 font-black uppercase text-[9px] tracking-[0.3em] hover:text-red-600 transition-colors"
                                    >
                                        Cancel & Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    )
}
