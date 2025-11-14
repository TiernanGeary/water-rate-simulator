export interface TierDefinition {
  lower: number
  upper: number | null
  price: number
}

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
}

export interface DemandTrace {
  perConnectionUsage: number
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

interface TierValidationResult {
  tiers: TierDefinition[]
  isValid: boolean
  message?: string
}

const BASELINE_USAGE = 7 // kgal per connection per month
const MIN_USAGE = 0.1
const MAX_USAGE = 60
const MIN_PRICE = 0.01

const roundTo = (value: number, decimals = 4) =>
  Number.isFinite(value) ? Number.parseFloat(value.toFixed(decimals)) : 0

const normalizeTiers = (tiers: TierDefinition[]): TierDefinition[] => {
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

const validateTiers = (tiers: TierDefinition[]): TierValidationResult => {
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

const clampUsage = (value: number) => Math.min(Math.max(value, MIN_USAGE), MAX_USAGE)

const computeMarginalPrice = (usage: number, tiers: TierDefinition[]): number => {
  for (const tier of tiers) {
    if (usage >= tier.lower && (tier.upper === null || usage < tier.upper)) {
      return tier.price
    }
  }
  return tiers[tiers.length - 1]?.price ?? 0
}

const computeVolumetricCharge = (usage: number, tiers: TierDefinition[]): number => {
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

const computeAveragePrice = (usage: number, tiers: TierDefinition[]): number => {
  if (usage <= 0) return 0
  const volumetric = computeVolumetricCharge(usage, tiers)
  return volumetric / usage
}

const computePerceivedPrice = (usage: number, tiers: TierDefinition[]): number => {
  const marginal = computeMarginalPrice(usage, tiers)
  const average = computeAveragePrice(usage, tiers)
  return 0.5 * (marginal + average)
}

const solveUsage = (
  elasticity: number,
  tiers: TierDefinition[],
  baselineUsage: number,
  baselinePrice: number,
): { usage: number; marginalPrice: number; averagePrice: number; perceivedPrice: number } => {
  const baselineUsageClamped = clampUsage(baselineUsage)
  const referencePrice = Math.max(MIN_PRICE, baselinePrice)
  let usage = baselineUsageClamped

  for (let i = 0; i < 25; i++) {
    const perceivedPrice = Math.max(MIN_PRICE, computePerceivedPrice(usage, tiers))
    const nextUsage = clampUsage(baselineUsageClamped * Math.pow(perceivedPrice / referencePrice, elasticity))
    if (Math.abs(nextUsage - usage) < 0.0005) {
      usage = nextUsage
      break
    }
    usage = nextUsage
  }

  const marginalPrice = computeMarginalPrice(usage, tiers)
  const averagePrice = computeAveragePrice(usage, tiers)
  const perceivedPrice = computePerceivedPrice(usage, tiers)

  return { usage, marginalPrice, averagePrice, perceivedPrice }
}

export const calculateDemand = (inputs: DemandInputs): DemandResult => {
  const normalizedTiers = normalizeTiers(inputs.tiers)
  const validation = validateTiers(normalizedTiers)
  const tiers = validation.tiers

  const elasticity = Number.isFinite(inputs.elasticity) ? inputs.elasticity : -0.2
  const baseFee = Math.max(0, inputs.baseFee || 0)
  const connections = Math.max(0, inputs.connections || 0)
  const baselineUsage = clampUsage(inputs.baseline?.usage ?? BASELINE_USAGE)
  const baselinePerceivedPrice = Math.max(
    MIN_PRICE,
    inputs.baseline?.perceivedPrice ?? computePerceivedPrice(baselineUsage, tiers),
  )

  const usageSolution = solveUsage(elasticity, tiers, baselineUsage, baselinePerceivedPrice)
  const volumetricBillPerConnection = computeVolumetricCharge(usageSolution.usage, tiers)
  const billPerConnection = baseFee + volumetricBillPerConnection
  const usageMG = (connections * usageSolution.usage) / 1000
  const revenue = billPerConnection * connections

  const warnings: string[] = []
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
