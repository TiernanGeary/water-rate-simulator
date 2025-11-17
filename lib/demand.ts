export interface TierDefinition {
  lower: number
  upper: number | null
  price: number
}

export type Tier = TierDefinition

export interface BaselineAnchor {
  usage: number
  perceivedPrice: number
}

export interface DemandInputs {
  connections: number
  elasticity: number
  baseFee: number
  tiers: TierDefinition[]
  baseline?: BaselineAnchor | null
  billSalience?: number
}

export interface DemandTrace {
  perConnectionUsage: number
  usageP5?: number
  usageP95?: number
  marginalPrice: number
  averagePrice: number
  perceivedPrice: number
  billPerConnection: number
}

export interface DemandResult {
  usageMG: number
  revenue: number
  volumetricBillPerConnection: number
  trace: DemandTrace
  warnings: string[]
  validationMessage?: string
  tiersUsed: TierDefinition[]
}

export interface TierValidationResult {
  tiers: TierDefinition[]
  isValid: boolean
  message?: string
}

export const BASELINE_USAGE = 7 // kgal per connection per month
export const MIN_USAGE = 0.1
export const MAX_USAGE = 60
export const MIN_PRICE = 0.01
export const DEFAULT_ALPHA = 0.7
export const DEFAULT_BILL_SALIENCE = 0.05
const FIXED_POINT_ITERATIONS = 12

const roundTo = (value: number, decimals = 4) =>
  Number.isFinite(value) ? Number.parseFloat(value.toFixed(decimals)) : 0

export const normalizeTiers = (tiers: TierDefinition[]): TierDefinition[] => {
  return tiers
    .map((tier) => ({
      lower: Math.max(0, roundTo(tier.lower ?? 0)),
      upper: tier.upper === null ? null : roundTo(Math.max(tier.upper, 0)),
      price: Math.max(0, roundTo(tier.price ?? 0, 6)),
    }))
    .sort((a, b) => a.lower - b.lower)
}

const createFallbackTier = (tiers: TierDefinition[]): TierDefinition[] => {
  const fallbackPrice = tiers[0]?.price ?? 0
  return [{ lower: 0, upper: null, price: fallbackPrice }]
}

export const validateTiers = (tiers: TierDefinition[]): TierValidationResult => {
  if (tiers.length === 0) {
    return { tiers: createFallbackTier([{ lower: 0, upper: null, price: 0 }]), isValid: false, message: "Define at least one tier." }
  }

  let expectedLower = 0
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    if (Math.abs(tier.lower - expectedLower) > 1e-6) {
      return {
        tiers: createFallbackTier(tiers),
        isValid: false,
        message: "Tiers must be contiguous with no gaps or overlaps.",
      }
    }

    if (tier.upper !== null && tier.upper <= tier.lower) {
      return {
        tiers: createFallbackTier(tiers),
        isValid: false,
        message: "Each tier's upper bound must be greater than its lower bound.",
      }
    }

    expectedLower = tier.upper ?? Number.POSITIVE_INFINITY
  }

  if (tiers[tiers.length - 1].upper !== null) {
    return {
      tiers: createFallbackTier(tiers),
      isValid: false,
      message: "The final tier must extend to infinity.",
    }
  }

  return { tiers, isValid: true }
}

export const clampUsage = (value: number) => Math.min(Math.max(value, MIN_USAGE), MAX_USAGE)

export const computeMarginalPrice = (usage: number, tiers: TierDefinition[]): number => {
  for (const tier of tiers) {
    if (usage >= tier.lower && (tier.upper === null || usage < tier.upper)) {
      return tier.price
    }
  }
  return tiers[tiers.length - 1]?.price ?? 0
}

export const computeVolumetricCharge = (usage: number, tiers: TierDefinition[]): number => {
  let charge = 0
  for (const tier of tiers) {
    const upper = tier.upper ?? Number.POSITIVE_INFINITY
    if (usage <= tier.lower) break
    const span = Math.min(usage, upper) - tier.lower
    if (span > 0) {
      charge += span * tier.price
    }
    if (usage <= upper) break
  }
  return charge
}

export const computeAveragePrice = (usage: number, tiers: TierDefinition[]): number => {
  if (usage <= 0) return 0
  const volumetric = computeVolumetricCharge(usage, tiers)
  return volumetric / usage
}

