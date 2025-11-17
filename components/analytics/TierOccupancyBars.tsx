import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts"
import type { Tier } from "@/lib/demand"
import { computeTierOccupancy, tierKeys } from "@/lib/analytics"

interface TierOccupancyBarsProps {
  tiers: Tier[]
  qBaseline: number[]
  qProposal: number[]
}

const TierOccupancyBars = ({ tiers, qBaseline, qProposal }: TierOccupancyBarsProps) => {
  const keys = tierKeys(tiers)
  const baselineShares = computeTierOccupancy(tiers, qBaseline)
  baselineShares.label = "Baseline"
  const proposalShares = computeTierOccupancy(tiers, qProposal)
  proposalShares.label = "Proposal"

  const dataset = [baselineShares, proposalShares].map((row) => {
    const entry: Record<string, number | string> = { label: row.label }
    keys.forEach((key) => {
      entry[key] = (row[key] ?? 0) * 100
    })
    return entry
  })

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Tier Occupancy (Before → After)</h3>
      <p className="text-xs text-slate-500">Share of accounts by active tier.</p>
      {qBaseline.length === 0 || qProposal.length === 0 ? (
        <p className="text-xs text-slate-500">Set a baseline and run a scenario to see tier occupancy.</p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataset} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={(value) => `${value.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name as string]}
              />
              <Legend />
              {keys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={idx % 2 === 0 ? "#a5b4fc" : "#c7d2fe"}
                  radius={idx === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default TierOccupancyBars
