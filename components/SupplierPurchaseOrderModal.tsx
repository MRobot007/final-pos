'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Mail, AlertTriangle, Loader2, Search, Send, Trash2, PackageSearch, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'

const SHOP_NAME = 'Spirited Wines'

interface Supplier {
    id: number
    name: string
    email?: string | null
}

interface OrderProduct {
    id: number
    name: string
    sku?: string
    stock: number
    minStock: number
    isLowStock: boolean
    lastQty?: number
}

interface SelectedItem extends OrderProduct {
    qty: string
}

interface Props {
    supplier: Supplier
    onClose: () => void
}

// Suggested reorder quantity for a low-stock product: enough to clear the minimum again.
function suggestedQty(p: OrderProduct): number {
    return Math.max(p.minStock * 2 - p.stock, p.minStock, 1)
}

// Normalises a row from either the supplier-products endpoint or the products list.
function mapRow(p: any): OrderProduct {
    const minStock = p.minStock ?? p.lowStockThreshold ?? 10
    return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: Number(p.stock ?? 0),
        minStock: Number(minStock),
        isLowStock: p.isLowStock !== undefined ? !!p.isLowStock : Number(p.stock ?? 0) <= Number(minStock),
        lastQty: p.lastQty !== undefined ? Number(p.lastQty) : undefined,
    }
}