export const computePerceivedPrice = (
  usage: number,
  tiers: TierDefinition[],
  baseFee: number,
  alpha = DEFAULT_ALPHA,
  billSalience = 0,
): number => {
  const marginal = computeMarginalPrice(usage, tiers)
  const average = computeAveragePrice(usage, tiers)
  const blended = alpha * marginal + (1 - alpha) * average
  const baseImpact = billSalience * (baseFee / Math.max(usage, MIN_USAGE))
  return blended + baseImpact
}

export const solveUsage = (
  elasticity: number,
  tiers: TierDefinition[],
  baselineUsage: number,
  baselinePrice: number,
  baseFee: number,
  billSalience: number,
): { usage: number; marginalPrice: number; averagePrice: number; perceivedPrice: number } => {
  const baselineUsageClamped = clampUsage(baselineUsage)
  const referencePrice = Math.max(MIN_PRICE, baselinePrice)
  let usage = baselineUsageClamped

  for (let i = 0; i < FIXED_POINT_ITERATIONS; i++) {
    const perceivedPrice = Math.max(MIN_PRICE, computePerceivedPrice(usage, tiers, baseFee, DEFAULT_ALPHA, billSalience))
    const nextUsage = clampUsage(baselineUsageClamped * Math.pow(perceivedPrice / referencePrice, elasticity))
    if (Math.abs(nextUsage - usage) < 0.0005) {
      usage = nextUsage
      break
    }
    usage = nextUsage
  }

  const marginalPrice = computeMarginalPrice(usage, tiers)
  const averagePrice = computeAveragePrice(usage, tiers)
  const perceivedPrice = computePerceivedPrice(usage, tiers, baseFee, DEFAULT_ALPHA, billSalience)

  return { usage, marginalPrice, averagePrice, perceivedPrice }
}

export const calculateDemand = (inputs: DemandInputs): DemandResult => {
  const normalizedTiers = normalizeTiers(inputs.tiers)
  const validation = validateTiers(normalizedTiers)
  const tiers = validation.tiers

  const elasticity = Number.isFinite(inputs.elasticity) ? inputs.elasticity : -0.2
  const baseFee = Math.max(0, inputs.baseFee || 0)
  const connections = Math.max(0, inputs.connections || 0)
  const billSalience = inputs.billSalience ?? DEFAULT_BILL_SALIENCE
  const baselineUsage = clampUsage(inputs.baseline?.usage ?? BASELINE_USAGE)
  const baselinePerceivedPrice = Math.max(
    MIN_PRICE,
    inputs.baseline?.perceivedPrice ?? computePerceivedPrice(baselineUsage, tiers, baseFee, DEFAULT_ALPHA, billSalience),
  )

  const usageSolution = solveUsage(elasticity, tiers, baselineUsage, baselinePerceivedPrice, baseFee, billSalience)
  const volumetricBillPerConnection = computeVolumetricCharge(usageSolution.usage, tiers)
  const billPerConnection = baseFee + volumetricBillPerConnection
  const usageMG = (connections * usageSolution.usage) / 1000
  const revenue = billPerConnection * connections

  const warnings: string[] = []
  if (elasticity >= 0) {
    warnings.push("Elasticity should be negative (e.g., −0.10 to −0.30).")
  }
  if (usageSolution.usage <= MIN_USAGE + 1e-3) {
    warnings.push("Usage settled at the minimum bound. Check elasticity or price inputs.")
  } else if (usageSolution.usage >= MAX_USAGE - 1e-3) {
    warnings.push("Usage reached the maximum bound. Prices may be too low for this elasticity.")
  }

  return {
    usageMG,
    revenue,
    volumetricBillPerConnection,
    trace: {
      perConnectionUsage: usageSolution.usage,
      usageP5: usageSolution.usage,
      usageP95: usageSolution.usage,
      marginalPrice: usageSolution.marginalPrice,
      averagePrice: usageSolution.averagePrice,
      perceivedPrice: usageSolution.perceivedPrice,
      billPerConnection,
    },
    warnings,
    validationMessage: validation.isValid ? undefined : validation.message,
    tiersUsed: tiers,
  }
}
