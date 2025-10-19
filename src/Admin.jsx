import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { alphaPieces } from "./alphaPaths";
import charactersData from "./data/characters.js";

const BOARD_SIZE = 480;
const PIECE_SCALE = 0.85;
const FILES_WHITE = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS_WHITE = [8, 7, 6, 5, 4, 3, 2, 1];
const PIECE_TYPES = ["K", "Q", "R", "B", "N", "P"];

const INITIAL_DRAG_STATE = {
  active: false,
  piece: null,
  origin: null,
  fromPalette: false,
  x: 0,
  y: 0,
};

const FALLBACK_DIALOGUE = {
  intro: "",
  mid: "",
  success: "",
  fail: "",
  retry: "",
};

const FALLBACK_PUZZLE = {
  id: 1,
  title: "空の盤面サンプル",
  fen: "6k1/8/8/8/8/8/8/6K1 w - - 0 1",
  side: "white",
  characterId: charactersData[0]?.id ?? 1,
  difficulty: 1,
  dialogue: { ...FALLBACK_DIALOGUE },
};

const CHARACTER_MAP = charactersData.reduce((acc, raw) => {
  acc[raw.id] = {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    badge: raw.badge || (raw.name ? raw.name.slice(0, 2).toUpperCase() : "??"),
    theme: raw.theme || "#f59e0b",
    accent: raw.accent || "rgba(245,158,11,0.12)",
    iconImage: raw.iconImage ?? null,
    cutinImage: raw.cutinImage ?? null,
  };
  return acc;
}, {});

function piecesFromFen(fen) {
  const game = new Chess(fen);
  return boardFromChess(game);
}

function boardFromChess(game) {
  const board = {};
  const raw = game.board();
  raw.forEach((row) => {
    row.forEach((cell) => {
      if (!cell) return;
      const label = cell.color === "w" ? "w" + cell.type.toUpperCase() : "b" + cell.type.toUpperCase();
      board[cell.square] = label;
    });
  });
  return board;
}

