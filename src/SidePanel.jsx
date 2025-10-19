import React from "react";

export function SidePanel({
  character,
  currentPuzzle,
  difficultyValue,
  difficultyStars,
  message,
  formattedHistory,
}) {
  return (
    <aside className="card side">
      <div className="character">
        <div className="character__badge">
          {character.iconImage ? (
            <img
              src={character.iconImage}
              alt={`${character.name}のアイコン`}
              className="character__badge-image"
            />
          ) : (
            <span>{character.badge}</span>
          )}
        </div>
        <div className="character__meta">
          <div className="character__name">{character.name}</div>
          <div className="character__title">{character.title}</div>
          <div className="character__puzzle">{currentPuzzle.title}</div>
          {difficultyStars ? (
            <div className="character__difficulty" aria-label={`難易度 ${difficultyValue}`}>
              <span className="character__difficulty-label">問題難易度：</span>
              <span className="character__difficulty-stars">{difficultyStars}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="speech">
        <p>{message}</p>
      </div>
      <div className="history-panel">
        <h3>これまでの手順</h3>
        {formattedHistory.length === 0 ? (
          <p className="history-panel__empty">まだ指し手はありません。</p>
        ) : (
          <ol className="history-list">
            {formattedHistory.map((entry) => (
              <li key={`move-${entry.moveNumber}-${entry.ellipsis ? "ellipsis" : "normal"}-${entry.white ?? "none"}-${entry.black ?? "none"}`} className="history-move">
                <span className="history-move__number">
                  {entry.moveNumber}
                  {entry.ellipsis ? "..." : "."}
                </span>
                {entry.white ? (
                  <span className="history-move__white">{entry.white}</span>
                ) : null}
                {entry.black ? (
                  <span className={`history-move__black ${entry.white ? "" : "history-move__black--solo"}`}>
                    {entry.white ? `… ${entry.black}` : entry.black}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}