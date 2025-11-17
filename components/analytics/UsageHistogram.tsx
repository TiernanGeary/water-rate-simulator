import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts"
import type { Tier } from "@/lib/demand"
import { buildUsageHistogram, tierBreaks } from "@/lib/analytics"

interface UsageHistogramProps {
  q0: number[]
  tiers: Tier[]
}

const UsageHistogram = ({ q0, tiers }: UsageHistogramProps) => {
  const histogram = buildUsageHistogram(q0)
  const tierLines = tierBreaks(tiers)

  const formatLabel = (binStart: number, binEnd: number) => {
    if (binEnd === Number.POSITIVE_INFINITY) {
      return `${binStart}+`
    }
    return `${binStart}-${binEnd}`
  }

  const chartData = histogram.map((bin) => ({
    label: formatLabel(bin.binStart, bin.binEnd),
    popPercent: bin.popShare * 100,
    volPercent: bin.volShare * 100,
    binStart: bin.binStart,
    binEnd: bin.binEnd,
  }))

  const referenceLabels = tierLines
    .map((value) => {
      const bin = histogram.find(
        (entry) =>
          value >= entry.binStart &&
          value < (entry.binEnd === Number.POSITIVE_INFINITY ? value + 1 : entry.binEnd),
      )
      return bin ? formatLabel(bin.binStart, bin.binEnd) : null
    })
    .filter((label): label is string => Boolean(label))

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Usage Diversity (Baseline)</h3>
      <p className="text-xs text-slate-500">Share of accounts by typical monthly use. Reference lines mark tier breaks.</p>
      {histogram.length === 0 ? (
        <p className="text-xs text-slate-500">Set a baseline to view usage diversity.</p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={(value) => `${value.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                formatter={(value, _name, props) => {
                  if (typeof value !== "number") return value
                  if (props?.dataKey === "popPercent") {
                    const vol = props.payload?.volPercent
                    const volText = typeof vol === "number" ? ` · Volume: ${vol.toFixed(1)}%` : ""
                    return [`Accounts: ${value.toFixed(1)}%${volText}`, props?.payload?.label]
                  }
                  return [`${value.toFixed(1)}%`, props?.payload?.label]
                }}
              />
              {referenceLabels.map((label) => (
                <ReferenceLine
                  key={`tier-line-${label}`}
                  x={label}
                  stroke="#cbd5f5"
                  label={{ value: label, fill: "#94a3b8", position: "insideTop" }}
                />
              ))}
              <Bar dataKey="popPercent" fill="#94a3f8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default UsageHistogram
