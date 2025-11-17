import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts"
import { epsBeeswarmPoints } from "@/lib/analytics"

interface ElasticityBeeswarmProps {
  eps: number[]
  center?: number
}

const ElasticityBeeswarm = ({ eps, center }: ElasticityBeeswarmProps) => {
  const points = epsBeeswarmPoints(eps).map((point, idx) => ({
    eps: point.eps,
    jitter: Math.sin((idx + 1) * 12.9898) * 0.8,
  }))

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Price Sensitivity (ε) Profile</h3>
      <p className="text-xs text-slate-500">Distribution of price sensitivity within the population.</p>
      {points.length === 0 ? (
        <p className="text-xs text-slate-500">Set a baseline to view elasticity distribution.</p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="eps"
                domain={[-0.45, 0.05]}
                stroke="#64748b"
                tickFormatter={(value) => value.toFixed(2)}
              />
              <YAxis type="number" dataKey="jitter" hide domain={[-1, 1]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}
                formatter={(value, _name, props) => [`ε = ${props?.payload?.eps.toFixed(3)}`, ""]}
              />
              <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="4 4" />
              {typeof center === "number" && (
                <ReferenceLine
                  x={center}
                  stroke="#6366f1"
                  strokeDasharray="5 5"
                  label={{ value: "ε slider", position: "insideTop", fill: "#4f46e5" }}
                />
              )}
              <Scatter data={points} fill="#7dd3fc" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default ElasticityBeeswarm
