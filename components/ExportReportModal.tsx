'use client'

import { useState } from 'react'
import { X, Download, Calendar, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api-config'

const SHOP_NAME = 'Spirited Wines'

function localToday(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(str: string, n: number): string {
    const d = new Date(str + 'T00:00:00')
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function firstOfMonth(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const esc = (v: any) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function ExportReportModal({ onClose }: { onClose: () => void }) {
    const today = localToday()
    const [from, setFrom] = useState(today)
    const [to, setTo] = useState(today)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const presets: { label: string; range: () => [string, string] }[] = [
        { label: 'Today', range: () => [today, today] },
        { label: 'Yesterday', range: () => [addDays(today, -1), addDays(today, -1)] },
        { label: 'Last 7 Days', range: () => [addDays(today, -6), today] },
        { label: 'This Month', range: () => [firstOfMonth(), today] },
    ]
    const activePreset = (label: string) => {
        const p = presets.find(x => x.label === label)
        if (!p) return false
        const [f, t] = p.range()
        return f === from && t === to
    }

    const handleExport = async () => {
        setError(null)
        if (from > to) { setError('“From” date must be before “To” date.'); return }
        try {
            setExporting(true)
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/admin/reports/sales?from=${from}&to=${to}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                credentials: 'include',
                cache: 'no-store',
            })
            if (!res.ok) throw new Error(`Report failed (${res.status})`)
            const r = await res.json()

            const lines: string[] = []
            lines.push(`${SHOP_NAME} - Sales Report`)
            lines.push(`Date Range,${esc(r.from)} to ${esc(r.to)}`)
            lines.push(`Generated,${esc(new Date().toLocaleString())}`)
            lines.push('')
            lines.push('SUMMARY')
            lines.push(`Total Orders,${r.summary?.totalOrders ?? 0}`)
            lines.push(`Total Revenue,${(r.summary?.totalRevenue ?? 0).toFixed(2)}`)
            lines.push(`Cash,${(r.summary?.totalCash ?? 0).toFixed(2)}`)
            lines.push(`Card,${(r.summary?.totalCard ?? 0).toFixed(2)}`)
            lines.push('')
            lines.push('PER-DAY BREAKDOWN')
            lines.push(['Date', 'Orders', 'Revenue', 'Cash', 'Card'].join(','))
            for (const d of (r.perDay ?? [])) {
                lines.push([esc(d.date), d.orders, Number(d.revenue).toFixed(2), Number(d.cash).toFixed(2), Number(d.card).toFixed(2)].join(','))
            }
            lines.push('')
            lines.push('DETAILED SALES')
            lines.push(['Receipt No.', 'Date / Time', 'Payment Method', 'Total'].join(','))
            for (const s of (r.sales ?? [])) {
                lines.push([esc(s.receiptNumber || `#${s.id}`), esc(s.createdAt), esc(s.paymentMethod), Number(s.total).toFixed(2)].join(','))
            }

            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = from === to
                ? `sales-report-${from}.csv`
                : `sales-report-${from}_to_${to}.csv`
            a.click()
            URL.revokeObjectURL(url)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-primary/20">
            <div className="glass-card rounded-[40px] w-full max-w-md bg-white shadow-2xl border-purple-100 p-8 animate-entry">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-black font-outfit tracking-tight uppercase">Export Report</h3>
                        <p className="text-purple-800 text-sm font-semibold mt-1">Pick a day or date range to export.</p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:text-red-500 transition-colors shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Quick presets */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                    {presets.map(p => {
                        const active = activePreset(p.label)
                        return (
                            <button key={p.label} type="button"
                                onClick={() => { const [f, t] = p.range(); setFrom(f); setTo(t) }}
                                className={cn(
                                    "py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                                    active ? "bg-primary text-white border-primary shadow-sm shadow-primary/20"
                                        : "bg-white border-purple-100 text-primary hover:bg-purple-50"
                                )}>
                                {p.label}
                            </button>
                        )
                    })}
                </div>

                {/* Date inputs */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest ml-1">From</label>
                        <div className="relative mt-1">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                            <input type="date" value={from} max={to}
                                onChange={(e) => setFrom(e.target.value)}
                                className="w-full bg-purple-50/40 border border-purple-100 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest ml-1">To</label>
                        <div className="relative mt-1">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                            <input type="date" value={to} min={from}
                                onChange={(e) => setTo(e.target.value)}
                                className="w-full bg-purple-50/40 border border-purple-100 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30" />
                        </div>
                    </div>
                </div>

                <p className="text-[10px] font-bold text-purple-400 mt-3 mb-1">
                    {from === to ? `Single-day report for ${from}` : `Report from ${from} to ${to}`} — includes a per-day breakdown.
                </p>
                {error && <p className="text-[11px] font-bold text-red-500 mb-1">{error}</p>}

                <div className="flex gap-3 mt-5">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 rounded-2xl bg-white border border-purple-100 text-primary font-bold uppercase tracking-widest text-[10px] hover:bg-purple-50 transition-all">
                        Cancel
                    </button>
                    <button type="button" onClick={handleExport} disabled={exporting}
                        className="flex-[1.4] py-3 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {exporting ? 'Exporting…' : 'Export CSV'}
                    </button>
                </div>
            </div>
        </div>
    )
}
