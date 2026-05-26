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
            <Tooltip
              formatter={(v: number, name: string) => [
                `${formatIDR(v)} (${((v / total) * 100).toFixed(1)}%)`,
                name,
              ]}
              contentStyle={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-slate-500">Total</p>
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
            <span className="truncate text-slate-700">{d.name}</span>
            <span className="ml-auto text-slate-500 font-medium">
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
          <Tooltip
            formatter={(v: number) => [
              `${formatIDR(v)} (${((v / total) * 100).toFixed(1)}%)`,
              "Pengeluaran",
            ]}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
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
