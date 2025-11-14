"use client"

import { useState } from "react"
import { Trash2, RotateCcw, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { SNAPSHOT_CAPTURE_EVENT } from "@/lib/events"

interface Snapshot {
  id: string
  mg: number
  revenue: number
  timestamp: Date
}

interface SnapshotCompareProps {
  currentMG: number
  currentRevenue: number
}

const formatTruncatedNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M'
  } else if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K'
  }
  return value.toFixed(1)
}

export default function SnapshotCompare({ currentMG, currentRevenue }: SnapshotCompareProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [displayedMG, setDisplayedMG] = useState<number>(currentMG)
  const [displayedRevenue, setDisplayedRevenue] = useState<number>(currentRevenue)

  const handleCapture = () => {
    const newSnapshot: Snapshot = {
      id: `snapshot-${Date.now()}`,
      mg: currentMG,
      revenue: currentRevenue,
      timestamp: new Date(),
    }

    if (snapshots.length >= 20) {
      setSnapshots([...snapshots.slice(1), newSnapshot])
    } else {
      setSnapshots([...snapshots, newSnapshot])
    }

    setDisplayedMG(currentMG)
    setDisplayedRevenue(currentRevenue)

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SNAPSHOT_CAPTURE_EVENT))
    }
  }

  const handleUndo = () => {
    if (snapshots.length > 0) {
      setSnapshots(snapshots.slice(0, -1))
      if (snapshots.length > 1) {
        const previousSnapshot = snapshots[snapshots.length - 2]
        setDisplayedMG(previousSnapshot.mg)
        setDisplayedRevenue(previousSnapshot.revenue)
      } else {
        setDisplayedMG(currentMG)
        setDisplayedRevenue(currentRevenue)
      }
    }
  }

  const handleClearAll = () => {
    setSnapshots([])
    setDisplayedMG(currentMG)
    setDisplayedRevenue(currentRevenue)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const chartData = snapshots.slice(-5).map((s, idx) => ({
    label: `v${snapshots.length - 5 + idx + 1}`,
    mg: Number(s.mg.toFixed(2)),
    revenue: Number(s.revenue.toFixed(0)),
  }))

  const getPreviousValue = (metric: 'mg' | 'revenue'): number | null => {
    if (snapshots.length === 0) return null
    const previousSnapshot = snapshots[snapshots.length - 1]
    return metric === 'mg' ? previousSnapshot.mg : previousSnapshot.revenue
  }

  const calculatePercentDifference = (current: number, previous: number | null): number | null => {
    if (previous === null || previous === 0) return null
    return ((current - previous) / previous) * 100
  }

  const previousMG = snapshots.length > 1 ? snapshots[snapshots.length - 2].mg : null
  const previousRevenue = snapshots.length > 1 ? snapshots[snapshots.length - 2].revenue : null
  const mgDiffPercent = displayedMG !== null && previousMG !== null ? calculatePercentDifference(displayedMG, previousMG) : null
  const revenueDiffPercent = displayedRevenue !== null && previousRevenue !== null ? calculatePercentDifference(displayedRevenue, previousRevenue) : null

  const getDiffColor = (diff: number | null): string => {
    if (diff === null) return 'text-slate-400'
    return diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-500'
  }

  const getDiffSymbol = (diff: number | null): string => {
    if (diff === null) return '—'
    return diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleCapture}
          className="text-white hover:bg-blue-700 bg-[rgba(235,38,134,1)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Capture
        </Button>
        <Button
          onClick={handleUndo}
          variant="outline"
          size="sm"
          disabled={snapshots.length === 0}
          className="border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Undo
        </Button>
        <Button
          onClick={handleClearAll}
          variant="outline"
          size="sm"
          disabled={snapshots.length === 0}
          className="border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Clear All
        </Button>
        <span className="text-xs text-slate-500 ml-auto self-center">
          {snapshots.length} snapshots
        </span>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Water Use Chart */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-slate-900">Water Use (MG/mo)</CardTitle>
            <div className="text-right">
              <div className="text-2xl font-bold text-[rgba(146,151,241,1)]">{displayedMG?.toFixed(1)}</div>
              <p className={`text-xs font-semibold ${getDiffColor(mgDiffPercent)}`}>
                {getDiffSymbol(mgDiffPercent)} {mgDiffPercent !== null ? Math.abs(mgDiffPercent).toFixed(1) : '—'}%
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 30, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={formatTruncatedNumber} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                  labelStyle={{ color: "#0f172a" }}
                  formatter={(value) => `${Number(value).toFixed(2)} MG`}
                />
                <Bar
                  dataKey="mg"
                  fill="#9498F2"
                  radius={[6, 6, 0, 0]}
                  label={{ position: "top", fill: "#1e293b", fontSize: 12, formatter: formatTruncatedNumber }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-slate-900">Revenue ($/mo)</CardTitle>
            <div className="text-right">
              <div className="text-2xl font-bold text-[rgba(108,201,119,1)]">${displayedRevenue?.toFixed(0)}</div>
              <p className={`text-xs font-semibold ${getDiffColor(revenueDiffPercent)}`}>
                {getDiffSymbol(revenueDiffPercent)} {revenueDiffPercent !== null ? Math.abs(revenueDiffPercent).toFixed(1) : '—'}%
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 30, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={formatTruncatedNumber} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                  labelStyle={{ color: "#0f172a" }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar
                  dataKey="revenue"
                  fill="#6DC978"
                  radius={[6, 6, 0, 0]}
                  label={{ position: "top", fill: "#1e293b", fontSize: 12, formatter: formatTruncatedNumber }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
