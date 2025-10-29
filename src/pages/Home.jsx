import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>CHESS TACTICS QUEST</h1>
      <p style={{ marginTop: 0, color: '#64748b' }}>シンプルなチェスタク練習用アプリ</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <a href="#/select">
          <button>はじめる（難易度を選ぶ�E�E/button>
        </a>
        <a href="#/admin">
          <button>管琁E��面</button>
        </a>
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>あそびかた</h2>
        <ul>
          <li>ホ�Eムで「�Eじめる」から難易度を選抁E/li>
          <li>問題�Eージで持E��手を選び、正解を重ねよう</li>
          <li>連続クリア数はローカルに保存されまぁE/li>
        </ul>
      </section>
    </div>
  );
}

