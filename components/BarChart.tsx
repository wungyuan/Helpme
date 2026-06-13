// 零依赖的分组柱状图：每个时间桶显示「发起数」与「成功数」两根柱子
export interface BarDatum {
  label: string;
  requests: number;
  successes: number;
}

export default function BarChart({ data }: { data: BarDatum[] }) {
  if (data.length === 0) return <p className='hint'>暂无数据。</p>;

  const W = 320;
  const H = 160;
  const pad = { top: 10, right: 8, bottom: 28, left: 22 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d.requests, d.successes)));
  const groupW = innerW / data.length;
  const barW = Math.min(14, (groupW - 6) / 2);

  return (
    <svg className='barchart' viewBox={`0 0 ${W} ${H}`} role='img' aria-label='发起数与成功数趋势'>
      {/* Y 轴基线 */}
      <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke='#e0e3e8' />
      {[0, 0.5, 1].map((t) => (
        <text key={t} x={pad.left - 4} y={pad.top + innerH - t * innerH + 3} textAnchor='end' className='bc-axis'>
          {Math.round(t * max)}
        </text>
      ))}
      {data.map((d, i) => {
        const gx = pad.left + i * groupW + (groupW - barW * 2 - 2) / 2;
        const rH = (d.requests / max) * innerH;
        const sH = (d.successes / max) * innerH;
        return (
          <g key={d.label}>
            <rect x={gx} y={pad.top + innerH - rH} width={barW} height={rH} className='bar-req' />
            <rect x={gx + barW + 2} y={pad.top + innerH - sH} width={barW} height={sH} className='bar-ok' />
            <text x={gx + barW} y={H - 14} textAnchor='middle' className='bc-axis'>
              {d.label.length > 6 ? d.label.slice(5) : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
