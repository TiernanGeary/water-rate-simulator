"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Trash2, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import SnapshotCompare from "./snapshot-compare"
import {
  type TierDefinition,
  type BaselineAnchor,
  calculateDemand,
  computePerceivedPrice,
  normalizeTiers,
  validateTiers,
} from "@/lib/demand"
import { generateMonteCarloDraws, runMonteCarloSimulation, type MonteCarloDraws } from "@/lib/montecarlo"
import { SNAPSHOT_CAPTURE_EVENT } from "@/lib/events"

interface Tier extends TierDefinition {
  id: string
}

const TYPICAL_USE_MIN = 3
const USAGE_VARIETY_MIN = 0.3
const USAGE_VARIETY_MAX = 0.5
const BILL_SALIENCE_MIN = 0
const BILL_SALIENCE_MAX = 0.2

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

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
  const [anchor, setAnchor] = useState<BaselineAnchor | null>(null)
  const [draws, setDraws] = useState<MonteCarloDraws | null>(null)
  const [typicalUse, setTypicalUse] = useState<number>(7)
  const [usageVar, setUsageVar] = useState<number>(0.4)
  const [billSalience, setBillSalience] = useState<number>(0.05)

  const normalizedTiers = useMemo(() => normalizeTiers(tiers), [tiers])
  const tierValidation = useMemo(() => validateTiers(normalizedTiers), [normalizedTiers])
  const safeTiers = tierValidation.tiers
  const structuralValidationMessage = tierValidation.isValid ? "" : tierValidation.message ?? ""
  const effectiveTypicalUse = Math.max(typicalUse, TYPICAL_USE_MIN)

  const demandResult = useMemo(() => {
    if (anchor && draws) {
      return runMonteCarloSimulation({
        connections,
        baseFee,
        tiers: safeTiers,
        anchor,
        draws,
        elasticityMean: elasticity,
        usageVar,
        validationMessage: structuralValidationMessage || undefined,
        billSalience,
      })
    }

    const perceivedPrice = computePerceivedPrice(
      effectiveTypicalUse,
      safeTiers,
      baseFee,
      undefined,
      billSalience,
    )
    return calculateDemand({
      connections,
      elasticity,
      baseFee,
      tiers: safeTiers,
      billSalience,
      baseline: { usage: effectiveTypicalUse, perceivedPrice },
    })
  }, [
    anchor,
    baseFee,
    billSalience,
    connections,
    draws,
    elasticity,
    effectiveTypicalUse,
    safeTiers,
    structuralValidationMessage,
    usageVar,
  ])

  const currentMG = demandResult.usageMG || 0
  const currentRevenue = demandResult.revenue || 0

  const combinedValidationMessage =
    validationMessage || structuralValidationMessage || demandResult.validationMessage || ""

  const freezeBaseline = useCallback(
    (force = false) => {
      if (anchor && !force) return
      const usage = effectiveTypicalUse
      const perceivedPrice = computePerceivedPrice(usage, safeTiers, baseFee, undefined, billSalience)
      setAnchor({ usage, perceivedPrice })
      setDraws(generateMonteCarloDraws())
    },
    [anchor, baseFee, billSalience, effectiveTypicalUse, safeTiers],
  )

  const handleBaselineClick = () => {
    freezeBaseline(true)
  }

  useEffect(() => {
    const handleSnapshotCapture = () => {
      freezeBaseline(false)
    }

    if (typeof window !== "undefined") {
      window.addEventListener(SNAPSHOT_CAPTURE_EVENT, handleSnapshotCapture)
      return () => {
        window.removeEventListener(SNAPSHOT_CAPTURE_EVENT, handleSnapshotCapture)
      }
    }
  }, [freezeBaseline])

  const handleAddTier = () => {
    const newId = Math.max(...tiers.map((t) => Number.parseInt(t.id)), 0) + 1
    const previousTier = tiers[tiers.length - 1]
    const nextLower = previousTier ? previousTier.upper ?? previousTier.lower : 0
    const nextPrice = previousTier ? Number((previousTier.price + 1).toFixed(2)) : 0
    setTiers([...tiers, { id: newId.toString(), lower: nextLower, upper: null, price: nextPrice }])
    setValidationMessage("")
  }

  const handleDeleteTier = (id: string) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((t) => t.id !== id))
      setValidationMessage("")
    } else {
      setValidationMessage("Must have at least one tier")
    }
  }

  const handleUpdateTier = (id: string, field: "lower" | "upper" | "price", value: string) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.id !== id) return tier
        if (field === "price") {
          const parsed = Number.parseFloat(value)
          return { ...tier, price: Number.isFinite(parsed) ? parsed : 0 }
        }
        if (field === "upper") {
          if (value.trim() === "") {
            return { ...tier, upper: null }
          }
          const parsed = Number.parseFloat(value)
          return { ...tier, upper: Number.isFinite(parsed) ? parsed : null }
        }
        const parsed = Number.parseFloat(value)
        return { ...tier, lower: Number.isFinite(parsed) ? parsed : 0 }
      }),
    )
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Water Rate Simulator</h1>
          <p className="text-slate-600">Configure pricing tiers and consumer settings</p>
        </div>

        <SnapshotCompare currentMG={currentMG} currentRevenue={currentRevenue} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Consumer Settings</CardTitle>
                <CardDescription className="text-slate-600">Configure consumer demand parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Average price sensitivity (ε)</label>
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

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Baseline & Diversity</CardTitle>
                <CardDescription className="text-slate-600">Freeze today’s typical use and describe variety</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button onClick={handleBaselineClick} title="Freeze today’s typical use and perceived price so changes are measured relative to today.">
                    Set Baseline
                  </Button>
                  <span className="text-xs text-slate-500">
                    {anchor ? `Baseline set at q0 = ${anchor.usage.toFixed(2)} kgal` : "No baseline set"}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Typical monthly use (kgal/conn)</label>
                  <input
                    type="number"
                    min={TYPICAL_USE_MIN}
                    step="0.1"
                    value={typicalUse}
                    onChange={(e) => {
                      const next = Number.parseFloat(e.target.value)
                      setTypicalUse(Number.isFinite(next) ? Math.max(next, TYPICAL_USE_MIN) : TYPICAL_USE_MIN)
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Where most households sit today.</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Customer variety (usage spread)</label>
                    <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-blue-600">
                      {usageVar.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={USAGE_VARIETY_MIN}
                    max={USAGE_VARIETY_MAX}
                    step="0.01"
                    value={usageVar}
                    onChange={(e) => {
                      const next = Number.parseFloat(e.target.value)
                      setUsageVar(Number.isFinite(next) ? clamp(next, USAGE_VARIETY_MIN, USAGE_VARIETY_MAX) : USAGE_VARIETY_MIN)
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500 mt-1">
                    <span>Lower variety</span>
                    <span>More variety</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">How diverse current usage is. More variety = larger high-use tail.</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">Bill salience (β)</label>
                    <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-blue-600">
                      {billSalience.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={BILL_SALIENCE_MIN}
                    max={BILL_SALIENCE_MAX}
                    step="0.01"
                    value={billSalience}
                    onChange={(e) => {
                      const next = Number.parseFloat(e.target.value)
                      setBillSalience(
                        Number.isFinite(next) ? clamp(next, BILL_SALIENCE_MIN, BILL_SALIENCE_MAX) : BILL_SALIENCE_MIN,
                      )
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <p className="text-xs text-slate-500 mt-1">How much the fixed monthly fee influences usage.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Price Settings</CardTitle>
                <CardDescription className="text-slate-600">Define base fee and tiered pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Tiers</h3>
                  <div className="hidden md:grid grid-cols-12 gap-2 mb-2 text-xs text-slate-600 font-medium">
                    <div className="col-span-3">Lower (kgal)</div>
                    <div className="col-span-3">Upper (kgal/∞)</div>
                    <div className="col-span-4">Price ($/kgal)</div>
                    <div className="col-span-2"></div>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-2 bg-slate-50 rounded border border-slate-200"
                      >
                        <div className="md:col-span-3">
                          <label className="text-xs text-slate-600 md:hidden mb-1 block">Lower (kgal)</label>
                          <input
                            type="number"
                            value={tier.lower}
                            onChange={(e) => handleUpdateTier(tier.id, "lower", e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
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

                  <Button onClick={handleAddTier} variant="outline" className="w-full mt-3 border-slate-300 text-slate-700 hover:bg-slate-50 bg-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tier
                  </Button>
                </div>

                {combinedValidationMessage && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {combinedValidationMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Computation Trace</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Median q* (optimal usage)</span>
                      <span className="font-mono text-slate-900">
                        {demandResult.trace.perConnectionUsage.toFixed(2)} kgal
                      </span>
                    </div>
                    {demandResult.trace.usageP5 !== undefined && demandResult.trace.usageP95 !== undefined && (
                      <p className="text-xs text-slate-500 mt-1">
                        P5–P95: {demandResult.trace.usageP5.toFixed(2)} – {demandResult.trace.usageP95.toFixed(2)} kgal
                      </p>
                    )}
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
                    <span className="text-slate-600">Median bill per connection</span>
                    <span className="font-mono text-slate-900">
                      ${demandResult.trace.billPerConnection.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Average price sensitivity (ε)</span>
                    <span className="font-mono text-slate-900">{elasticity.toFixed(2)}</span>
                  </div>
                </div>

                {anchor && (
                  <p className="text-xs text-slate-500 mt-4">Baseline frozen at q0 = {anchor.usage.toFixed(2)} kgal</p>
                )}

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
