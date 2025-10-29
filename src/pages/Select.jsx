import React, { useEffect, useMemo, useState } from 'react';

const DIFFICULTY_KEY = 'selectedDifficulty';

function setDifficultyAndStart(levelId) {
  try {
    window.localStorage.setItem(DIFFICULTY_KEY, String(levelId));
  } catch {}
  window.location.hash = '#/play';
}

export default function Select() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch('/problems.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('failed to load problems.json');
        const data = await res.json();
        if (!canceled) {
          setLevels(Array.isArray(data.levels) ? data.levels : []);
        }
      } catch (e) {
        if (!canceled) setError(String(e.message || e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  const content = useMemo(() => {
    if (loading) return <p style={{ color: '#64748b' }}>読み込み中…</p>;
    if (error) return <p style={{ color: '#ef4444' }}>難易度リストの読み込みに失敗しました</p>;
    if (!levels.length) return <p style={{ color: '#64748b' }}>利用可能な難易度がありません</p>;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 16 }}>
        {levels.map((lv) => (
          <button key={`level-${lv.id}`} onClick={() => setDifficultyAndStart(lv.id)}>
            {lv.label || `Level ${lv.id}`}
          </button>
        ))}
      </div>
    );
  }, [error, levels, loading]);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>難易度を選ぶ</h1>
      <p style={{ color: '#64748b', marginTop: 0 }}>あとから変更もできます（ローカル保存）</p>
      {content}
      <div style={{ marginTop: 24 }}>
        <a href="#/"><button>ホームへ戻る</button></a>
      </div>
    </div>
  );
}
