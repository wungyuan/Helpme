// 链条可视化：根（发起人）到当前节点的接力路径
// 昵称左对齐；关系强弱列对齐放在昵称右侧，且仅对发起人展示（showStrength）
const STRENGTH_LABEL: Record<number, string> = { 3: '强', 2: '中', 1: '弱' };

export interface ChainViewNode {
  id: string;
  nickname: string;
  relationStrength?: number | null;
  forwardNote?: string | null;
}

export default function ChainView({
  nodes,
  showStrength = false,
}: {
  nodes: ChainViewNode[];
  showStrength?: boolean;
}) {
  return (
    <ol className='chain'>
      {nodes.map((n, i) => (
        <li key={n.id} className='chain-node'>
          <span className='chain-row'>
            <span className='chain-name'>{n.nickname}</span>
            {showStrength && i > 0 && (
              <span className={`chain-strength strength-${n.relationStrength ?? 1}`}>
                {STRENGTH_LABEL[n.relationStrength ?? 1]}
              </span>
            )}
          </span>
          {n.forwardNote && <span className='chain-note'>“{n.forwardNote}”</span>}
        </li>
      ))}
    </ol>
  );
}
