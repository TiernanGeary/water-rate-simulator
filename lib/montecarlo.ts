import {
  BaselineAnchor,
  DemandResult,
  TierDefinition,
  clampUsage,
  computeAveragePrice,
  computeMarginalPrice,
  computePerceivedPrice,
  computeVolumetricCharge,
  solveUsage,
  MIN_USAGE,
  MAX_USAGE,
} from "./demand"

const SAMPLE_SIZE = 3000
const ELASTICITY_STD = 0.05
const ELASTICITY_MIN = -0.4
const ELASTICITY_MAX = -0.05

export interface MonteCarloDraws {
  /**
   * Standard normal draws used to build log-normal usage distributions (q0 seeds)
   */
  q0: number[]
  /**
   * Standard normal draws used to perturb the average elasticity slider
   */
  eps: number[]
}

export interface MonteCarloParams {
  connections: number
  baseFee: number
  tiers: TierDefinition[]
  anchor: BaselineAnchor
  draws: MonteCarloDraws
  elasticityMean: number
  usageVar: number
  validationMessage?: string
  billSalience: number
}

const gaussian = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export const generateMonteCarloDraws = (count = SAMPLE_SIZE): MonteCarloDraws => {
  const q0: number[] = []
  const eps: number[] = []
  for (let i = 0; i < count; i++) {
    q0.push(gaussian())
    eps.push(gaussian())
  }
  return { q0, eps }
}

const percentile = (sortedValues: number[], p: number) => {
  if (sortedValues.length === 0) return 0
  const position = (sortedValues.length - 1) * p
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }
  const weight = position - lowerIndex
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
}

const clampElasticity = (value: number) => Math.min(Math.max(value, ELASTICITY_MIN), ELASTICITY_MAX)

const buildUsageDraws = (anchorUsage: number, usageVar: number, seeds: number[]) => {
  const sigma = Math.max(0.01, usageVar)
  const mu = Math.log(Math.max(anchorUsage, MIN_USAGE)) - 0.5 * sigma * sigma
  return seeds.map((z) => clampUsage(Math.exp(mu + sigma * z)))
}

export const runMonteCarloSimulation = (params: MonteCarloParams): DemandResult => {
  const sampleCount = Math.min(params.draws.q0.length, params.draws.eps.length)
  if (sampleCount === 0) {
    return {
      usageMG: 0,
      revenue: 0,
      volumetricBillPerConnection: 0,
      trace: {
        perConnectionUsage: 0,
        usageP5: 0,
        usageP95: 0,
        marginalPrice: 0,
        averagePrice: 0,
        perceivedPrice: 0,
        billPerConnection: params.baseFee,
      },
      warnings: ["Baseline has not been established yet."],
      validationMessage: params.validationMessage,
      tiersUsed: params.tiers,
    }
  }

  const baselineUsages = buildUsageDraws(params.anchor.usage, params.usageVar, params.draws.q0)
  const usageSamples: number[] = []
  const billSamples: number[] = []
  let usageSum = 0
  let billSum = 0

  for (let i = 0; i < sampleCount; i++) {
    const elasticity = clampElasticity(params.elasticityMean + ELASTICITY_STD * params.draws.eps[i])
    const usageSolution = solveUsage(
      elasticity,
      params.tiers,
      baselineUsages[i],
      params.anchor.perceivedPrice,
      params.baseFee,
      params.billSalience,
    )
    const volumetric = computeVolumetricCharge(usageSolution.usage, params.tiers)
    const bill = params.baseFee + volumetric
    usageSamples.push(usageSolution.usage)
    billSamples.push(bill)
    usageSum += usageSolution.usage
    billSum += bill
  }

  const weight = params.connections / sampleCount
  const usageMG = (usageSum * weight) / 1000
  const revenue = billSum * weight

  const sortedUsage = [...usageSamples].sort((a, b) => a - b)
  const sortedBills = [...billSamples].sort((a, b) => a - b)
  const usageP5 = percentile(sortedUsage, 0.05)
  const usageMedian = percentile(sortedUsage, 0.5)
  const usageP95 = percentile(sortedUsage, 0.95)
  const billMedian = percentile(sortedBills, 0.5)

  const marginalPrice = computeMarginalPrice(usageMedian, params.tiers)
  const averagePrice = computeAveragePrice(usageMedian, params.tiers)
  const perceivedPrice = computePerceivedPrice(usageMedian, params.tiers, params.baseFee, undefined, params.billSalience)

  const warnings: string[] = []
  if (params.elasticityMean >= 0) {
    warnings.push("Elasticity should be negative (e.g., −0.10 to −0.30).")
  }
  if (usageP5 <= MIN_USAGE + 1e-3) {
    warnings.push("Some customers are hitting the minimum usage bound.")
  }
  if (usageP95 >= MAX_USAGE - 1e-3) {
    warnings.push("Some customers are hitting the maximum usage bound.")
  }

  return {
    usageMG,
    revenue,
    volumetricBillPerConnection: Math.max(billMedian - params.baseFee, 0),
    trace: {
      perConnectionUsage: usageMedian,
      usageP5,
      usageP95,
      marginalPrice,
      averagePrice,
      perceivedPrice,
      billPerConnection: billMedian,
    },
    warnings,
    validationMessage: params.validationMessage,
    tiersUsed: params.tiers,
  }
}

export const MONTE_CARLO_SAMPLE_SIZE = SAMPLE_SIZE
export const ELASTICITY_DIVERSITY = ELASTICITY_STD
