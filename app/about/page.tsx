import type { CSSProperties } from 'react';
import Link from 'next/link';

// 动态宣传页：两类典型场景各举两例，演示链条如何一棒棒接力达成
interface Step {
  name: string;
  role: string;
  tag?: string;
}
interface Demo {
  title: string;
  steps: Step[];
}

// 定向找某人：接力寻路型——发起人明确知道要找谁
const DIRECTED: Demo[] = [
  {
    title: '想认识马斯克，聊聊创业',
    steps: [
      { name: '你', role: '想找马斯克请教', tag: '发起人' },
      { name: '老同事 · 阿杰', role: '在一家美元基金' },
      { name: '投资人 · Lena', role: '投过硬科技公司' },
      { name: 'SpaceX 工程师 · Mark', role: '内部能递到话' },
      { name: '马斯克', role: '收到引荐 ✅', tag: '目标' },
    ],
  },
  {
    title: '找失联 20 年的老班长',
    steps: [
      { name: '你', role: '想再联系上老班长', tag: '发起人' },
      { name: '大学室友 · 强', role: '老家也在那座城' },
      { name: '发小 · 婷', role: '认识班长家邻居' },
      { name: '班长表妹 · 琳', role: '有班长微信' },
      { name: '老班长', role: '接上了 ✅', tag: '目标' },
    ],
  },
];

// 找某类资源：需求广播 + 认领型——发起人只描述需求，谁能帮谁认领
const RESOURCE: Demo[] = [
  {
    title: '狗丢了，请爱心人士帮忙找',
    steps: [
      { name: '你', role: '金毛在 XX 路走失', tag: '发起人' },
      { name: '小区群友 · 萌萌', role: '转到了几个本地群' },
      { name: '宠物店老板 · 王姐', role: '认识周边巡逻队' },
      { name: '流浪动物志愿者 · 阿May', role: '常在那一带' },
      { name: '热心阿姨', role: '「这只狗我见过！」✅', tag: '认领' },
    ],
  },
  {
    title: '孩子罕见病，找对口专家',
    steps: [
      { name: '你', role: '想找能看这个病的医生', tag: '发起人' },
      { name: '同事 · 老周', role: '爱人在医院工作' },
      { name: '三甲护士 · 小敏', role: '熟悉各科室' },
      { name: '科室同行 · 陈医生', role: '推荐了权威专家' },
      { name: '专家 · 李主任', role: '「这个我能看」✅', tag: '认领' },
    ],
  },
];

function DemoChain({ demo }: { demo: Demo }) {
  return (
    <div className='panel demo-case'>
      <p className='demo-title'>{demo.title}</p>
      <div className='demo-chain'>
        {demo.steps.map((n, i) => (
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
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className='page'>
      <p className='breadcrumb'>它是怎么工作的</p>
      <h1>你想找的那个人，其实并不远</h1>
      <p className='lead'>
        你不必认识对方，只要把求助交给“可能更近一点”的朋友。每个人往前递一棒，
        一条看不见的桥，就这样一节节亮起来。下面是两类典型场景。
      </p>

      <h2>① 定向找某人 · 接力寻路</h2>
      <p className='hint'>你明确知道要找谁，靠中间人一棒棒把你引荐过去。</p>
      {DIRECTED.map((d) => (
        <DemoChain key={d.title} demo={d} />
      ))}

      <h2>② 找某类资源 · 需求广播 + 认领</h2>
      <p className='hint'>你只描述需求，谁能帮上忙，谁就在链条末端认领。</p>
      {RESOURCE.map((d) => (
        <DemoChain key={d.title} demo={d} />
      ))}

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
