"use client";

import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LabelList,
} from "recharts";
import { formatIDR } from "@/lib/format";

type ChartRow = {
  name: string;
  value: number;
  color: string;
};

function CustomChartTooltip({ active, payload, total }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const val = Number(item.value) || 0;
  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 dark:border-slate-800 text-slate-100 p-2.5 rounded-xl shadow-2xl z-50 text-xs min-w-[140px] space-y-1 pointer-events-none">
      <div className="flex items-center gap-1.5 font-medium text-slate-300">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.payload?.color || item.color || item.fill }}
        />
        <span className="truncate">{item.name || item.payload?.name}</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-bold">
        <span className="text-brand-400">{formatIDR(val)}</span>
        <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
      </div>
    </div>
  );
}

export function CategoryPieChart({ data, total }: { data: ChartRow[]; total: number }) {
  const cleaned = useMemo(() => data.filter((d) => d.value > 0), [data]);

  if (cleaned.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        Belum ada data untuk divisualisasikan
      </div>
    );
  }

  return (
    <div>
      <div className="relative" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={cleaned}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={95}
              innerRadius={60}
              paddingAngle={1}
              stroke="white"
              strokeWidth={2}
            >
              {cleaned.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomChartTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-lg font-bold">{formatIDR(total)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-xs">
        {cleaned.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: d.color }}
            />
            <span className="truncate text-slate-700 dark:text-slate-200">{d.name}</span>
            <span className="ml-auto text-slate-500 dark:text-slate-400 font-medium">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryBarChart({ data, total }: { data: ChartRow[]; total: number }) {
  const cleaned = useMemo(
    () => [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value),
    [data],
  );

  if (cleaned.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        Belum ada data untuk divisualisasikan
      </div>
    );
  }

  const height = Math.max(200, cleaned.length * 36 + 20);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={cleaned} layout="vertical" margin={{ top: 4, right: 50, left: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomChartTooltip total={total} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {cleaned.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : `${(v / 1000).toFixed(0)}rb`
              }
              style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
