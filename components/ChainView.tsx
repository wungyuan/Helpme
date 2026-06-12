// 链条可视化：根（发起人）到当前节点的接力路径
const STRENGTH_LABEL: Record<number, string> = { 3: '强', 2: '中', 1: '弱' };

export interface ChainViewNode {
  id: string;
  nickname: string;
  relationStrength: number | null;
  forwardNote?: string | null;
}

export default function ChainView({ nodes }: { nodes: ChainViewNode[] }) {
  return (
    <ol className='chain'>
      {nodes.map((n, i) => (
        <li key={n.id} className='chain-node'>
          {i > 0 && (
            <span className={`chain-link strength-${n.relationStrength ?? 1}`}>
              {STRENGTH_LABEL[n.relationStrength ?? 1]}
            </span>
          )}
          <span className='chain-avatar'>{n.nickname.slice(0, 1)}</span>
          <span className='chain-name'>
            {n.nickname}
            {i === 0 && <em className='chain-tag'>发起人</em>}
          </span>
          {n.forwardNote && <span className='chain-note'>“{n.forwardNote}”</span>}
        </li>
      ))}
    </ol>
  );
}
