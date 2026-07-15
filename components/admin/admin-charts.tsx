'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface MrrPoint {
  month: string;
  mrr: number;
  new: number;
  churned: number;
}

interface PlanBreakdown {
  name: string;
  value: number;
}

interface SignupPoint {
  day: string;
  signups: number;
}

interface ChurnPoint {
  month: string;
  rate: number;
}

const CHART_COLORS = {
  red: '#C8392B',
  redLight: '#e85545',
  redFade: 'rgba(200,57,43,0.15)',
  orange: '#E67E22',
  blue: '#3B82F6',
  green: '#22C55E',
  gray: '#374151',
  gridLine: 'rgba(255,255,255,0.04)',
  tick: '#6B7280',
};

const PLAN_COLORS = ['#C8392B', '#E67E22', '#3B82F6', '#8B5CF6'];

const tooltipStyle = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#e5e7eb',
  fontSize: '12px',
};

export function MrrChart({ data }: { data: MrrPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.red} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.2} />
            <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} />
        <XAxis dataKey="month" tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, '']} />
        <Area type="monotone" dataKey="mrr" stroke={CHART_COLORS.red} strokeWidth={2} fill="url(#mrrGrad)" name="MRR" />
        <Area type="monotone" dataKey="new" stroke={CHART_COLORS.green} strokeWidth={1.5} fill="url(#newGrad)" name="New MRR" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PlanBreakdownChart({ data }: { data: PlanBreakdown[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: unknown) => [`${v} orgs`, String(name)]} />
        <Legend
          formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: 11 }}>{value}</span>}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SignupsChart({ data }: { data: SignupPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} />
        <XAxis dataKey="day" tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="signups" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} name="Signups" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChurnRateChart({ data }: { data: ChurnPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.orange} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} />
        <XAxis dataKey="month" tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v}%`, 'Churn Rate']} />
        <Area type="monotone" dataKey="rate" stroke={CHART_COLORS.orange} strokeWidth={2} fill="url(#churnGrad)" name="Churn Rate" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
