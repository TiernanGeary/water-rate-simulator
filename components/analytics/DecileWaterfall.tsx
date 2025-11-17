import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell } from "recharts"
import { computeDecileImpacts } from "@/lib/analytics"

interface DecileWaterfallProps {
  q0: number[]
  q1: number[]
  N: number
}

const DecileWaterfall = ({ q0, q1, N }: DecileWaterfallProps) => {
  const impacts = computeDecileImpacts(q0, q1, N)
  const data = impacts.map((impact) => ({
    decile: impact.decile,
    deltaMG: Number(impact.deltaMG.toFixed(4)),
    pctLabel: `${(impact.pctOfTotal * 100).toFixed(0)}%`,
  }))

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Who Drove the Savings? (ΔMG by Usage Decile)</h3>
      <p className="text-xs text-slate-500">ΔMG = (N/S) · Σ(q* − q₀) / 1000 by baseline usage decile.</p>
      {q0.length === 0 || q1.length === 0 ? (
        <p className="text-xs text-slate-500">Run a scenario to see how different usage groups respond.</p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="decile" stroke="#64748b" />
              <YAxis
                stroke="#64748b"
                tickFormatter={(value) => `${value.toFixed(2)} MG`}
                label={{ value: "ΔMG", angle: -90, position: "insideLeft", fill: "#475569" }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                formatter={(value, _name, payload) => {
                  if (typeof value !== "number") return value
                  return [`${value.toFixed(3)} MG (${payload?.payload?.pctLabel} of total)`, payload?.payload?.decile]
                }}
              />
              <Bar dataKey="deltaMG" isAnimationActive={false}>
                <LabelList
                  dataKey="pctLabel"
                  position="top"
                  formatter={(value: string, _name, props) =>
                    `${props?.payload?.deltaMG < 0 ? "−" : "+"}${value}`
                  }
                  className="text-[10px]"
                />
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.deltaMG < 0 ? "#34d399" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default DecileWaterfall
