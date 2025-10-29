import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>CHESS TACTICS QUEST</h1>
      <p style={{ marginTop: 0, color: '#64748b' }}>繧ｷ繝ｳ繝励Ν縺ｪ繝√ぉ繧ｹ繧ｿ繧ｯ邱ｴ鄙堤畑繧｢繝励Μ</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <a href="#/select">
          <button>縺ｯ縺倥ａ繧具ｼ磯屮譏灘ｺｦ繧帝∈縺ｶ・・/button>
        </a>
        <a href="#/admin">
          <button>邂｡逅・判髱｢</button>
        </a>
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>縺ゅ◎縺ｳ縺九◆</h2>
        <ul>
          <li>繝帙・繝縺ｧ縲後・縺倥ａ繧九阪°繧蛾屮譏灘ｺｦ繧帝∈謚・/li>
          <li>蝠城｡後・繝ｼ繧ｸ縺ｧ謖・＠謇九ｒ驕ｸ縺ｳ縲∵ｭ｣隗｣繧帝㍾縺ｭ繧医≧</li>
          <li>騾｣邯壹け繝ｪ繧｢謨ｰ縺ｯ繝ｭ繝ｼ繧ｫ繝ｫ縺ｫ菫晏ｭ倥＆繧後∪縺・/li>
        </ul>
      </section>
    </div>
  );
}

