'use client';

// 开发者后台：数据统计（图表）+ 链条/联系方式全量查看，需口令
import { useCallback, useEffect, useState } from 'react';
import BarChart from '@/components/BarChart';

type Granularity = 'day' | 'week' | 'month' | 'year';
const G_LABEL: Record<Granularity, string> = { day: '日', week: '周', month: '月', year: '年' };
const KEY_STORE = 'helpme_admin_key';

interface Stats {
  granularity: Granularity;
  totals: { requests: number; successes: number; relayNodes: number; successRate: number };
  byVisibility: { private: number; public: number };
  byReward: { paid: number; friendship: number };
  // 后台 API 返回的时间桶字段名为 bucket
  series: { bucket: string; requests: number; successes: number }[];
}

interface AdminNode {
  id: string;
  parentNodeId: string | null;
  nickname: string;
  contact: string | null;
  relationStrength: number | null;
  forwardNote: string | null;
}
interface AdminChain {
  hops: number;
  minStrength: number;
  contact: string;
  message: string | null;
  path: string[];
}
interface AdminRequest {
  request: {
    id: string;
    title: string;
    description: string;
    visibility: 'private' | 'public';
    rewardType: 'paid' | 'friendship';
    rewardNote: string | null;
    status: string;
    createdAt: number;
  };
  nodeCount: number;
  nodes: AdminNode[];
  chains: AdminChain[];
}

export default function AdminPage() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [stats, setStats] = useState<Stats | null>(null);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // 恢复上次输入的口令
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(localStorage.getItem(KEY_STORE) ?? '');
  }, []);

  const load = useCallback(
    async (k: string, g: Granularity) => {
      setError('');
      const [sRes, rRes] = await Promise.all([
        fetch(`/api/admin/stats?key=${encodeURIComponent(k)}&granularity=${g}`),
        fetch(`/api/admin/requests?key=${encodeURIComponent(k)}`),
      ]);
      if (!sRes.ok) {
        setError('口令错误或无权限');
        setAuthed(false);
        return;
      }
      setStats(await sRes.json());
      setRequests((await rRes.json()).requests);
      setAuthed(true);
      localStorage.setItem(KEY_STORE, k);
    },
    []
  );

  if (!authed) {
    return (
      <main className='page'>
        <h1>开发者后台</h1>
        <div className='form'>
          <label>
            访问口令
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder='ADMIN_KEY' type='password' />
          </label>
          {error && <p className='error'>{error}</p>}
          <button className='primary' onClick={() => load(key, granularity)}>
            进入
          </button>
          <p className='hint'>口令由环境变量 ADMIN_KEY 配置；本地未配置时默认为 admin。</p>
        </div>
      </main>
    );
  }

  return (
    <main className='page wide'>
      <h1>数据统计</h1>

      <div className='stat-grid'>
        <div className='stat-card'>
          <span className='stat-num'>{stats!.totals.requests}</span>
          <span className='stat-label'>发起总数</span>
        </div>
        <div className='stat-card'>
          <span className='stat-num'>{stats!.totals.successes}</span>
          <span className='stat-label'>成功数</span>
        </div>
        <div className='stat-card'>
          <span className='stat-num'>{stats!.totals.successRate}%</span>
          <span className='stat-label'>成功率</span>
        </div>
        <div className='stat-card'>
          <span className='stat-num'>{stats!.totals.relayNodes}</span>
          <span className='stat-label'>接力人次</span>
        </div>
      </div>

      <h2>
        趋势
        <span className='g-switch'>
          {(['day', 'week', 'month', 'year'] as Granularity[]).map((g) => (
            <button
              key={g}
              className={granularity === g ? 'chip active' : 'chip'}
              onClick={() => {
                setGranularity(g);
                load(key, g);
              }}
            >
              {G_LABEL[g]}
            </button>
          ))}
        </span>
      </h2>
      <div className='panel'>
        <BarChart
          data={stats!.series.map((s) => ({
            label: s.bucket,
            requests: s.requests,
            successes: s.successes,
          }))}
        />
        <p className='legend'>
          <span className='dot req' /> 发起数 <span className='dot ok' /> 成功数
        </p>
      </div>

      <h2>构成</h2>
      <div className='panel'>
        <p>
          可见性：私密 <strong>{stats!.byVisibility.private}</strong> · 公开{' '}
          <strong>{stats!.byVisibility.public}</strong>
        </p>
        <p>
          性质：有偿 <strong>{stats!.byReward.paid}</strong> · 友情{' '}
          <strong>{stats!.byReward.friendship}</strong>
        </p>
      </div>

      <h2>全部求助与链条（{requests.length}）</h2>
      {requests.map((r) => (
        <div key={r.request.id} className='panel'>
          <p className='branch-head'>
            <span className='chain-name'>{r.request.title}</span>
            <span className='meta'>
              {r.request.visibility === 'private' ? '🔒' : '👀'} ·{' '}
              {r.request.rewardType === 'paid' ? '有偿' : '友情'} · {r.nodeCount} 人
            </span>
          </p>
          <p className='desc small'>{r.request.description}</p>

          {r.chains.length > 0 && (
            <div className='admin-chains'>
              <p className='meta'>达成链条：</p>
              {r.chains.map((ch, i) => (
                <p key={i} className='admin-chain'>
                  {ch.path.join(' → ')}（{ch.hops} 跳）— 联系方式：<strong>{ch.contact}</strong>
                </p>
              ))}
            </div>
          )}

          <details>
            <summary className='meta'>全部节点与联系方式（{r.nodes.length}）</summary>
            <table className='admin-table'>
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>联系方式</th>
                  <th>与上一跳</th>
                </tr>
              </thead>
              <tbody>
                {r.nodes.map((n) => (
                  <tr key={n.id}>
                    <td>
                      {n.nickname}
                      {n.parentNodeId === null && ' （发起人）'}
                    </td>
                    <td>{n.contact ?? '—'}</td>
                    <td>{['', '弱', '中', '强'][n.relationStrength ?? 0] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      ))}
    </main>
  );
}
