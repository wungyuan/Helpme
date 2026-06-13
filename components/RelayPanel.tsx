'use client';

// 接力着陆页的操作面板：接力转发 / 认领（我能搭上这个忙）
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getClientToken, getSavedNickname, saveNickname } from '@/lib/clientToken';
import { buildShareText } from '@/lib/share';
import CopyButton from './CopyButton';

type Mode = 'idle' | 'relay' | 'claim';

interface Props {
  nodeId: string;
  title: string;
  visibility: 'private' | 'public';
  rewardType: 'paid' | 'friendship';
}

export default function RelayPanel({ nodeId, title, visibility, rewardType }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [nickname, setNickname] = useState('');
  const [strength, setStrength] = useState(2);
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newNodeId, setNewNodeId] = useState('');
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    // 从 localStorage 恢复昵称只能在客户端 effect 中做，否则 SSR 水合不一致
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNickname(getSavedNickname());
  }, []);

  async function submitRelay() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentNodeId: nodeId,
          visitorToken: getClientToken(),
          nickname,
          relationStrength: strength,
          forwardNote: note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '提交失败');
      saveNickname(nickname);
      setNewNodeId(data.nodeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentNodeId: nodeId,
          visitorToken: getClientToken(),
          nickname,
          relationStrength: strength,
          contact,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '提交失败');
      saveNickname(nickname);
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  // 接力成功：给出可直接转发的微信文案 + 自己的进展入口
  if (newNodeId) {
    const shareUrl = `${location.origin}/r/${newNodeId}`;
    const shareText = buildShareText({ title, url: shareUrl, rewardType, asOriginator: false });
    return (
      <div className='panel success'>
        <h3>🎉 你已经接上这一棒！</h3>
        <p>把下面这段话整段复制，发给你觉得“可能认识”的朋友或群——你不必认识当事人，传下去就好：</p>
        <pre className='share-text'>{shareText}</pre>
        <CopyButton className='primary' text={shareText}>
          复制这段话去转发
        </CopyButton>
        <p className='hint'>
          想随时看看你这一棒传到哪了？<Link href={`/me/${newNodeId}`}>查看我的接力进展</Link>
        </p>
        <p className='hint'>
          自己也有想找的人？<Link href='/new'>发起我自己的求助 →</Link>
        </p>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className='panel success'>
        <h3>✅ 收到，你的回应已送出！</h3>
        <p>
          {visibility === 'private'
            ? '你的联系方式只会回传给把这条求助转给你的人（你的直接上一跳），由 TA 逐级转达，不会公开、也不会直接给到发起人之外的人。'
            : '你的联系方式只有发起人能看到，链条上其他人只会知道“已经有人能帮上忙”。'}
        </p>
        <p className='hint'>
          自己也有想找的人？<Link href='/new'>发起我自己的求助 →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className='panel'>
      {/* 隐私提示：在动手前先告诉接力者什么可见、什么不可见 */}
      <div className='privacy-note'>
        {visibility === 'private' ? (
          <>
            🔒 <strong>私密接力</strong>：你只看得到把求助转给你的那个人，看不到更上游是谁；你转发后，只有你自己能查看你这一棒的进展。
          </>
        ) : (
          <>
            👀 <strong>公开接力</strong>：参与者能看到完整的接力路径，达成后大家都看得到这条链是怎么连成的；但联系方式始终不公开。
          </>
        )}
      </div>

      {mode === 'idle' && (
        <div className='actions'>
          <button className='primary' onClick={() => setMode('relay')}>
            我帮你传出去（接力转发）
          </button>
          <button onClick={() => setMode('claim')}>这事我能搭上忙</button>
        </div>
      )}

      {mode !== 'idle' && (
        <div className='form'>
          <label>
            你的昵称
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder='让链条上的人认得你' />
          </label>
          <label>
            你和转发给你的人是什么关系？
            <div className='strength-group'>
              {[
                { v: 3, t: '很熟（强）' },
                { v: 2, t: '认识（中）' },
                { v: 1, t: '不太熟（弱）' },
              ].map((o) => (
                <button
                  key={o.v}
                  type='button'
                  className={strength === o.v ? 'chip active' : 'chip'}
                  onClick={() => setStrength(o.v)}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </label>

          {mode === 'relay' && (
            <label>
              转发理由（可选）
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder='例如：我同学在这个领域' />
            </label>
          )}

          {mode === 'claim' && (
            <>
              <label>
                联系方式
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder='微信号 / 手机号' />
              </label>
              <p className='privacy-note small'>
                {visibility === 'private'
                  ? '🔒 你的联系方式只回传给把求助转给你的人，不直达发起人、不公开。'
                  : '🔒 你的联系方式只有发起人能看到，不会公开给链条上其他人。'}
              </p>
              <label>
                给对方留句话（可选）
                <input value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
            </>
          )}

          {error && <p className='error'>{error}</p>}
          <div className='actions'>
            <button
              className='primary'
              disabled={busy}
              onClick={mode === 'relay' ? submitRelay : submitClaim}
            >
              {busy ? '提交中…' : mode === 'relay' ? '生成我的接力链接' : '提交'}
            </button>
            <button onClick={() => setMode('idle')}>返回</button>
          </div>
        </div>
      )}
    </div>
  );
}
