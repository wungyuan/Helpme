import type { CSSProperties } from 'react';
import Link from 'next/link';

// 动态宣传页：演示一条求助如何一棒棒接力，最终连到“马斯克”
const DEMO = [
  { name: '你', role: '想找马斯克聊聊创业', tag: '发起人' },
  { name: '老同事 · 阿杰', role: '在一家美元基金' },
  { name: '投资人 · Lena', role: '投过几家硬科技公司' },
  { name: 'SpaceX 工程师 · Mark', role: '内部能递到话' },
  { name: '马斯克', role: '收到引荐 ✅', tag: '目标' },
];

export default function AboutPage() {
  return (
    <main className='page'>
      <p className='breadcrumb'>它是怎么工作的</p>
      <h1>从「你」到「马斯克」，只隔几个朋友</h1>
      <p className='lead'>
        你不必认识马斯克，只要把求助交给“可能更近一点”的朋友。每个人都往前递一棒，
        一条看不见的桥，就这样一节节亮起来。
      </p>

      <div className='demo-chain' aria-hidden>
        {DEMO.map((n, i) => (
          <div key={n.name} className='demo-node' style={{ '--i': i } as CSSProperties}>
            {i > 0 && <span className='demo-link' />}
            <div className='demo-card'>
              <span className='demo-name'>
                {n.name}
                {n.tag && <em className='chain-tag'>{n.tag}</em>}
              </span>
              <span className='demo-role'>{n.role}</span>
            </div>
          </div>
        ))}
      </div>

      <h2>为什么它行得通</h2>
      <ul className='feature-list'>
        <li>🔗 <strong>接力即背书</strong>：每一次转发，都是“我认识 TA、我愿意帮”的真实信号。</li>
        <li>📏 <strong>最短 + 最强</strong>：多条桥同时生长，自动标出跳数最少、关系最稳的那条。</li>
        <li>🔒 <strong>隐私优先</strong>：私密求助里，每个人只看到与自己直接相连的人；联系方式沿链条逐级回传，不公开。</li>
        <li>📇 <strong>不碰通讯录</strong>：不读取手机或微信好友，链条完全靠朋友自愿接力形成。</li>
      </ul>

      <Link href='/new' className='primary button'>
        试试发起我的求助
      </Link>
      <p className='hint center' style={{ marginTop: '12px' }}>
        <Link href='/'>← 回首页</Link>
      </p>
    </main>
  );
}
