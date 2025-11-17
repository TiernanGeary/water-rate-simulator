import type { Tier } from "./demand"

export type HistBin = {
  binStart: number
  binEnd: number
  popShare: number
  volShare: number
}

export const buildUsageHistogram = (usages: number[], binWidth = 1, maxKgal = 30): HistBin[] => {
  if (usages.length === 0) return []
  const totalPop = usages.length
  const totalVolume = usages.reduce((sum, val) => sum + Math.max(val, 0), 0) || 1
  const binCount = Math.floor(maxKgal / binWidth) + 1
  const bins: HistBin[] = Array.from({ length: binCount }, (_, idx) => ({
    binStart: idx * binWidth,
    binEnd: idx === binCount - 1 ? Number.POSITIVE_INFINITY : (idx + 1) * binWidth,
    popShare: 0,
    volShare: 0,
  }))

  usages.forEach((value) => {
    const clampedValue = Math.max(0, value)
    const idx = Math.min(Math.floor(clampedValue / binWidth), binCount - 1)
    bins[idx].popShare += 1 / totalPop
    bins[idx].volShare += clampedValue / totalVolume
  })

  return bins
}

export const activeTierIndex = (tiers: Tier[], usage: number): number => {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const upper = tier.upper ?? Number.POSITIVE_INFINITY
    if (usage >= tier.lower && usage < upper) {
      return i
    }
  }
  return Math.max(0, tiers.length - 1)
}

export const tierKeys = (tiers: Tier[]): string[] => {
  return tiers.map((tier, idx) => {
    if (idx === tiers.length - 1 && tier.upper === null) {
      return "Punitive"
    }
    return `Tier ${idx + 1}`
  })
}

export const tierBreaks = (tiers: Tier[]): number[] => {
  return tiers
    .map((tier) => tier.upper)
    .filter((value): value is number => value !== null && Number.isFinite(value))
}

export type TierShares = {
  label: string
  [tierKey: string]: number
}

export const computeTierOccupancy = (tiers: Tier[], usages: number[]): TierShares => {
  const keys = tierKeys(tiers)
  const counts = keys.map(() => 0)

  usages.forEach((value) => {
    const idx = activeTierIndex(tiers, value)
    counts[idx] += 1
  })

  const total = usages.length || 1
  const shares: TierShares = { label: "" }
  counts.forEach((count, idx) => {
    shares[keys[idx]] = count / total
  })

  return shares
}

export type DecileImpact = {
  decile: string
  deltaMG: number
  pctOfTotal: number
}

export const computeDecileImpacts = (q0: number[], q1: number[], connections: number): DecileImpact[] => {
  const sampleCount = Math.min(q0.length, q1.length)
  if (sampleCount === 0 || connections === 0) {
    return Array.from({ length: 10 }, (_, idx) => ({
      decile: `D${idx + 1}`,
      deltaMG: 0,
      pctOfTotal: 0,
    }))
  }

  const indices = Array.from({ length: sampleCount }, (_, idx) => idx)
  indices.sort((a, b) => q0[a] - q0[b])

  const impacts: DecileImpact[] = []
  const weight = connections / sampleCount / 1000
  let totalDeltaMG = 0

  for (let decile = 0; decile < 10; decile++) {
    const start = Math.floor((decile * sampleCount) / 10)
    const end = Math.floor(((decile + 1) * sampleCount) / 10)
    let decileDelta = 0
    for (let idx = start; idx < end; idx++) {
      const sampleIndex = indices[idx]
      decileDelta += q1[sampleIndex] - q0[sampleIndex]
    }
    const deltaMG = decileDelta * weight
    totalDeltaMG += deltaMG
    impacts.push({
      decile: `D${decile + 1}`,
      deltaMG,
      pctOfTotal: 0,
    })
  }

  const denominator = totalDeltaMG === 0 ? 1 : totalDeltaMG
  impacts.forEach((impact) => {
    impact.pctOfTotal = impact.deltaMG / denominator
  })

  return impacts
}

export type EpsPoint = { eps: number }

export const epsBeeswarmPoints = (epsValues: number[], maxPoints = 400): EpsPoint[] => {
  if (epsValues.length === 0) return []
  if (epsValues.length <= maxPoints) {
    return epsValues.map((eps) => ({ eps }))
  }
  const step = epsValues.length / maxPoints
  const sampled: EpsPoint[] = []
  let cursor = 0
  while (Math.floor(cursor) < epsValues.length && sampled.length < maxPoints) {
    sampled.push({ eps: epsValues[Math.floor(cursor)] })
    cursor += step
  }
  return sampled
}
