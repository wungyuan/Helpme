'use client';

// 接力着陆页的操作面板：接力转发 / 认领（我是目标·我能帮）
import { useEffect, useState } from 'react';
import { getClientToken, getSavedNickname, saveNickname } from '@/lib/clientToken';

type Mode = 'idle' | 'relay' | 'claim';

interface Props {
  nodeId: string;
  requestType: 'direct' | 'resource';
}

export default function RelayPanel({ nodeId, requestType }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [nickname, setNickname] = useState('');
  const [strength, setStrength] = useState(2);
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
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
      setShareUrl(`${location.origin}/r/${data.nodeId}`);
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
          claimType: requestType === 'direct' ? 'is_target' : 'can_help',
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

  if (shareUrl) {
    return (
      <div className='panel success'>
        <h3>你已加入接力链</h3>
        <p>把下面这个链接转发给你认识的、更接近目标的人：</p>
        <p className='share-url'>{shareUrl}</p>
        <button onClick={() => navigator.clipboard.writeText(shareUrl)}>复制链接</button>
        <p className='hint'>在微信里直接把链接粘贴给好友或群即可。</p>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className='panel success'>
        <h3>认领成功</h3>
        <p>发起人会看到完整的接力链条和你的联系方式，请留意对方与你联系。</p>
      </div>
    );
  }

  return (
    <div className='panel'>
      {mode === 'idle' && (
        <div className='actions'>
          <button className='primary' onClick={() => setMode('relay')}>
            我认识更合适的人，接力转发
          </button>
          <button onClick={() => setMode('claim')}>
            {requestType === 'direct' ? '我就是要找的人' : '我能帮上忙'}
          </button>
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
                联系方式（仅发起人可见）
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder='微信号 / 手机号' />
              </label>
              <label>
                给发起人留言（可选）
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
              {busy ? '提交中…' : mode === 'relay' ? '生成我的接力链接' : '提交认领'}
            </button>
            <button onClick={() => setMode('idle')}>返回</button>
          </div>
        </div>
      )}
    </div>
  );
}