function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export function SupplierPurchaseOrderModal({ supplier, onClose }: Props) {
    const [baseProducts, setBaseProducts] = useState<OrderProduct[]>([])
    const [baseMode, setBaseMode] = useState<'supplier' | 'lowstock' | 'empty'>('supplier')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [search, setSearch] = useState('')
    const [searchResults, setSearchResults] = useState<OrderProduct[]>([])
    const [searching, setSearching] = useState(false)

    // The order being built — survives switching between browse/search views.
    const [selected, setSelected] = useState<Record<number, SelectedItem>>({})

    // Products ordered from this supplier last time (for quick re-ordering).
    const [lastOrder, setLastOrder] = useState<OrderProduct[]>([])

    // --- Load the default list: the supplier's products, falling back to all low-stock. ---
    useEffect(() => {
        const controller = new AbortController()
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await fetch(`${API_URL}/admin/suppliers/${supplier.id}/products`, {
                    headers: authHeaders(), credentials: 'include', cache: 'no-store', signal: controller.signal,
                })
                if (!res.ok) throw new Error(`Failed to load products (${res.status})`)
                const data = await res.json()
                let list: OrderProduct[] = Array.isArray(data) ? data.map(mapRow) : []

                if (list.length > 0) {
                    setBaseMode('supplier')
                    setBaseProducts(list)
                    // Pre-select the supplier's low-stock items with a suggested qty (fast reorder).
                    setSelected(prev => {
                        const next = { ...prev }
                        for (const p of list) {
                            if (p.isLowStock && !next[p.id]) next[p.id] = { ...p, qty: String(suggestedQty(p)) }
                        }
                        return next
                    })
                } else {
                    // No products linked to this supplier yet → show all low-stock items so the
                    // user can still order. Reuses the existing low-stock feature.
                    const r2 = await fetch(`${API_URL}/admin/products?low_stock=1&limit=100`, {
                        headers: authHeaders(), credentials: 'include', cache: 'no-store', signal: controller.signal,
                    })
                    const d2 = await r2.json()
                    list = Array.isArray(d2?.data) ? d2.data.map(mapRow) : []
                    setBaseMode(list.length > 0 ? 'lowstock' : 'empty')
                    setBaseProducts(list)
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return
                setError(err instanceof Error ? err.message : 'Failed to load products')
            } finally {
                setLoading(false)
            }
        }
        load()
        return () => controller.abort()
    }, [supplier.id])

    // --- Load what was ordered from this supplier last time. ---
    useEffect(() => {
        const controller = new AbortController()
        fetch(`${API_URL}/admin/suppliers/${supplier.id}/last-order`, {
            headers: authHeaders(), credentials: 'include', cache: 'no-store', signal: controller.signal,
        })
            .then(r => (r.ok ? r.json() : []))
            .then(d => setLastOrder(Array.isArray(d) ? d.map(mapRow) : []))
            .catch(() => { /* non-fatal */ })
        return () => controller.abort()
    }, [supplier.id])

    // --- Search across ALL products (debounced). ---
    useEffect(() => {
        const q = search.trim()
        if (!q) { setSearchResults([]); setSearching(false); return }
        const controller = new AbortController()
        const t = setTimeout(async () => {
            try {
                setSearching(true)
                const res = await fetch(`${API_URL}/admin/products?q=${encodeURIComponent(q)}&limit=40`, {
                    headers: authHeaders(), credentials: 'include', cache: 'no-store', signal: controller.signal,
                })
                const data = await res.json()
                setSearchResults(Array.isArray(data?.data) ? data.data.map(mapRow) : [])
            } catch (err) {
                if (!(err instanceof Error && err.name === 'AbortError')) setSearchResults([])
            } finally {
                setSearching(false)
            }
        }, 300)
        return () => { clearTimeout(t); controller.abort() }
    }, [search])

    const toggle = (p: OrderProduct) => {
        setSelected(prev => {
            const next = { ...prev }
            if (next[p.id]) delete next[p.id]
            else next[p.id] = { ...p, qty: String(p.lastQty && p.lastQty > 0 ? p.lastQty : suggestedQty(p)) }
            return next
        })
    }
    const setQty = (p: OrderProduct, qty: string) => {
        setSelected(prev => ({ ...prev, [p.id]: { ...(prev[p.id] ?? p), ...p, qty } }))
    }
    const remove = (id: number) => {
        setSelected(prev => { const n = { ...prev }; delete n[id]; return n })
    }
    // One-click re-order: add every product from the last order with its previous quantity.
    const reorderLast = () => {
        setSelected(prev => {
            const next = { ...prev }
            for (const p of lastOrder) {
                next[p.id] = { ...p, qty: String(p.lastQty && p.lastQty > 0 ? p.lastQty : suggestedQty(p)) }
            }
            return next
        })
    }

    // Persist the emailed order so it appears as the "last order" next time.
    const recordOrder = (lines: { id: number; qty: number }[]) => {
        const items = lines.map(l => ({ productId: l.id, qty: l.qty }))
        fetch(`${API_URL}/admin/suppliers/${supplier.id}/purchase-order`, {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include',
            cache: 'no-store',
            body: JSON.stringify({ items }),
        }).catch(() => { /* recording is best-effort, never blocks the email */ })
    }

    const selectedList = useMemo(() => Object.values(selected), [selected])
    const validLines = useMemo(
        () => selectedList.filter(s => parseInt(s.qty) > 0).map(s => ({ name: s.name, qty: parseInt(s.qty) })),
        [selectedList]
    )

    const isSearching = !!search.trim()
    const lastOrderIds = useMemo(() => new Set(lastOrder.map(p => p.id)), [lastOrder])
    // When browsing, show the last order on top and don't repeat those rows below.
    const baseList = useMemo(
        () => (isSearching ? searchResults : baseProducts.filter(p => !lastOrderIds.has(p.id))),
        [isSearching, searchResults, baseProducts, lastOrderIds]
    )

    const handleSend = () => {
        if (!supplier.email) {
            alert('This supplier has no email address. Add one in the supplier record first.')
            return
        }
        if (validLines.length === 0) {
            alert('Select at least one product and enter a quantity.')
            return
        }

        // Record the order so it shows as this supplier's "last order" next time.
        recordOrder(selectedList.filter(s => parseInt(s.qty) > 0).map(s => ({ id: s.id, qty: parseInt(s.qty) })))

        const subject = `Purchase Order – ${SHOP_NAME}`
        const lines = validLines.map(l => `- ${l.name} – ${l.qty} units`).join('\n')
        const body =
            `Dear ${supplier.name},\n\n` +
            `Please supply the following products:\n\n` +
            `${lines}\n\n` +
            `Kindly confirm availability and expected delivery date.\n\n` +
            `Thank you.\n\n` +
            `Regards,\n${SHOP_NAME}`

        const gmailUrl =
            `https://mail.google.com/mail/?view=cm&fs=1` +
            `&to=${encodeURIComponent(supplier.email)}` +
            `&su=${encodeURIComponent(subject)}` +
            `&body=${encodeURIComponent(body)}`
        const opened = window.open(gmailUrl, '_blank', 'noopener,noreferrer')
        if (!opened) {
            window.location.href =
                `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        }
    }

    const renderRow = (p: OrderProduct) => {
        const isSel = !!selected[p.id]
        return (
            <div key={p.id}
                className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                    p.isLowStock ? "bg-amber-50/60 border-amber-200" : "bg-white border-purple-100",
                    isSel && "ring-2 ring-primary/30"
                )}>
                <input type="checkbox" checked={isSel} onChange={() => toggle(p)}
                    className="w-5 h-5 accent-[#7E22CE] cursor-pointer shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-black truncate">{p.name}</p>
                        {p.isLowStock && (
                            <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">Low Stock</span>
                        )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500 mt-0.5">
                        Stock: <span className={cn(p.isLowStock ? "text-amber-600" : "text-black")}>{p.stock}</span>
                        <span className="mx-1.5 text-purple-300">•</span>Min: {p.minStock}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <input
                        type="number" min={0} placeholder="Qty"
                        value={selected[p.id]?.qty ?? ''}
                        onChange={(e) => setQty(p, e.target.value)}
                        className="w-20 bg-white border border-purple-100 rounded-xl px-3 py-2 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 text-center"
                    />
                    <span className="text-[9px] font-bold text-purple-400 uppercase">units</span>
                </div>
            </div>
        )
    }

    const nothingToShow = isSearching ? baseList.length === 0 : (baseList.length === 0 && lastOrder.length === 0)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-primary/20">
            <div className="glass-card rounded-[40px] w-full max-w-2xl bg-white shadow-2xl border-purple-100 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-7 pb-4 border-b border-purple-50">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-black font-outfit tracking-tight uppercase">Create Purchase Order</h2>
                            <p className="text-purple-800 mt-1 text-sm font-semibold">{supplier.name}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <Mail size={13} className="text-primary" />
                                <span className="text-[11px] font-bold text-primary">
                                    {supplier.email || <span className="text-red-500">No email on file</span>}
                                </span>
                            </div>
                        </div>
                        <button type="button" onClick={onClose}
                            className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:text-red-500 transition-colors shrink-0">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Your order (selected items) */}
                {selectedList.length > 0 && (
                    <div className="px-7 py-3 bg-primary/5 border-b border-purple-50 max-h-44 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Your Order ({selectedList.length})</p>
                        <div className="space-y-1.5">
                            {selectedList.map(s => (
                                <div key={s.id} className="flex items-center gap-2 bg-white rounded-xl border border-purple-100 px-3 py-1.5">
                                    <span className="flex-1 text-xs font-bold text-black truncate">{s.name}</span>
                                    <input
                                        type="number" min={1} value={s.qty}
                                        onChange={(e) => setQty(s, e.target.value)}
                                        className="w-16 bg-purple-50/50 border border-purple-100 rounded-lg px-2 py-1 text-xs font-bold text-primary text-center outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                    <span className="text-[9px] font-bold text-purple-400 uppercase">units</span>
                                    <button type="button" onClick={() => remove(s.id)}
                                        className="text-purple-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="px-7 pt-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search any product to add to the order…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-purple-50/40 border border-purple-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold text-primary placeholder:text-purple-400 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30"
                        />
                    </div>
                    {!search.trim() && baseMode === 'lowstock' && (
                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                            <AlertTriangle size={14} />
                            No products linked to this supplier yet — showing low-stock items. Search to add any product.
                        </div>
                    )}
                </div>

                {/* Product list */}
                <div className="flex-1 overflow-y-auto px-7 py-4 custom-scrollbar min-h-[160px]">
                    {loading ? (
                        <div className="py-16 flex items-center justify-center text-purple-400"><Loader2 className="animate-spin" size={28} /></div>
                    ) : error ? (
                        <div className="py-10 text-center text-red-600 font-bold text-sm">{error}</div>
                    ) : searching ? (
                        <div className="py-10 flex items-center justify-center text-purple-400"><Loader2 className="animate-spin" size={22} /></div>
                    ) : nothingToShow ? (
                        <div className="py-12 text-center">
                            <PackageSearch size={34} className="mx-auto text-purple-200 mb-3" />
                            <p className="text-sm font-black text-primary uppercase tracking-tight">
                                {isSearching ? 'No products match your search' : 'No products to show'}
                            </p>
                            <p className="text-[11px] text-purple-500 mt-1">Use the search box above to find products to order.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Last ordered from this supplier */}
                            {!isSearching && lastOrder.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                                            <RotateCcw size={12} /> Last Ordered
                                        </p>
                                        <button type="button" onClick={reorderLast}
                                            className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-1 hover:bg-primary/10 transition-all">
                                            Re-order all
                                        </button>
                                    </div>
                                    <div className="space-y-2">{lastOrder.map(renderRow)}</div>
                                </div>
                            )}

                            {/* Supplier products / low-stock / search results */}
                            {baseList.length > 0 && (
                                <div>
                                    {!isSearching && (
                                        <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2">
                                            {baseMode === 'lowstock' ? 'Low Stock Items' : 'Supplier Products'}
                                        </p>
                                    )}
                                    <div className="space-y-2">{baseList.map(renderRow)}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-purple-50 bg-purple-50/30 flex items-center justify-between gap-4">
                    <p className="text-[11px] font-bold text-purple-600 uppercase tracking-widest">
                        {validLines.length} product{validLines.length === 1 ? '' : 's'} in order
                    </p>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose}
                            className="px-6 py-3 rounded-2xl bg-white border border-purple-100 text-primary font-bold uppercase tracking-widest text-[10px] hover:bg-purple-50 transition-all">
                            Cancel
                        </button>
                        <button type="button" onClick={handleSend}
                            disabled={validLines.length === 0 || !supplier.email}
                            className="px-6 py-3 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={14} />
                            Send via Gmail
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
