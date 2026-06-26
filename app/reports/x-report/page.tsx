'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    RefreshCw,
    DollarSign,
    CreditCard,
    Tag,
    Hash,
    Loader2,
    AlertTriangle,
    Printer,
    Banknote,
    Receipt
} from 'lucide-react'
import { cn } from '@/lib/utils'
import CashierSidebar from '@/components/CashierSidebar'
import { API_URL } from '@/lib/api-config'

interface CategoryStat {
    name: string
    quantity: number
    revenue: number
}

interface XReportData {
    totalSales: number
    totalRevenue: number
    totalCash: number
    totalCard: number
    totalSplit: number
    totalRefunds: number
    openingCash: number
    expectedDrawer: number
    categoryBreakdown: Record<string, CategoryStat>
    recentSales: RecentSale[]
    sessionStart: string
    sessionId: number
}

interface RecentSale {
    created_at: string
    receipt_number: string
    payment_method: string
    total: string
}

interface RegisterData {
    id: number
    status: string
    opening_cash: string
    [key: string]: any
}

interface StatCardProps {
    icon: React.ElementType
    label: string
    value: string | number
    color: string
}

export default function XReportPage() {
    const [report, setReport] = useState<XReportData | null>(null)
    const [loading, setLoading] = useState(true)
    const [register, setRegister] = useState<RegisterData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)
    const [isRetrying, setIsRetrying] = useState(false)
    const router = useRouter()

    const fetchData = useCallback(async (isRetry = false) => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.replace('/admin/login')
            return
        }

        if (!isRetry) {
            setLoading(true)
            setError(null)
            setRetryCount(0)
            setIsRetrying(false)
        } else {
            setIsRetrying(true)
        }

        try {
            // 1. Fetch current register status to get basic info
            const regRes = await fetch(`${API_URL}/register/current`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })

            if (!regRes.ok) {
                if (regRes.status === 401) {
                    router.replace('/admin/login')
                    return
                }
                // If register fetch fails, we probably shouldn't retry X-report logic blindly, but let's stick to the pattern
                throw new Error(`Register fetch failed: ${regRes.status}`)
            }

            const regData = await regRes.json()
            setRegister(regData)

            // 2. Fetch current session to get the ID
            let sessionId = null
            try {
                const sessionRes = await fetch(`${API_URL}/pos/session/current`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    cache: 'no-store'
                })
                if (sessionRes.ok) {
                    const sessionData = await sessionRes.json()
                    sessionId = sessionData.id
                } else {
                    // If no session, that's a specific state, not necessarily an error to retry indefinitely?
                    // But if it's a network error, we catch it below.
                    // If it's 404 (no session), we stop.
                    const sessionErr = await sessionRes.text()
                    console.error('❌ Session fetch failed:', sessionRes.status, sessionErr)
                    throw new Error('No active session found. Please open the register first.')
                }
            } catch (e) {
                // If it's the "No active session" error, rethrow it to stop retries if it's logic error? 
                // Actually, for "No active session", we probably don't want to retry 3 times if it's a 404.
                // But if it's network, we do.
                console.error('Session fetch error:', e)
                throw e
            }

            // 3. Fetch the X-Report data from the backend (Source of Truth)
            const reportUrl = `${API_URL}/reports/x-report?session_id=${sessionId}`

            const reportRes = await fetch(reportUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                cache: 'no-store'
            })

            if (!reportRes.ok) {
                const errorBody = await reportRes.text()
                let parsedError: { message?: string } = {}
                try {
                    parsedError = JSON.parse(errorBody)
                } catch {
                    // ignore if not json
                }

                console.error('❌ X-Report Fetch Failed:', {
                    status: reportRes.status,
                    statusText: reportRes.statusText,
                    body: errorBody,
                    parsed: parsedError,
                    url: reportUrl,
                    timestamp: new Date().toISOString()
                })

                let errorMessage = `Failed to fetch report data: ${reportRes.status} ${reportRes.statusText}`
                if (reportRes.status === 500) {
                    errorMessage = '服务器内部错误，请稍后重试或联系技术支持'
                    if (parsedError && parsedError.message) {
                        errorMessage += ` (${parsedError.message})`
                    }
                } else if (reportRes.status === 404) {
                    errorMessage = '报告资源不存在，请检查报告ID'
                } else if (reportRes.status === 403) {
                    errorMessage = '权限不足，无法访问该报告'
                }

                throw new Error(errorMessage)
            }

            const text = await reportRes.text()
            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('❌ JSON Parse Error. Raw response:', text)
                throw new Error('Invalid server response (check console)')
            }

            // 4. Update report state using backend data ONLY
            setReport({
                totalSales: data.total_transactions || 0,
                totalRevenue: data.gross_revenue || 0,
                totalCash: data.cash_sales || 0,
                totalCard: data.card_sales || 0,
                totalSplit: 0,
                totalRefunds: data.total_refunds || 0,
                openingCash: data.opening_cash || 0,
                expectedDrawer: data.cash_drawer_total || 0,
                categoryBreakdown: data.category_totals || {},
                recentSales: data.recent_sales || [],
                sessionStart: data.opened_at,
                sessionId: data.session_id || data.register_id
            })
            setError(null)
            setIsRetrying(false)
            setLoading(false) // Success - stop loading
        } catch (err: any) {
            console.error('❌ X-Report 数据获取异常:', err)

            // Implementation of retry mechanism
            // Don't retry if it's a "No active session" error (logic error, not transient)
            const isLogicError = err.message.includes('No active session');

            if (!isLogicError && retryCount < 3) {
                const nextRetry = retryCount + 1
                setRetryCount(nextRetry)
                const delay = Math.pow(2, nextRetry) * 1000 // Exponential backoff
                console.log(`🔄 Retrying in ${delay}ms... (Attempt ${nextRetry}/3)`)

                // Keep loading state TRUE while waiting
                setTimeout(() => fetchData(true), delay)
            } else {
                setError(err instanceof Error ? err.message : '未知错误')
                setLoading(false) // Final failure - stop loading
                setIsRetrying(false)
            }
        }
    }, [router, retryCount])


    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000) // Auto-refresh every 10 seconds
        return () => clearInterval(interval)
    }, [fetchData])

    const handlePrint = () => window.print()

    if (loading && !report) {
        return (
            <div className="flex h-screen bg-slate-50">
                <CashierSidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="text-sm font-medium text-slate-500">Generating Real-time X-Report...</p>
                    </div>
                </main>
            </div>
        )
    }

    if (!register) {
        return (
            <div className="flex h-screen bg-slate-50">
                <CashierSidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
                        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Shift</h3>
                        <p className="text-slate-600 mb-6">You must open the cash register to view the X-Report.</p>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                        >
                            Go to POS Terminal
                        </button>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        margin: 14mm;
                        size: A4;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #report-area, #report-area * {
                        visibility: visible;
                    }
                    #report-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        overflow: visible !important;
                        background: white;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            ` }} />

            <CashierSidebar className="no-print" />

            <main id="report-area" className="flex-1 overflow-y-auto pb-24 lg:pb-0">
                <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 lg:space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    Live Session
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Updates every 10s
                                </span>
                            </div>
                            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">X-Report</h1>
                            <p className="text-slate-500 text-sm font-medium">
                                Session #{report?.sessionId} • Started {report?.sessionStart ? new Date(report.sessionStart).toLocaleString() : '...'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 no-print">
                            <button
                                onClick={handlePrint}
                                className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                                title="Print / Save as PDF"
                            >
                                <Printer size={20} />
                            </button>
                            <button
                                onClick={() => { setLoading(true); fetchData(); }}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 transition-all"
                            >
                                <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium flex items-center gap-3">
                            <AlertTriangle size={18} />
                            {error}
                        </div>
                    )}

                    {report && (
                        <div className="space-y-5 lg:space-y-8">
                            {/* Key Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                                <StatCard
                                    icon={Hash}
                                    label="Total Transactions"
                                    value={report.totalSales}
                                    color="bg-purple-50 text-purple-600"
                                />
                                <StatCard
                                    icon={DollarSign}
                                    label="Gross Revenue"
                                    value={`$${report.totalRevenue.toFixed(2)}`}
                                    color="bg-blue-50 text-blue-600"
                                />
                                <StatCard
                                    icon={Banknote}
                                    label="Cash Collections"
                                    value={`$${report.totalCash.toFixed(2)}`}
                                    color="bg-emerald-50 text-emerald-600"
                                />
                                <StatCard
                                    icon={CreditCard}
                                    label="Card Payments"
                                    value={`$${report.totalCard.toFixed(2)}`}
                                    color="bg-amber-50 text-amber-600"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
                                {/* Cash Drawer Section */}
                                <div className="lg:col-span-2 space-y-5 lg:space-y-6">
                                    <div className="bg-white p-5 lg:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                            <div className="w-1 h-6 bg-blue-600 rounded-full" />
                                            Cash Drawer Reconciliation
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-8">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                                    <span className="text-sm font-medium text-slate-500">Opening Cash</span>
                                                    <div className="text-right">
                                                        <span className={cn(
                                                            "text-sm font-bold",
                                                            report.openingCash === 0 ? "text-amber-600" : "text-slate-900"
                                                        )}>
                                                            {report.openingCash === 0 ? "Not Set" : `$${report.openingCash.toFixed(2)}`}
                                                        </span>
                                                        {report.openingCash === 0 && (
                                                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-tighter mt-0.5">
                                                                Warning: Not Recorded
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                                    <span className="text-sm font-medium text-slate-500">Gross Cash Sales</span>
                                                    <span className="text-sm font-bold text-emerald-600">+ ${report.totalCash.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                                    <span className="text-sm font-medium text-slate-500">Total Cash Refunds</span>
                                                    <span className="text-sm font-bold text-red-600">- ${report.totalRefunds.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-center">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expected Drawer Amount</p>
                                                <p className="text-3xl lg:text-4xl font-black tracking-tight text-blue-400">${report.expectedDrawer.toFixed(2)}</p>
                                                <p className="text-[9px] text-slate-500 mt-3 italic">Formula: Opening + Cash Sales - Refunds</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recent Real Sales */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
                                            <Receipt size={18} className="text-slate-300" />
                                        </div>
                                        {/* Desktop table */}
                                        <div className="overflow-x-auto hidden lg:block">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-4">Time</th>
                                                        <th className="px-6 py-4">Receipt</th>
                                                        <th className="px-6 py-4">Method</th>
                                                        <th className="px-6 py-4 text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {report.recentSales.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                                                                No transactions recorded in this session yet.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        report.recentSales.map((sale) => (
                                                            <tr key={sale.receipt_number} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                                    {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </td>
                                                                <td className="px-6 py-4 text-xs font-bold text-slate-900">
                                                                    {sale.receipt_number}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                                        sale.payment_method === 'cash' ? "bg-emerald-100 text-emerald-700" :
                                                                            sale.payment_method === 'card' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                                                                    )}>
                                                                        {sale.payment_method}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                                                                    ${parseFloat(sale.total).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile card list — no horizontal scroll */}
                                        <div className="lg:hidden divide-y divide-slate-100">
                                            {report.recentSales.length === 0 ? (
                                                <div className="px-5 py-10 text-center text-slate-400 italic text-sm">
                                                    No transactions recorded in this session yet.
                                                </div>
                                            ) : (
                                                report.recentSales.map((sale) => (
                                                    <div key={sale.receipt_number} className="flex items-center justify-between gap-3 px-5 py-3">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 truncate">{sale.receipt_number}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">
                                                                {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                                sale.payment_method === 'cash' ? "bg-emerald-100 text-emerald-700" :
                                                                    sale.payment_method === 'card' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                                                            )}>
                                                                {sale.payment_method}
                                                            </span>
                                                            <span className="text-sm font-black text-slate-900">${parseFloat(sale.total).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Category Breakdown */}
                                <div className="bg-white p-5 lg:p-8 rounded-2xl border border-slate-200 shadow-sm h-fit">
                                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <Tag size={18} className="text-blue-600" />
                                        Department Sales
                                    </h3>
                                    <div className="space-y-6">
                                        {Object.keys(report.categoryBreakdown).length === 0 ? (
                                            <div className="py-12 text-center text-slate-400 italic text-sm">
                                                No category data available.
                                            </div>
                                        ) : (
                                            Object.values(report.categoryBreakdown)
                                                .sort((a, b) => b.revenue - a.revenue)
                                                .map((cat, index) => (
                                                    <div key={`cat-${cat?.name || index}-${index}`} className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{cat?.name || 'Uncategorized'}</span>
                                                            <span className="text-sm font-black text-slate-900">${(cat?.revenue || 0).toFixed(2)}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                            <div
                                                                className="bg-blue-600 h-full rounded-full"
                                                                style={{ width: `${((cat?.revenue || 0) / (report.totalRevenue || 1)) * 100}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <span>{cat?.quantity || 0} units</span>
                                                            <span>{(((cat?.revenue || 0) / (report.totalRevenue || 1)) * 100).toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Hidden Printable Report */}
            {report && (
                <div id="printable-area" className="hidden no-print font-mono text-[12px] leading-relaxed">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold uppercase tracking-wider">Spirited Wines</h2>
                        <p className="text-[10px] mt-1">X-REPORT (MID-DAY)</p>
                        <div className="border-b border-black border-dashed my-4"></div>
                        <p className="text-left font-bold">SESSION ID: #{report.sessionId}</p>
                        <p className="text-left">STARTED: {new Date(report.sessionStart).toLocaleString()}</p>
                        <p className="text-left">PRINTED: {new Date().toLocaleString()}</p>
                    </div>

                    <div className="border-b border-black border-dashed my-4"></div>

                    <div className="space-y-2">
                        <div className="flex justify-between font-bold">
                            <span>TOTAL TRANSACTIONS:</span>
                            <span>{report.totalSales}</span>
                        </div>
                        <div className="flex justify-between font-bold text-[14px]">
                            <span>GROSS REVENUE:</span>
                            <span>${report.totalRevenue.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="border-b border-black border-dashed my-4"></div>

                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span>CASH SALES:</span>
                            <span>${report.totalCash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>CARD SALES:</span>
                            <span>${report.totalCard.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>REFUNDS:</span>
                            <span>-${report.totalRefunds.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="border-b border-black border-dashed my-4"></div>

                    <div className="space-y-1 bg-gray-50 p-2">
                        <div className="flex justify-between">
                            <span>OPENING CASH:</span>
                            <span>${report.openingCash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span>EXPECTED DRAWER:</span>
                            <span>${report.expectedDrawer.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="border-b border-black border-dashed my-4"></div>

                    <div>
                        <p className="font-bold underline mb-2">DEPARTMENT BREAKDOWN:</p>
                        <div className="space-y-1">
                            {Object.values(report.categoryBreakdown).map((cat, i) => (
                                <div key={i} className="flex justify-between uppercase">
                                    <span>{(cat?.name || 'Unknown').substring(0, 15)} ({cat?.quantity || 0}):</span>
                                    <span>${(cat?.revenue || 0).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-b border-black border-dashed my-6"></div>

                    <div className="text-center italic text-[10px]">
                        <p>End of X-Report</p>
                        <p>Thank you for your service.</p>
                    </div>
                </div>
            )}
        </div>
    )
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
    return (
        <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2 lg:space-y-3">
            <div className={cn("w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center", color)}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
                <p className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">{value}</p>
            </div>
        </div>
    )
}