function piecesToFen(pieces, side) {
  const rows = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = "";
    let empty = 0;
    for (let fileIdx = 0; fileIdx < 8; fileIdx += 1) {
      const sq = `${"abcdefgh"[fileIdx]}${rank}`;
      const piece = pieces[sq];
      if (!piece) {
        empty += 1;
      } else {
        if (empty > 0) {
          row += empty;
          empty = 0;
        }
        const symbol = piece[0] === "w" ? piece[1] : piece[1].toLowerCase();
        row += symbol;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  const turn = side === "black" ? "b" : "w";
  return `${rows.join("/")} ${turn} - - 0 1`;
}

function PieceImage({ piece }) {
  if (!piece) return null;
  const color = piece[0] === "w" ? "white" : "black";
  const key = piece[1];
  const data = alphaPieces[color]?.[key];
  if (!data) return null;
  const viewBox = data.viewBox || "0 0 2048 2048";
  return (
    <svg className="admin-piece-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false" aria-hidden="true">
      {data.elements.map((el, idx) => {
        const { type, attrs = {} } = el;
        const svgProps = Object.entries(attrs).reduce((acc, [attrKey, attrValue]) => {
          const prop = attrKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          acc[prop] = attrValue;
          return acc;
        }, {});
        switch (type) {
          case "path":
            return <path key={idx} {...svgProps} />;
          case "circle":
            return <circle key={idx} {...svgProps} />;
          case "rect":
            return <rect key={idx} {...svgProps} />;
          case "ellipse":
            return <ellipse key={idx} {...svgProps} />;
          case "polygon":
            return <polygon key={idx} {...svgProps} />;
          case "polyline":
            return <polyline key={idx} {...svgProps} />;
          default:
            return null;
        }
      })}
    </svg>
  );
}

function Square({ sq, piece, dark, selected, highlight, onPointerDown, onClick }) {
  return (
    <button
      type="button"
      className={`admin-sq ${dark ? "admin-sq--dark" : ""} ${selected ? "admin-sq--selected" : ""} ${highlight ? "admin-sq--highlight" : ""}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {piece ? (
        <span className="admin-piece">
          <PieceImage piece={piece} />
        </span>
      ) : null}
    </button>
  );
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Admin() {
  const [puzzle, setPuzzle] = useState(FALLBACK_PUZZLE);
  const [turns, setTurns] = useState([]);
  const [recordMode, setRecordMode] = useState("player");
  const [message, setMessage] = useState("");
  const [fenInput, setFenInput] = useState(FALLBACK_PUZZLE.fen);
  const [mode, setMode] = useState("setup");
  const [setupPieces, setSetupPieces] = useState({});
  const [boardPieces, setBoardPieces] = useState({});
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const chessRef = useRef(new Chess(FALLBACK_PUZZLE.fen));
  const boardRef = useRef(null);
  const [dragState, setDragState] = useState(INITIAL_DRAG_STATE);
  const [orientation, setOrientation] = useState("white");

  const displayFiles = useMemo(
    () => (orientation === "white" ? FILES_WHITE : [...FILES_WHITE].reverse()),
    [orientation],
  );
  const displayRanks = useMemo(
    () => (orientation === "white" ? RANKS_WHITE : [...RANKS_WHITE].reverse()),
    [orientation],
  );

  const squares = useMemo(() => {
    const list = [];
    for (const rank of displayRanks) {
      for (const file of displayFiles) {
        list.push(`${file}${rank}`);
      }
    }
    return list;
  }, [displayFiles, displayRanks]);

  const character = CHARACTER_MAP[puzzle.characterId] || CHARACTER_MAP[charactersData[0]?.id];

  const applySetupUpdate = useCallback((updater) => {
    setSetupPieces((prevPieces) => {
      const nextPieces = typeof updater === "function" ? updater(prevPieces) : updater;
      setPuzzle((prevPuzzle) => {
        const fen = piecesToFen(nextPieces, prevPuzzle.side);
        setFenInput(fen);
        return { ...prevPuzzle, fen };
      });
      if (mode === "setup") {
        setBoardPieces(nextPieces);
      }
      return nextPieces;
    });
  }, [mode]);

  const startDrag = useCallback((event, piece, fromPalette, origin = null) => {
    if (mode !== "setup") return;
    event.preventDefault();
    setDragState({
      active: true,
      piece,
      origin,
      fromPalette,
      x: event.clientX,
      y: event.clientY,
    });
  }, [mode]);

  const finalizeDrag = useCallback((event) => {
    if (!dragState.active) return;
    const boardRect = boardRef.current?.getBoundingClientRect();
    let targetSquare = null;
    if (boardRect) {
      const withinX = event.clientX >= boardRect.left && event.clientX <= boardRect.right;
      const withinY = event.clientY >= boardRect.top && event.clientY <= boardRect.bottom;
      if (withinX && withinY) {
        const squareSize = boardRect.width / 8;
        const fileIndex = Math.floor((event.clientX - boardRect.left) / squareSize);
        const rankIndex = Math.floor((event.clientY - boardRect.top) / squareSize);
        const file = displayFiles[fileIndex];
        const rank = displayRanks[rankIndex];
        if (file && rank) {
          targetSquare = `${file}${rank}`;
        }
      }
    }

    if (targetSquare) {
      applySetupUpdate((prev) => {
        const next = { ...prev };
        if (!dragState.fromPalette && dragState.origin) {
          delete next[dragState.origin];
        }
        next[targetSquare] = dragState.piece;
        return next;
      });
      setMessage(`${targetSquare} に配置しました。`);
    } else if (!dragState.fromPalette && dragState.origin) {
      applySetupUpdate((prev) => {
        const next = { ...prev };
        delete next[dragState.origin];
        return next;
      });
      setMessage("駒を削除しました。");
    } else {
      setMessage("ドロップをキャンセルしました。");
    }
    setDragState(INITIAL_DRAG_STATE);
  }, [applySetupUpdate, dragState, displayFiles, displayRanks]);

  useEffect(() => {
    if (!dragState.active) return undefined;
    const handleMove = (event) => {
      setDragState((prev) => ({ ...prev, x: event.clientX, y: event.clientY }));
    };
    const handleUp = (event) => {
      finalizeDrag(event);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, finalizeDrag]);

  useEffect(() => {
    if (mode === "setup") {
      setBoardPieces(setupPieces);
      setSelected(null);
      setLegalTargets([]);
    }
  }, [mode, setupPieces]);

  const handlePuzzleField = (field) => (event) => {
    const value = event.target.value;
    if (field === "side") {
      setPuzzle((prev) => {
        const next = { ...prev, side: value };
        const fen = piecesToFen(setupPieces, value);
        next.fen = fen;
        setFenInput(fen);
        return next;
      });
    } else {
      setPuzzle((prev) => ({
        ...prev,
        [field]: field === "id" || field === "characterId" ? Number(value) : value,
      }));
    }
  };

  const handleDialogueField = (field) => (event) => {
    const value = event.target.value;
    setPuzzle((prev) => ({
      ...prev,
      dialogue: {
        ...prev.dialogue,
        [field]: value,
      },
    }));
  };

  const handleDifficultyChange = (event) => {
    const value = Number(event.target.value);
    setPuzzle((prev) => ({
      ...prev,
      difficulty: value,
    }));
  };

  const applyFen = useCallback(() => {
    try {
      const game = new Chess(fenInput);
      const pieces = boardFromChess(game);
      const side = fenInput.split(" ")[1] === "b" ? "black" : "white";
      chessRef.current = game;
      setPuzzle((prev) => ({
        ...prev,
        fen: game.fen(),
        side,
      }));
      setFenInput(game.fen());
      setSetupPieces(pieces);
      setBoardPieces(pieces);
      setMode("setup");
      setTurns([]);
      setRecordMode("player");
      setSelected(null);
      setLegalTargets([]);
      setMessage("FEN を読み込みました。セットアップモードに戻りました。");
    } catch (error) {
      setMessage(`FEN の読み込みに失敗しました: ${error.message}`);
    }
  }, [fenInput]);

  const resetBoardToInitial = useCallback(() => {
    const game = new Chess();
    game.clear();
    const emptyPieces = {};
    const emptyFen = game.fen();
    chessRef.current = game;
    setSetupPieces(emptyPieces);
    setBoardPieces(emptyPieces);
    setPuzzle((prev) => ({ ...prev, fen: emptyFen, side: "white" }));
    setFenInput(emptyFen);
    setMode("setup");
    setTurns([]);
    setRecordMode("player");
    setSelected(null);
    setLegalTargets([]);
    setMessage("盤面を初期状態に戻しました。");
  }, [puzzle.fen]);

  const clearTurns = useCallback(() => {
    setTurns([]);
    setRecordMode("player");
    setSelected(null);
    setLegalTargets([]);
    chessRef.current = new Chess(puzzle.fen);
    setBoardPieces(boardFromChess(chessRef.current));
    setMessage("記録した手順をクリアしました。");
  }, [puzzle.fen]);

  const commitSetupToPuzzle = useCallback(() => {
    const fen = piecesToFen(setupPieces, puzzle.side);
    try {
      const game = new Chess(fen);
      chessRef.current = game;
      setPuzzle((prev) => ({ ...prev, fen }));
      setFenInput(fen);
      const board = boardFromChess(game);
      setBoardPieces(board);
      if (turns.length > 0) {
        setTurns([]);
        setRecordMode("player");
        setMessage("セットアップを変更したので手順をリセットしました。新しい盤面で手順を記録してください。");
      } else {
        setRecordMode("player");
        setMessage("手順記録モードに切り替えました。");
      }
      setMode("record");
      setSelected(null);
      setLegalTargets([]);
    } catch (error) {
      setMessage(`局面が不正です: ${error.message}`);
    }
  }, [setupPieces, puzzle.side, turns.length]);

  useEffect(() => {
    setOrientation(puzzle.side === "black" ? "black" : "white");
  }, [puzzle.side]);

  const returnToSetup = useCallback(() => {
    setMode("setup");
    setBoardPieces(setupPieces);
    setSelected(null);
    setLegalTargets([]);
    setRecordMode("player");
    setTurns([]);
    chessRef.current = new Chess(piecesToFen(setupPieces, puzzle.side));
    setMessage("セットアップモードに戻りました。");
  }, [setupPieces, puzzle.side]);

  const attemptMove = useCallback((from, to) => {
    if (mode !== "record") return false;
    const move = chessRef.current.move({ from, to, promotion: "q" });
    if (!move) {
      setMessage("その手は合法ではありません。");
      setSelected(null);
      setLegalTargets([]);
      return false;
    }

    if (recordMode === "player") {
      setTurns((prev) => ([
        ...prev,
        {
          player: {
            from: move.from,
            to: move.to,
            ...(move.promotion ? { promotion: move.promotion } : {}),
          },
          hint: "",
        },
      ]));
      setRecordMode("reply");
    } else {
      setTurns((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const last = { ...updated[updated.length - 1] };
        last.reply = {
          from: move.from,
          to: move.to,
          ...(move.promotion ? { promotion: move.promotion } : {}),
        };
        updated[updated.length - 1] = last;
        return updated;
      });
      setRecordMode("player");
    }

    setBoardPieces(boardFromChess(chessRef.current));
    setSelected(null);
    setLegalTargets([]);
    setMessage(`手を記録しました: ${move.san}`);
    return true;
  }, [mode, recordMode]);

  const handleSquarePointerDown = useCallback((event, sq) => {
    if (mode !== "setup") return;
    const piece = setupPieces[sq];
    if (!piece) return;
    startDrag(event, piece, false, sq);
  }, [mode, setupPieces, startDrag]);

  const handleSquareClick = useCallback((sq) => {
    if (mode !== "record") return;
    const game = chessRef.current;
    const piece = game.get(sq);

    if (!selected) {
      if (piece && piece.color === game.turn()) {
        setSelected(sq);
        const moves = game.moves({ square: sq, verbose: true });
        setLegalTargets(moves.map((m) => m.to));
      }
      return;
    }

    if (selected === sq) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    const selectedPiece = game.get(selected);
    if (piece && selectedPiece && piece.color === selectedPiece.color) {
      setSelected(sq);
      const moves = game.moves({ square: sq, verbose: true });
      setLegalTargets(moves.map((m) => m.to));
      return;
    }

    attemptMove(selected, sq);
  }, [attemptMove, mode, selected]);

  const handleUndo = useCallback(() => {
    const undone = chessRef.current.undo();
    if (!undone) {
      setMessage("戻す手がありません。");
      return;
    }
    setBoardPieces(boardFromChess(chessRef.current));
    setSelected(null);
    setLegalTargets([]);
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last.reply) {
        const { reply, ...rest } = last;
        updated[updated.length - 1] = rest;
        setRecordMode("reply");
      } else {
        updated.pop();
        setRecordMode("player");
      }
      return updated;
    });
    setMessage("直前の手を取り消しました。");
  }, []);

  const handleTurnHintChange = (index, value) => {
    setTurns((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        hint: value,
      };
      return updated;
    });
  };

  const removeReplyFromTurn = (index) => {
    setTurns((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      if (target.reply) {
        delete target.reply;
        updated[index] = target;
      }
      return updated;
    });
    setMessage("自動応手を削除しました。");
  };

  const removeTurn = (index) => {
    setTurns((prev) => prev.filter((_, idx) => idx !== index));
    setMessage("該当のターンを削除しました。盤面は必要に応じて手動で戻してください。");
  };

  const handleDownload = () => {
    const payload = {
      id: Number(puzzle.id),
      title: puzzle.title,
      fen: puzzle.fen,
      side: puzzle.side,
      characterId: Number(puzzle.characterId),
      difficulty: Number(puzzle.difficulty),
      dialogue: {
        ...FALLBACK_DIALOGUE,
        ...puzzle.dialogue,
      },
      turns: turns.map((turn) => {
        const base = {
          player: turn.player,
          hint: turn.hint || "",
        };
        if (turn.reply) {
          base.reply = turn.reply;
        }
        return base;
      }),
    };
    downloadJson(`${String(payload.id).padStart(2, "0")}.json`, payload);
    setMessage("JSON をダウンロードしました。");
  };

  const palettePieces = useMemo(() => (
    [
      { label: "White", color: "w" },
      { label: "Black", color: "b" },
    ].map(({ label, color }) => ({ label, color, pieces: PIECE_TYPES.map((type) => color + type) }))
  ), []);

  const currentModeLabel = mode === "setup" ? "セットアップモード" : "手順記録モード";

  return (
    <div className="admin-page">
      <style>{ADMIN_STYLES}</style>
      <header className="admin-header">
        <h1>CHESS TACTICS QUEST : 管理者ツール</h1>
        <p>盤面セットアップと手順記録を GUI で行い、問題 JSON を生成できます。</p>
      </header>
      <main className="admin-layout">
        <section className="admin-panel admin-panel--board">
          <div className="admin-mode-toggle">
            <span>現在: {currentModeLabel}</span>
            <div className="admin-mode-actions">
              <button type="button" onClick={() => setOrientation((prev) => (prev === "white" ? "black" : "white"))}>盤面反転</button>
              {mode === "setup" ? (
                <button type="button" onClick={commitSetupToPuzzle}>手順記録モードへ</button>
              ) : (
                <button type="button" onClick={returnToSetup}>セットアップモードに戻る</button>
              )}
            </div>
          </div>

          <div className="admin-board-meta">
            <label>
              問題 ID
              <input type="number" min="1" value={puzzle.id} onChange={handlePuzzleField("id")} />
            </label>
            <label>
              タイトル
              <input type="text" value={puzzle.title} onChange={handlePuzzleField("title")} placeholder="例: バックランク・スナイプ" />
            </label>
            <label>
              初期 FEN
              <textarea value={fenInput} onChange={(event) => setFenInput(event.target.value)} rows={2} />
            </label>
            <div className="admin-fen-actions">
              <button type="button" onClick={applyFen}>FEN を適用</button>
              <button type="button" onClick={resetBoardToInitial}>盤面を初期状態に戻す</button>
              <button type="button" onClick={clearTurns}>手順データをクリア</button>
            </div>
          </div>

          <div className="admin-board-wrapper">
            <div className="admin-palette admin-palette--side">
              <h3>ピースパレット</h3>
              <div className="admin-palette-grid">
                {palettePieces.map(({ label, color, pieces }) => (
                  <div key={color} className="admin-palette-column">
                    <span className="admin-palette-label">{label}</span>
                    <div className="admin-palette-row admin-palette-row--vertical">
                      {pieces.map((pieceCode) => (
                        <button
                          key={pieceCode}
                          type="button"
                          className="admin-palette-piece"
                          onPointerDown={(event) => startDrag(event, pieceCode, true)}
                        >
                          <PieceImage piece={pieceCode} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="admin-palette-tip">ドラッグして盤面に配置 / 盤面外で削除</p>
            </div>
            <div className="admin-board-shell">
              <div className="admin-board-files admin-board-files--top">
                {displayFiles.map((file) => <span key={`top-${file}`}>{file}</span>)}
              </div>
              <div className="admin-board-body">
                <div className="admin-board-ranks admin-board-ranks--left">
                  {displayRanks.map((rank) => <span key={`left-${rank}`}>{rank}</span>)}
                </div>
                <div className="admin-board" ref={boardRef}>
                  {squares.map((sq, idx) => {
                    const fileIdx = idx % 8;
                    const rankIdx = Math.floor(idx / 8);
                    const dark = (fileIdx + rankIdx) % 2 === 1;
                    const activePieces = mode === "setup" ? setupPieces : boardPieces;
                    const piece = activePieces[sq];
                    const hidePiece = mode === "setup" && dragState.active && dragState.origin === sq;
                    const displayPiece = hidePiece ? null : piece;
                    const isSelected = mode === "record" && selected === sq;
                    const isHighlight = mode === "record" && legalTargets.includes(sq);
                    return (
                      <Square
                        key={sq}
                        sq={sq}
                        piece={displayPiece}
                        dark={dark}
                        selected={isSelected}
                        highlight={isHighlight}
                        onPointerDown={mode === "setup" ? (event) => handleSquarePointerDown(event, sq) : undefined}
                        onClick={mode === "record" ? () => handleSquareClick(sq) : undefined}
                      />
                    );
                  })}
                </div>
                <div className="admin-board-ranks admin-board-ranks--right">
                  {displayRanks.map((rank) => <span key={`right-${rank}`}>{rank}</span>)}
                </div>
              </div>
              {dragState.active ? (
                <div
                  className="admin-drag-piece"
                  style={{
                    width: `${(BOARD_SIZE / 8) * PIECE_SCALE}px`,
                    height: `${(BOARD_SIZE / 8) * PIECE_SCALE}px`,
                    left: `${dragState.x}px`,
                    top: `${dragState.y}px`,
                  }}
                >
                  <PieceImage piece={dragState.piece} />
                </div>
              ) : null}
              <div className="admin-board-files admin-board-files--bottom">
                {displayFiles.map((file) => <span key={`bottom-${file}`}>{file}</span>)}
              </div>
            </div>
          </div>

          {mode === "record" ? (
            <div className="admin-board-controls">
              <div className="admin-record-mode">
                <span>記録モード:</span>
                <button
                  type="button"
                  className={recordMode === "player" ? "is-active" : ""}
                  onClick={() => setRecordMode("player")}
                >
                  正解手
                </button>
                <button
                  type="button"
                  className={recordMode === "reply" ? "is-active" : ""}
                  onClick={() => {
                    if (turns.length === 0) {
                      setMessage("まずプレイヤーの手を記録してください。");
                      return;
                    }
                    setRecordMode("reply");
                    setMessage("次の1手は自動応手として記録されます。");
                  }}
                  disabled={turns.length === 0}
                >
                  自動応手
                </button>
              </div>
              <button type="button" onClick={handleUndo}>直前の手を取り消す</button>
            </div>
          ) : null}
        </section>

        <aside className="admin-panel admin-panel--meta">
          <div className="admin-meta-grid">
            <label>
              手番
              <select value={puzzle.side} onChange={handlePuzzleField("side")}>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </label>
            <label>
              キャラクター
              <select value={puzzle.characterId} onChange={handlePuzzleField("characterId")}>
                {charactersData.map((c) => (
                  <option key={c.id} value={c.id}>{`${c.id}: ${c.name}`}</option>
                ))}
              </select>
            </label>
            <label>
              難易度: {puzzle.difficulty}
              <input
                type="range"
                min="1"
                max="10"
                value={puzzle.difficulty}
                onChange={handleDifficultyChange}
              />
            </label>
          </div>

          <div className="admin-dialogue">
            <h2>セリフ設定</h2>
            {Object.keys(FALLBACK_DIALOGUE).map((field) => (
              <label key={field}>
                {field.toUpperCase()}
                <textarea
                  rows={2}
                  value={puzzle.dialogue[field] || ""}
                  onChange={handleDialogueField(field)}
                />
              </label>
            ))}
          </div>
        </aside>
      </main>

      <section className="admin-panel admin-panel--turns">
        <h2>記録済み手順 ({turns.length} 手)</h2>
        {turns.length === 0 ? (
          <p className="admin-empty">まだ手順は記録されていません。盤面で手を指すと追加されます。</p>
        ) : (
          <ol className="admin-turn-list">
            {turns.map((turn, index) => (
              <li key={`turn-${index}`}>
                <div className="admin-turn-entry">
                  <div className="admin-turn-meta">
                    <span className="admin-turn-label">正解手: {turn.player.from} → {turn.player.to}</span>
                    <div className="admin-turn-actions">
                      {turn.reply ? (
                        <>
                          <span className="admin-turn-label admin-turn-label--reply">自動応手: {turn.reply.from} → {turn.reply.to}</span>
                          <button type="button" onClick={() => removeReplyFromTurn(index)}>自動応手を削除</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (mode !== "record") {
                              setMessage("手順記録モードでのみ自動応手を追加できます。");
                              return;
                            }
                            setRecordMode("reply");
                            setMessage(`ターン ${index + 1} の自動応手を記録してください。`);
                          }}
                          disabled={mode !== "record"}
                        >
                          自動応手を追加
                        </button>
                      )}
                      <button type="button" onClick={() => removeTurn(index)}>ターンを削除</button>
                    </div>
                  </div>
                  <label>
                    ヒント
                    <textarea
                      rows={2}
                      value={turn.hint || ""}
                      onChange={(event) => handleTurnHintChange(index, event.target.value)}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="admin-footer">
        <button type="button" onClick={handleDownload} disabled={!puzzle.title || turns.length === 0}>
          JSON をダウンロード
        </button>
        {message ? <p className="admin-message">{message}</p> : null}
        <p className="admin-tip">
          ※ 出力した JSON は <code>src/data/puzzles/</code> に配置し、<code>index.js</code> に追記してください。
        </p>
      </footer>
    </div>
  );
}

const ADMIN_STYLES = `
.admin-page{padding:20px 24px;font-family:'Noto Sans JP',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;background:#f8fafc;min-height:100vh;box-sizing:border-box}
.admin-header{max-width:1080px;margin:0 auto 24px}
.admin-header h1{margin:0;font-size:28px;font-weight:800;color:#1d4ed8}
.admin-header p{margin:6px 0 0;font-size:14px;color:#475569}
.admin-layout{display:grid;grid-template-columns:1fr 320px;gap:24px;max-width:1080px;margin:0 auto 24px}
@media (max-width:1024px){.admin-layout{grid-template-columns:1fr}}
.admin-panel{background:#fff;border:1px solid rgba(15,23,42,0.08);border-radius:18px;padding:18px;box-shadow:0 10px 22px rgba(15,23,42,0.05)}
.admin-panel h2{margin:0 0 12px;font-size:18px;font-weight:700;color:#1f2937}
.admin-panel--board{display:flex;flex-direction:column;gap:18px}
.admin-mode-toggle{display:flex;align-items:center;justify-content:space-between;background:rgba(59,130,246,0.08);border-radius:12px;padding:10px 14px;font-size:13px;font-weight:600;color:#1d4ed8;gap:12px}
.admin-mode-actions{display:flex;gap:8px}
.admin-mode-actions button{padding:6px 14px;border-radius:999px;border:none;background:#1d4ed8;color:#fff;font-weight:700;cursor:pointer}
.admin-mode-actions button:hover{background:#1e40af}
.admin-board-meta label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#1f2937;margin-bottom:12px}
.admin-board-meta input,.admin-board-meta textarea{font-size:14px;padding:8px 10px;border:1px solid rgba(148,163,184,0.6);border-radius:10px}
.admin-fen-actions{display:flex;flex-wrap:wrap;gap:10px}
.admin-fen-actions button{padding:8px 14px;border-radius:10px;border:none;background:#1d4ed8;color:#fff;font-weight:600;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.admin-fen-actions button:hover{transform:translateY(-1px);box-shadow:0 8px 16px rgba(29,78,216,0.25)}
.admin-board-wrapper{display:flex;gap:18px;position:relative;align-items:flex-start;justify-content:center}
.admin-board-shell{display:flex;flex-direction:column;align-items:center;gap:8px;align-self:center}
.admin-board-body{display:flex;align-items:center;gap:8px}
.admin-board-ranks{display:flex;flex-direction:column;justify-content:space-between;height:${BOARD_SIZE}px;font-size:12px;font-weight:600;color:#475569}
.admin-board-ranks span{height:calc(${BOARD_SIZE}px / 8);display:flex;align-items:center;justify-content:center}
.admin-board-files{display:flex;justify-content:space-between;width:${BOARD_SIZE}px;font-size:12px;font-weight:600;color:#475569}
.admin-board-files span{width:calc(${BOARD_SIZE}px / 8);text-align:center}
.admin-board{width:${BOARD_SIZE}px;height:${BOARD_SIZE}px;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:16px;overflow:hidden;border:1px solid rgba(15,23,42,0.12);box-shadow:0 18px 34px rgba(15,23,42,0.15);background:#f8f9fc;margin:0 auto}
.admin-sq{position:relative;border:none;display:flex;align-items:center;justify-content:center;background:#f4eed2;cursor:pointer;padding:0;transition:background .12s ease}
.admin-sq--dark{background:#b08b65}
.admin-sq--selected::after{content:"";position:absolute;inset:5px;border:3px solid rgba(59,130,246,0.75);border-radius:10px;pointer-events:none}
.admin-sq--highlight::before{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:rgba(59,130,246,0.45);pointer-events:none}
.admin-piece{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.admin-piece-svg{width:100%;height:100%;filter:drop-shadow(0 3px 6px rgba(15,23,42,0.3))}
.admin-board-controls{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px;margin:18px auto 0;width:100%}
.admin-board-controls button{padding:8px 16px;border-radius:10px;border:1px solid rgba(59,130,246,0.35);background:#fff;color:#1d4ed8;font-weight:600;cursor:pointer}
.admin-board-controls button:hover{background:rgba(59,130,246,0.08)}
.admin-record-mode{display:flex;align-items:center;gap:10px}
.admin-record-mode span{font-size:12px;font-weight:700;color:#1f2937}
.admin-record-mode button{padding:6px 12px;border-radius:999px;border:1px solid rgba(148,163,184,0.6);background:#fff;font-weight:600;cursor:pointer}
.admin-record-mode button.is-active{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
.admin-help{margin:0;font-size:12px;color:#64748b}
.admin-palette{border:1px dashed rgba(148,163,184,0.4);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:12px;align-items:center;min-width:140px;background:#f8fafc}
.admin-palette--side{align-self:flex-start}
.admin-palette h3{margin:0;font-size:16px;font-weight:700;color:#1f2937}
.admin-palette-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.admin-palette-column{display:flex;flex-direction:column;gap:6px;align-items:center}
.admin-palette-label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase}
.admin-palette-row{display:flex;gap:6px}
.admin-palette-row--vertical{flex-direction:column}
.admin-palette-piece{width:72px;height:72px;border:none;border-radius:16px;background:#ffffff;box-shadow:0 6px 18px rgba(15,23,42,0.2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.admin-palette-piece:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(15,23,42,0.2)}
.admin-palette-piece .admin-piece-svg{width:90%;height:90%}
.admin-palette-tip{margin:0;font-size:11px;color:#64748b}
.admin-drag-piece{position:fixed;pointer-events:none;z-index:999;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%)}
.admin-panel--meta{display:flex;flex-direction:column;gap:18px}
.admin-meta-grid{display:grid;gap:12px}
.admin-meta-grid label{display:flex;flex-direction:column;font-size:12px;font-weight:600;color:#1f2937;gap:6px}
.admin-meta-grid select,.admin-meta-grid input[type=range]{padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,0.6);font-size:14px}
.admin-dialogue label{display:flex;flex-direction:column;font-size:12px;font-weight:600;color:#1f2937;margin-bottom:12px;gap:6px}
.admin-dialogue textarea{font-size:14px;padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,0.6);resize:vertical}
.admin-panel--turns{max-width:1080px;margin:0 auto 24px}
.admin-empty{font-size:13px;color:#64748b;font-style:italic}
.admin-turn-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:18px}
.admin-turn-entry{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid rgba(148,163,184,0.25);border-radius:12px;background:#f8fafc}
.admin-turn-meta{display:flex;flex-direction:column;gap:6px}
.admin-turn-label{font-weight:700;color:#0f172a}
.admin-turn-label--reply{color:#1d4ed8}
.admin-turn-actions{display:flex;flex-wrap:wrap;gap:10px}
.admin-turn-actions button{padding:6px 12px;border-radius:8px;border:1px solid rgba(59,130,246,0.35);background:#fff;color:#1d4ed8;font-weight:600;cursor:pointer}
.admin-turn-entry textarea{padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,0.6);font-size:14px}
.admin-footer{max-width:1080px;margin:0 auto;padding:18px 0;text-align:center;display:flex;flex-direction:column;gap:10px}
.admin-footer button{align-self:center;padding:10px 24px;border-radius:14px;border:none;background:#22c55e;color:#fff;font-weight:700;font-size:15px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.admin-footer button:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(34,197,94,0.3)}
.admin-footer button:disabled{background:#cbd5f5;color:#475569;cursor:not-allowed;box-shadow:none;transform:none}
.admin-message{margin:0;font-size:13px;color:#1f2937;font-weight:600;white-space:pre-line}
.admin-tip{margin:0;font-size:12px;color:#94a3b8}
`;

export default Admin;
