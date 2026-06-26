'use client'

import { Printer, X, CheckCircle2 } from 'lucide-react'

const SHOP_NAME = 'Spirited Wines'

interface ReceiptItem {
    name: string
    qty: number
    price: number
    lineTotal: number
}

interface ReceiptData {
    receiptNumber: string
    createdAt: string
    items: ReceiptItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    paymentMethod: string
    cashReceived: number
    change: number
    splitPayments: { cash: number; card: number } | null
    customer: { name: string; phone: string } | null
}

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`

export function ReceiptModal({ data, onClose }: { data: ReceiptData | null; onClose: () => void }) {
    if (!data) return null
    const when = new Date(data.createdAt)

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md bg-primary/20">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body * { visibility: hidden; }
                    #receipt-print, #receipt-print * { visibility: visible; }
                    #receipt-print {
                        position: absolute; left: 0; top: 0;
                        width: 80mm; padding: 6mm 5mm;
                        color: #000; background: #fff;
                        font-family: 'Courier New', monospace;
                        border: none !important; border-radius: 0 !important;
                    }
                    .no-print { display: none !important; }
                }
            `}} />

            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm flex flex-col max-h-[92vh] overflow-hidden">
                {/* Success header */}
                <div className="no-print px-6 pt-6 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 size={22} />
                        <span className="font-black uppercase tracking-tight text-sm">Payment Complete</span>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:text-red-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Receipt preview / print area */}
                <div className="overflow-y-auto px-6 pb-3 custom-scrollbar">
                    <div id="receipt-print" className="bg-white border border-dashed border-purple-200 rounded-xl p-5 font-mono text-[12px] text-black leading-relaxed">
                        <div className="text-center mb-2">
                            <h2 className="text-base font-black uppercase tracking-[0.2em]">{SHOP_NAME}</h2>
                            <p className="text-[10px]">Wine • Food • Spirits</p>
                        </div>

                        <div className="text-[10px] text-center border-t border-b border-dashed border-black/30 py-1 my-2">
                            {when.toLocaleString()}
                        </div>

                        <div className="text-[11px] mb-2 space-y-0.5">
                            <div className="flex justify-between"><span>Receipt</span><span>{data.receiptNumber}</span></div>
                            {data.customer && (
                                <div className="flex justify-between"><span>Customer</span><span className="truncate ml-2">{data.customer.name}</span></div>
                            )}
                        </div>

                        <div className="border-t border-dashed border-black/30 pt-2">
                            {data.items.map((it, i) => (
                                <div key={i} className="mb-1">
                                    <div className="truncate uppercase">{it.name}</div>
                                    <div className="flex justify-between text-[11px]">
                                        <span>{it.qty} x {money(it.price)}</span>
                                        <span>{money(it.lineTotal)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-dashed border-black/30 mt-2 pt-2 text-[11px] space-y-0.5">
                            <div className="flex justify-between"><span>Subtotal</span><span>{money(data.subtotal)}</span></div>
                            <div className="flex justify-between"><span>Tax (8.25%)</span><span>{money(data.tax)}</span></div>
                            {data.discount > 0 && (
                                <div className="flex justify-between"><span>Loyalty</span><span>-{money(data.discount)}</span></div>
                            )}
                            <div className="flex justify-between font-black text-[14px] border-t border-black/40 mt-1 pt-1">
                                <span>TOTAL</span><span>{money(data.total)}</span>
                            </div>
                        </div>

                        <div className="border-t border-dashed border-black/30 mt-2 pt-2 text-[11px] space-y-0.5">
                            <div className="flex justify-between"><span>Payment</span><span className="uppercase">{data.paymentMethod}</span></div>
                            {data.paymentMethod === 'cash' && (
                                <>
                                    <div className="flex justify-between"><span>Cash</span><span>{money(data.cashReceived)}</span></div>
                                    <div className="flex justify-between"><span>Change</span><span>{money(data.change)}</span></div>
                                </>
                            )}
                            {data.paymentMethod === 'split' && data.splitPayments && (
                                <>
                                    <div className="flex justify-between"><span>Cash part</span><span>{money(data.splitPayments.cash)}</span></div>
                                    <div className="flex justify-between"><span>Card part</span><span>{money(data.splitPayments.card)}</span></div>
                                </>
                            )}
                        </div>

                        <div className="text-center text-[10px] mt-3 pt-2 border-t border-dashed border-black/30">
                            <p className="font-bold uppercase tracking-wide">Thank you for shopping!</p>
                            <p>Please visit again</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="no-print px-6 pb-6 pt-2 flex gap-3 border-t border-purple-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl bg-white border border-purple-100 text-primary font-bold uppercase tracking-widest text-[10px] hover:bg-purple-50 transition-all"
                    >
                        New Sale
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex-[1.4] py-3 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                        <Printer size={14} /> Print Bill
                    </button>
                </div>
            </div>
        </div>
    )
}
