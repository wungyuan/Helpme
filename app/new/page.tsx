'use client';

// 创建求助卡片：只需标题 + 描述；另选可见性与求助性质
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getClientToken,
  getSavedNickname,
  getSavedPhone,
  saveNickname,
  savePhone,
} from '@/lib/clientToken';
import ImageUpload from '@/components/ImageUpload';
import SiteFooter from '@/components/SiteFooter';

export default function NewRequestPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [rewardType, setRewardType] = useState<'paid' | 'friendship'>('friendship');
  const [rewardNote, setRewardNote] = useState('');
  // 终止条件（均可选）：匹配到几条就停 / 多少天后截止
  const [matchCount, setMatchCount] = useState('3');
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 从 localStorage 恢复昵称/手机号只能在客户端 effect 中做，否则 SSR 水合不一致
    /* eslint-disable react-hooks/set-state-in-effect */
    setNickname(getSavedNickname());
    setPhone(getSavedPhone());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorToken: getClientToken(),
          creatorPhone: phone,
          nickname,
          title,
          description,
          imageUrl,
          visibility,
          rewardType,
          rewardNote,
          // 空 / 0 表示不限
          targetMatchCount: matchCount ? Number(matchCount) : null,
          deadlineAt: deadlineDays ? Date.now() + Number(deadlineDays) * 86400000 : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '创建失败');
      saveNickname(nickname);
      savePhone(phone);
      router.push(`/my/${data.requestId}?root=${data.rootNodeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
      setBusy(false);
    }
  }

  return (
    <main className='page'>
      <h1>说出你想找的人</h1>
      <p className='lead'>写清楚、写真诚，朋友们才愿意帮你把它传下去。</p>
      <div className='form'>
        <label>
          你的昵称
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder='链条上的人会看到' />
        </label>
        <label>
          你的手机号
          <input
            type='tel'
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder='用于换手机/电脑时找回你发起的求助'
          />
        </label>
        <p className='hint'>手机号只用于你自己跨设备找回求助，不会展示给接力者。</p>
        <label>
          标题
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='一句话说清你要找谁、找什么' />
        </label>
        <label>
          详细描述
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder='背景、为什么找、希望对方帮什么忙——越具体越容易接上'
          />
        </label>
        <label>
          配图（可选，辅助说明）
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </label>

        <label>
          这条求助的可见性
          <div className='strength-group'>
            <button
              type='button'
              className={visibility === 'private' ? 'chip active' : 'chip'}
              onClick={() => setVisibility('private')}
            >
              🔒 私密
            </button>
            <button
              type='button'
              className={visibility === 'public' ? 'chip active' : 'chip'}
              onClick={() => setVisibility('public')}
            >
              👀 公开
            </button>
          </div>
        </label>
        <p className='hint'>
          {visibility === 'private'
            ? '私密：每个接力者只看到与自己直接相连的人；达成后联系方式沿链条逐级回传，不直达你。更保护隐私。'
            : '公开：接力者能看到完整链路，达成后所有参与者都看得到链条；目标信息直达你。传播更顺、透明度更高。'}
        </p>

        <label>
          求助性质
          <div className='strength-group'>
            <button
              type='button'
              className={rewardType === 'friendship' ? 'chip active' : 'chip'}
              onClick={() => setRewardType('friendship')}
            >
              友情帮助
            </button>
            <button
              type='button'
              className={rewardType === 'paid' ? 'chip active' : 'chip'}
              onClick={() => setRewardType('paid')}
            >
              有偿请求
            </button>
          </div>
        </label>
        <label>
          附言说明（可选，接力者都会看到）
          <input
            value={rewardNote}
            onChange={(e) => setRewardNote(e.target.value)}
            placeholder={rewardType === 'paid' ? '例如：成功引荐酬谢 XXX' : '例如：只是想认识、聊聊，绝不打扰'}
          />
        </label>

        <label>
          终止条件 · 匹配到几条就停（可选）
          <input
            type='number'
            min='1'
            value={matchCount}
            onChange={(e) => setMatchCount(e.target.value)}
            placeholder='留空表示不限数量'
          />
        </label>
        <label>
          终止条件 · 截止时间（可选）
          <select value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)}>
            <option value=''>不限时间</option>
            <option value='3'>3 天后</option>
            <option value='7'>7 天后</option>
            <option value='14'>14 天后</option>
            <option value='30'>30 天后</option>
          </select>
        </label>
        <p className='hint'>两个条件任一达到即停止接力；都留空则一直开放，直到你以后手动关闭。达成多条时为你推荐最优前 {matchCount || 3} 条。</p>

        {error && <p className='error'>{error}</p>}
        <button className='primary' disabled={busy} onClick={submit}>
          {busy ? '创建中…' : '创建并获取分享链接'}
        </button>
      </div>
      <SiteFooter />
    </main>
  );
}
