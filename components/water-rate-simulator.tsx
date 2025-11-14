"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Trash2, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import SnapshotCompare from "./snapshot-compare"
import { calculateDemand, type BaselineAnchor, type TierDefinition } from "@/lib/demand"
import { SNAPSHOT_CAPTURE_EVENT } from "@/lib/events"

interface Tier extends TierDefinition {
  id: string
}

export default function WaterRateSimulator() {
  const [connections, setConnections] = useState<number>(1000)
  const [elasticity, setElasticity] = useState<number>(-0.15)
  const [baseFee, setBaseFee] = useState<number>(25)
  const [tiers, setTiers] = useState<Tier[]>([
    { id: "1", lower: 0, upper: 5, price: 3.5 },
    { id: "2", lower: 5, upper: 10, price: 4.25 },
    { id: "3", lower: 10, upper: null, price: 5.0 },
  ])
  const [validationMessage, setValidationMessage] = useState<string>("")
  const [baselineAnchor, setBaselineAnchor] = useState<BaselineAnchor | null>(null)

  const demandResult = useMemo(
    () =>
      calculateDemand({
        connections,
        elasticity,
        baseFee,
        tiers: tiers.map(({ lower, upper, price }) => ({ lower, upper, price })),
        baseline: baselineAnchor,
      }),
    [connections, elasticity, baseFee, tiers, baselineAnchor],
  )

  const latestTraceRef = useRef(demandResult.trace)
  useEffect(() => {
    latestTraceRef.current = demandResult.trace
  }, [demandResult.trace])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleSnapshotCapture = () => {
      setBaselineAnchor((prev) =>
        prev ?? {
          usage: latestTraceRef.current.perConnectionUsage,
          perceivedPrice: latestTraceRef.current.perceivedPrice,
        },
      )
    }

    window.addEventListener(SNAPSHOT_CAPTURE_EVENT, handleSnapshotCapture)
    return () => {
      window.removeEventListener(SNAPSHOT_CAPTURE_EVENT, handleSnapshotCapture)
    }
  }, [])

  const currentMG = demandResult.usageMG
  const currentRevenue = demandResult.revenue
  const combinedValidationMessage = demandResult.validationMessage ?? validationMessage

  // Add new tier
  const handleAddTier = () => {
    const newId = Math.max(...tiers.map((t) => Number.parseInt(t.id)), 0) + 1
    const previousTier = tiers[tiers.length - 1]
    const defaultLower = previousTier ? previousTier.upper ?? previousTier.lower : 0
    const defaultPrice = previousTier?.price ?? 0
    setTiers([...tiers, { id: newId.toString(), lower: defaultLower, upper: null, price: defaultPrice }])
    setValidationMessage("")
  }

  // Remove tier
  const handleDeleteTier = (id: string) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((t) => t.id !== id))
      setValidationMessage("")
    } else {
      setValidationMessage("Must have at least one tier")
    }
  }

  // Update tier field
  const handleUpdateTier = (id: string, field: "lower" | "upper" | "price", value: string) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.id !== id) return tier
        if (field === "price") {
          const parsedPrice = Number.parseFloat(value)
          return { ...tier, price: Number.isFinite(parsedPrice) ? parsedPrice : 0 }
        }
        if (field === "upper") {
          if (value.trim() === "") {
            return { ...tier, upper: null }
          }
          const parsedUpper = Number.parseFloat(value)
          return { ...tier, upper: Number.isFinite(parsedUpper) ? parsedUpper : null }
        }
        const parsedLower = Number.parseFloat(value)
        return { ...tier, lower: Number.isFinite(parsedLower) ? parsedLower : 0 }
      }),
    )
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Water Rate Simulator</h1>
          <p className="text-slate-600">Configure pricing tiers and consumer settings</p>
        </div>

        {/* Snapshot Compare section */}
        <SnapshotCompare currentMG={currentMG} currentRevenue={currentRevenue} />

        {/* Main Layout: Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* LEFT COLUMN: INPUTS */}
          <div className="space-y-6">
            {/* Consumer Settings Card */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Consumer Settings</CardTitle>
                <CardDescription className="text-slate-600">Configure consumer demand parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connections Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Connections (N)</label>
                  <input
                    type="number"
                    value={connections}
                    onChange={(e) => setConnections(Number.parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Number of active connections</p>
                </div>

                {/* Elasticity Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Elasticity (ε)</label>
                    <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-blue-600">
                      {elasticity.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.30"
                    max="-0.10"
                    step="0.01"
                    value={elasticity}
                    onChange={(e) => setElasticity(Number.parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <p className="text-xs text-slate-500 mt-1">Range: –0.30 to –0.10</p>
                </div>
              </CardContent>
            </Card>

            {/* Price Settings Card */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Price Settings</CardTitle>
                <CardDescription className="text-slate-600">Define base fee and tiered pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Base Monthly Fee */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Base Monthly Fee ($)</label>
                  <input
                    type="number"
                    value={baseFee}
                    onChange={(e) => setBaseFee(Number.parseFloat(e.target.value) || 0)}
                    step="0.01"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Tiers Section */}
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Tiers</h3>

                  {/* Tiers Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 mb-2 text-xs text-slate-600 font-medium">
                    <div className="col-span-3">Lower (kgal)</div>
                    <div className="col-span-3">Upper (kgal/∞)</div>
                    <div className="col-span-4">Price ($/kgal)</div>
                    <div className="col-span-2"></div>
                  </div>

                  {/* Tiers List */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-2 bg-slate-50 rounded border border-slate-200"
                      >
                        {/* Lower Bound */}
                        <div className="md:col-span-3">
                          <label className="text-xs text-slate-600 md:hidden mb-1 block">Lower (kgal)</label>
                          <input
                            type="number"
                            value={tier.lower}
                            onChange={(e) => handleUpdateTier(tier.id, "lower", e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Upper Bound */}
                        <div className="md:col-span-3">
                          <label className="text-xs text-slate-600 md:hidden mb-1 block">Upper (kgal/∞)</label>
                          <input
                            type="number"
                            value={tier.upper ?? ""}
                            onChange={(e) => handleUpdateTier(tier.id, "upper", e.target.value)}
                            placeholder="∞"
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Price */}
                        <div className="md:col-span-4">
                          <label className="text-xs text-slate-600 md:hidden mb-1 block">Price ($/kgal)</label>
                          <input
                            type="number"
                            value={tier.price}
                            onChange={(e) => handleUpdateTier(tier.id, "price", e.target.value)}
                            step="0.01"
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Delete Button */}
                        <div className="md:col-span-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTier(tier.id)}
                            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Tier Button */}
                  <Button
                    onClick={handleAddTier}
                    variant="outline"
                    className="w-full mt-3 border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tier
                  </Button>
                </div>

                {/* Validation Message */}
                {combinedValidationMessage && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {combinedValidationMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: OUTPUTS */}
          <div className="space-y-6">
            {/* Computation Trace */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Computation Trace</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-slate-600">q* (optimal usage)</span>
                    <span className="font-mono text-slate-900">
                      {demandResult.trace.perConnectionUsage.toFixed(2)} kgal
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Pm(q*) (marginal price)</span>
                    <span className="font-mono text-slate-900">
                      ${demandResult.trace.marginalPrice.toFixed(2)}/kgal
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Pav(q*) (avg price)</span>
                    <span className="font-mono text-slate-900">
                      ${demandResult.trace.averagePrice.toFixed(2)}/kgal
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Pperc (perceived price)</span>
                    <span className="font-mono text-slate-900">
                      ${demandResult.trace.perceivedPrice.toFixed(2)}/kgal
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Bill per connection</span>
                    <span className="font-mono text-slate-900">
                      ${demandResult.trace.billPerConnection.toFixed(2)}
                    </span>
                  </div>
                </div>

                {demandResult.warnings.length > 0 && (
                  <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">Model notes</p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-amber-800">
                      {demandResult.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="h-12"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
