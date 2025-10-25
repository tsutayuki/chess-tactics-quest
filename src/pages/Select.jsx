import React from 'react';

const DIFFICULTY_KEY = 'selectedDifficulty';

function setDifficultyAndStart(level) {
  try {
    window.localStorage.setItem(DIFFICULTY_KEY, String(level));
  } catch {}
  window.location.hash = '#/play';
}

export default function Select() {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>難易度を選択</h1>
      <p style={{ color: '#64748b', marginTop: 0 }}>あとから変更もできます（ローカル保存）。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 16 }}>
        <button onClick={() => setDifficultyAndStart(1)}>かんたん（★1）</button>
        <button onClick={() => setDifficultyAndStart(2)}>ふつう（★2）</button>
        <button onClick={() => setDifficultyAndStart(3)}>むずかしい（★3）</button>
      </div>

      <div style={{ marginTop: 24 }}>
        <a href="#/">
          <button>← ホームへ戻る</button>
        </a>
      </div>
    </div>
  );
}

