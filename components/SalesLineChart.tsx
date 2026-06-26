'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface Point {
    label: string
    value: number
}

// Catmull-Rom → cubic-bezier smoothing for a professional curved line.
function buildSmoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    const t = 0.18
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i === 0 ? 0 : i - 1]
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1]
        const c1x = p1.x + (p2.x - p0.x) * t
        const c1y = p1.y + (p2.y - p0.y) * t
        const c2x = p2.x - (p3.x - p1.x) * t
        const c2y = p2.y - (p3.y - p1.y) * t
        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
    }
    return d
}

function fmtAxis(v: number): string {
    if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
    return `$${Math.round(v)}`
}

export function SalesLineChart({ data }: { data: Point[] }) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(640)
    const [hover, setHover] = useState<number | null>(null)
    const height = 300

    useEffect(() => {
        const measure = () => { if (wrapRef.current) setWidth(wrapRef.current.clientWidth) }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    const padL = 38, padR = 16, padT = 22, padB = 30
    const innerW = Math.max(width - padL - padR, 10)
    const innerH = height - padT - padB

    const max = useMemo(() => Math.max(...data.map(d => d.value), 1), [data])

    const pts = useMemo(() => {
        const n = data.length
        return data.map((d, i) => ({
            x: padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
            y: padT + innerH - (d.value / max) * innerH,
            label: d.label,
            value: d.value,
        }))
    }, [data, max, innerW, innerH])

    const linePath = useMemo(() => buildSmoothPath(pts), [pts])
    const areaPath = useMemo(() => {
        if (pts.length === 0) return ''
        const baseY = padT + innerH
        return `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
    }, [linePath, pts])

    const fractions = [0, 0.25, 0.5, 0.75, 1]
    const labelStep = Math.max(1, Math.ceil(data.length / 10))
    const band = pts.length > 0 ? innerW / pts.length : innerW
    const seriesKey = data.map(d => d.label).join('|')

    if (data.length === 0) {
        return (
            <div className="h-[300px] flex items-center justify-center text-purple-600 font-black uppercase tracking-[0.3em] text-[10px] opacity-60">
                No Sales In This Period
            </div>
        )
    }

    return (
        <div ref={wrapRef} className="w-full">
            <svg width={width} height={height} className="overflow-visible">
                <defs>
                    <linearGradient id="slcLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="45%" stopColor="#A855F7" />
                        <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>
                    <linearGradient id="slcAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A855F7" stopOpacity="0.30" />
                        <stop offset="55%" stopColor="#A855F7" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid lines + Y axis labels */}
                {fractions.map((f, i) => {
                    const y = padT + innerH - f * innerH
                    return (
                        <g key={i}>
                            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#F3E8FF" strokeWidth="1" />
                            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="#C4B5FD">
                                {fmtAxis(max * f)}
                            </text>
                        </g>
                    )
                })}

                {/* Area + line */}
                <path key={`a-${seriesKey}`} className="slc-area" d={areaPath} fill="url(#slcAreaGrad)" />
                <path
                    key={`l-${seriesKey}`}
                    className="slc-line"
                    pathLength={1}
                    d={linePath}
                    fill="none"
                    stroke="url(#slcLineGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Hover crosshair */}
                {hover !== null && pts[hover] && (
                    <line x1={pts[hover].x} x2={pts[hover].x} y1={padT} y2={padT + innerH} stroke="#A855F7" strokeOpacity="0.35" strokeDasharray="4 4" />
                )}

                {/* Data points */}
                {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.5} fill="#fff" stroke="#A855F7" strokeWidth="2.5" />
                ))}

                {/* X axis labels */}
                {pts.map((p, i) => (i % labelStep === 0 || i === pts.length - 1) ? (
                    <text key={i} x={p.x} y={height - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="#6B21A8" className="uppercase">
                        {p.label}
                    </text>
                ) : null)}

                {/* Hover hit areas */}
                {pts.map((p, i) => (
                    <rect
                        key={i}
                        x={p.x - band / 2}
                        y={padT}
                        width={band}
                        height={innerH}
                        fill="transparent"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                    />
                ))}

                {/* Tooltip */}
                {hover !== null && pts[hover] && (() => {
                    const p = pts[hover]
                    const label = `$${p.value.toLocaleString()}`
                    const tw = Math.max(label.length * 7 + 18, 50)
                    const tx = Math.max(padL, Math.min(p.x - tw / 2, width - padR - tw))
                    const ty = Math.max(p.y - 36, 2)
                    return (
                        <g pointerEvents="none">
                            <rect x={tx} y={ty} width={tw} height={26} rx={8} fill="#2E1065" />
                            <text x={tx + tw / 2} y={ty + 17} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{label}</text>
                        </g>
                    )
                })()}
            </svg>
        </div>
    )
}
