import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { alphaPieces } from "./alphaPaths";
import puzzles from "./data/puzzles";
import charactersData from "./data/characters.js";
import bgAurora from "../assets/images/background/2ecfef14-4dce-4a1e-959d-01e3c257fb38.png";
import siteLogo from "../assets/images/logo/logo.png";
import bgmTrack from "../assets/BGM/BGM1.mp3";
import seSuccess from "../assets/SE/success.mp3";
import seMistake from "../assets/SE/mistake.mp3";
import seCheck from "../assets/SE/check.mp3";
import seCapture from "../assets/SE/take.mp3";
import seMove from "../assets/SE/move.mp3";
import seBlocked from "../assets/SE/cannot_move.mp3";
import { SidePanel } from "./SidePanel.jsx";

const BOARD_SIZE = 560;
const PIECE_SCALE = 0.84;
const SQUARE_SIZE = BOARD_SIZE / 8;

const FILES_WHITE = ["a", "b", "c", "d", "e", "f", "g", "h"];
const FILES_BLACK = [...FILES_WHITE].reverse();
const RANKS_WHITE = [8, 7, 6, 5, 4, 3, 2, 1];
const RANKS_BLACK = [...RANKS_WHITE].reverse();

const PROGRESS_KEY = "tactics-progress";
const DIFFICULTY_KEY = "selectedDifficulty";

const SITE_TITLE = "CHESS TACTICS QUEST";

const DEFAULT_LINES = {
  intro: "よし、まずは肩慣らしにこのポジションを解いてみよう！",
  hint: "ヒントだよ。キングの位置とピンされている駒に注目してみて？",
  mid: "リズムはバッチリ！最後まで集中していこう！",
  success: "さすが！華麗なタクティクスだったね！",
  fail: "むむっ…もう一回集中してみようか！",
  retry: "もう一度配置を整えて挑戦してみよう！",
};

const clampVolume = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const FALLBACK_CHARACTER = {
  id: 0,
  name: "モデレーター",
  title: "CHESS TACTICE QUEST",
  badge: "CT",
  theme: "#f59e0b",
  accent: "rgba(245,158,11,0.12)",
  iconImage: null,
  cutinImage: null,
};

const CHARACTER_MAP = charactersData.reduce((acc, raw) => {
  acc[raw.id] = {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    badge: raw.badge || (raw.name ? raw.name.slice(0, 2).toUpperCase() : "??"),
    theme: raw.theme || FALLBACK_CHARACTER.theme,
    accent: raw.accent || FALLBACK_CHARACTER.accent,
    iconImage: raw.iconImage ?? null,
    cutinImage: raw.cutinImage ?? null,
  };
  return acc;
}, {});

function loadProgress() {
  if (typeof window === "undefined") return { solvedIds: [], streak: 0, bestStreak: 0 };
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { solvedIds: [], streak: 0, bestStreak: 0 };
    const parsed = JSON.parse(raw);
    return {
      solvedIds: Array.isArray(parsed.solvedIds) ? parsed.solvedIds : [],
      streak: Number.isFinite(parsed.streak) ? parsed.streak : 0,
      bestStreak: Number.isFinite(parsed.bestStreak) ? parsed.bestStreak : 0,
    };
  } catch {
    return { solvedIds: [], streak: 0, bestStreak: 0 };
  }
}

function saveProgress(progress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function getSelectedDifficulty() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DIFFICULTY_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function uciToMove(uci) {
  if (!uci || typeof uci !== 'string' || uci.length < 4) return null;
  const from = uci.slice(0, 2).toLowerCase();
  const to = uci.slice(2, 4).toLowerCase();
  const promo = uci.length >= 5 ? uci[4].toLowerCase() : undefined;
  return promo ? { from, to, promotion: promo } : { from, to };
}

function buildTurnsFromUciArray(arr) {
  const moves = Array.isArray(arr) ? arr : [];
  const out = [];
  for (let i = 0; i < moves.length; i += 2) {
    const player = uciToMove(moves[i]);
    if (!player) break;
    const reply = moves[i + 1] ? uciToMove(moves[i + 1]) : undefined;
    out.push({ player, ...(reply ? { reply } : null) });
  }
  return out;
}

function PieceIcon({ piece }) {
  if (!piece) return null;
  const color = piece === piece.toUpperCase() ? "white" : "black";
  const key = piece.toUpperCase();
  const data = alphaPieces[color]?.[key];
  if (!data) return null;

  const viewBox = data.viewBox || "0 0 2048 2048";
  const renderElement = (el, idx) => {
    const { type, attrs = {} } = el;
    const svgProps = Object.entries(attrs).reduce((acc, [key, value]) => {
      const prop = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      acc[prop] = value;
      return acc;
    }, {});

    if (color === "white") {
      svgProps.fill = svgProps.fill ?? "#ffffff";
      svgProps.stroke = svgProps.stroke ?? "#101010";
    } else {
      svgProps.fill = svgProps.fill ?? "#101010";
      svgProps.stroke = svgProps.stroke ?? "#f5f1e8";
    }

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
  };

  return (
    <svg className="piece-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false" aria-hidden="true">
      {data.elements.map(renderElement)}
    </svg>
  );
}

function Square({
  sq,
  piece,
  dark,
  selected,
  from,
  to,
  legal,
  capture,
  inCheck,
  isDragSource,
  isHover,
  isHint,
  canDrag,
  onClick,
  onPointerDown,
  disabled,
}) {
  return (
    <button
      type="button"
      className={`sq ${dark ? "sq--dark" : ""} ${selected ? "sq--sel" : ""} ${from || to ? "sq--last" : ""} ${isHint ? "sq--hint" : ""} ${inCheck ? "sq--check" : ""} ${isDragSource ? "sq--dragging" : ""} ${isHover ? "sq--hover" : ""} ${canDrag ? "sq--can-drag" : ""}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={sq}
      title={sq}
      disabled={disabled}
    >
      {legal && (
        <span className={`hint ${capture ? "hint--ring" : "hint--dot"}`} />
      )}
      <span className="piece-wrap">
        {piece ? <PieceIcon piece={piece} /> : null}
      </span>
    </button>
  );
}

export default function App() {
  const chessRef = useRef(new Chess());
  const [orientation, setOrientation] = useState("white");
  const [fen, setFen] = useState(chessRef.current.fen());
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState(new Map());
  const [hoverSquare, setHoverSquare] = useState(null);
  const [drag, setDrag] = useState({ active: false, from: null, piece: null, x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [hintSquares, setHintSquares] = useState([]);

  const [cutin, setCutin] = useState({ type: null, text: "", characterId: null, visible: false, pulse: 0 });
  const cutinTimerRef = useRef(null);
  const audioRef = useRef(null);
  const playbackHandlerRef = useRef(null);
  const seRef = useRef({});
  const [bgmVolume, setBgmVolume] = useState(0);
  const [cutinEnabled, setCutinEnabled] = useState(true);
  const [legalHintsEnabled, setLegalHintsEnabled] = useState(false);
  const [seVolume, setSeVolume] = useState(0.55);

  const [progress, setProgress] = useState(() => loadProgress());
  const streak = progress.streak ?? 0;
  const bestStreak = progress.bestStreak ?? 0;

  const [activeIndex, setActiveIndex] = useState(() => {
    const pref = getSelectedDifficulty();
    if (!pref) return 0;
    const idx = puzzles.findIndex((p) => Number(p.difficulty) === Number(pref));
    return idx >= 0 ? idx : 0;
  });
  const [runtimePuzzle, setRuntimePuzzle] = useState(null);
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("intro");
  const [message, setMessage] = useState(DEFAULT_LINES.intro);

  const dragMetaRef = useRef(null);

  const currentPuzzle = runtimePuzzle || puzzles[activeIndex];
  const character = CHARACTER_MAP[currentPuzzle.characterId] || FALLBACK_CHARACTER;
  const [initialTurn, setInitialTurn] = useState("w");

  const files = orientation === "white" ? FILES_WHITE : FILES_BLACK;
  const ranks = orientation === "white" ? RANKS_WHITE : RANKS_BLACK;

  const listSquares = useCallback(() => {
    const squareList = [];
    for (const rank of ranks) {
      for (const file of files) {
        squareList.push(`${file}${rank}`);
      }
    }
    return squareList;
  }, [files, ranks]);

  const squares = useMemo(() => listSquares(), [listSquares, fen]);

  const kingSquare = useCallback((color) => {
    const board = chessRef.current.board();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const piece = board[r][c];
        if (piece && piece.type === "k" && piece.color === (color === "white" ? "w" : "b")) {
          const file = String.fromCharCode(97 + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, []);

  const speak = useCallback((type) => {
    const line = currentPuzzle.dialogue?.[type] || DEFAULT_LINES[type] || "";
    setStatus(type);
    setMessage(line);
  }, [currentPuzzle]);

  const loadPuzzle = useCallback((index, speech = "intro") => {
    const puzzle = puzzles[index];
    setRuntimePuzzle(null);
    chessRef.current.load(puzzle.fen);
    setFen(chessRef.current.fen());
    setOrientation(puzzle.side === "black" ? "black" : "white");
    setInitialTurn(chessRef.current.turn());
    setSelected(null);
    setLegalMoves(new Map());
    setHoverSquare(null);
    setDrag({ active: false, from: null, piece: null, x: 0, y: 0, offsetX: 0, offsetY: 0 });
    setHintSquares([]);
    setHistory([]);
    setStep(0);
    setCutin({ type: null, text: "", characterId: null, visible: false, pulse: 0 });
    speak(speech);
  }, [speak]);

  const loadRuntime = useCallback((puzzle, speech = "intro") => {
    setRuntimePuzzle(puzzle);
    chessRef.current.load(puzzle.fen);
    setFen(chessRef.current.fen());
    const sideFromFen = (() => {
      try {
        const parts = String(puzzle.fen).split(" ");
        return parts[1] === "b" ? "black" : "white";
      } catch { return "white"; }
    })();
    setOrientation(puzzle.side || sideFromFen);
    setInitialTurn(chessRef.current.turn());
    setSelected(null);
    setLegalMoves(new Map());
    setHoverSquare(null);
    setDrag({ active: false, from: null, piece: null, x: 0, y: 0, offsetX: 0, offsetY: 0 });
    setHintSquares([]);
    setHistory([]);
    setStep(0);
    setCutin({ type: null, text: "", characterId: null, visible: false, pulse: 0 });
    speak(speech);
  }, [speak]);

  useEffect(() => {
    loadPuzzle(activeIndex, "intro");
  }, [activeIndex, loadPuzzle]);

  useEffect(() => {
    const audio = new Audio(bgmTrack);
    audio.loop = true;
    const initialVolume = clampVolume(bgmVolume);
    audio.volume = initialVolume;
    audio.muted = initialVolume <= 0;
    if (audio.muted) {
      audio.currentTime = 0;
      audio.pause();
    }
    audioRef.current = audio;

    const ensurePlayback = () => {
      const current = audioRef.current;
      if (!current || current.muted || current.volume <= 0) return;
      current.play().then(() => {
        window.removeEventListener("pointerdown", ensurePlayback);
        window.removeEventListener("keydown", ensurePlayback);
      }).catch(() => {});
    };

    playbackHandlerRef.current = ensurePlayback;
    ensurePlayback();
    window.addEventListener("pointerdown", ensurePlayback);
    window.addEventListener("keydown", ensurePlayback);

    return () => {
      window.removeEventListener("pointerdown", ensurePlayback);
      window.removeEventListener("keydown", ensurePlayback);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sounds = {
      success: new Audio(seSuccess),
      fail: new Audio(seMistake),
      check: new Audio(seCheck),
      capture: new Audio(seCapture),
      move: new Audio(seMove),
      blocked: new Audio(seBlocked),
    };
    Object.values(sounds).forEach((audio) => {
      audio.volume = 0.55;
    });
    seRef.current = sounds;
    return () => {
      Object.values(sounds).forEach((audio) => audio.pause());
      seRef.current = {};
    };
  }, []);

  useEffect(() => {
    const sounds = seRef.current;
    Object.values(sounds).forEach((audio) => {
      audio.volume = Math.max(0, Math.min(1, seVolume));
    });
  }, [seVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = clampVolume(bgmVolume);
    audio.volume = clamped;
    const isMuted = clamped <= 0;
    audio.muted = isMuted;
    if (isMuted) {
      audio.pause();
      audio.currentTime = 0;
    } else {
      audio.play().catch(() => {});
      const handler = playbackHandlerRef.current;
      if (handler) {
        window.removeEventListener("pointerdown", handler);
        window.removeEventListener("keydown", handler);
        window.addEventListener("pointerdown", handler);
        window.addEventListener("keydown", handler);
      }
    }
  }, [bgmVolume]);

  const playSe = useCallback((key) => {
    if (seVolume <= 0) return;
    const sounds = seRef.current;
    const audio = sounds?.[key];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // ignore playback issues
    }
  }, [seVolume]);

  const updateProgress = useCallback((updater) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const showCutin = useCallback((type) => {
    if (!cutinEnabled) return;
    const line = currentPuzzle.dialogue?.[type] || DEFAULT_LINES[type] || "";
    const nextCharacter = currentPuzzle.characterId || character.id;
    setCutin({
      type,
      text: line,
      characterId: nextCharacter,
      visible: true,
      pulse: Date.now(),
    });
  }, [character.id, currentPuzzle, cutinEnabled]);

  useEffect(() => {
    if (!cutin.visible) return undefined;
    if (cutinTimerRef.current) {
      clearTimeout(cutinTimerRef.current);
    }
    cutinTimerRef.current = setTimeout(() => {
      setCutin((prev) => ({ ...prev, visible: false }));
      cutinTimerRef.current = null;
    }, cutin.type === "success" ? 1700 : 1400);
    return () => {
      if (cutinTimerRef.current) {
        clearTimeout(cutinTimerRef.current);
        cutinTimerRef.current = null;
      }
    };
  }, [cutin.type, cutin.visible]);

  useEffect(() => () => {
    if (cutinTimerRef.current) {
      clearTimeout(cutinTimerRef.current);
      cutinTimerRef.current = null;
    }
  }, []);

  const nextExpectedMove = useMemo(() => {
    const node = currentPuzzle.turns?.[step];
    if (!node) return null;
    const player = node.player || {};
    const reply = node.reply || null;
    return {
      from: (player.from || "").toLowerCase(),
      to: (player.to || "").toLowerCase(),
      promotion: player.promotion,
      autoReply: reply
        ? {
            ...reply,
            from: (reply.from || "").toLowerCase(),
            to: (reply.to || "").toLowerCase(),
          }
        : null,
      hint: node.hint || ""
    };
  }, [currentPuzzle, step]);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setLegalMoves(new Map());
  }, []);

  const highlightSquare = useCallback((sq) => {
    const g = chessRef.current;
    const piece = g.get(sq);
    const turn = g.turn();
    if (piece && piece.color === turn) {
      setSelected(sq);
      const moves = g.moves({ square: sq, verbose: true });
      setLegalMoves(new Map(moves.map((m) => [m.to, m])));
      return true;
    }
    clearSelection();
    return false;
  }, [clearSelection]);

  const resetCurrentPuzzle = useCallback(() => {
    if (runtimePuzzle) {
      loadRuntime(runtimePuzzle, "retry");
    } else {
      loadPuzzle(activeIndex, "retry");
    }
    updateProgress((prev) => ({
      ...prev,
      streak: 0,
    }));
  }, [activeIndex, loadPuzzle, loadRuntime, runtimePuzzle, updateProgress]);

  const handleSuccess = useCallback(() => {
    speak("success");
    playSe("success");
    showCutin("success");
    updateProgress((prev) => {
      const solved = new Set(prev.solvedIds || []);
      solved.add(currentPuzzle.id);
      const streakValue = (prev.streak || 0) + 1;
      const best = Math.max(prev.bestStreak || 0, streakValue);
      return {
        solvedIds: Array.from(solved),
        streak: streakValue,
        bestStreak: best,
      };
    });
  }, [currentPuzzle.id, playSe, showCutin, speak, updateProgress]);

  const handleFailure = useCallback(() => {
    const failLine = currentPuzzle.dialogue?.fail || DEFAULT_LINES.fail;
    speak("fail");
    playSe("fail");
    showCutin("fail");
    setHintSquares([]);
    const hintText = nextExpectedMove?.hint;
    if (hintText) {
      setMessage(`${failLine}\nヒント: ${hintText}`);
    } else {
      setMessage(failLine);
    }
    updateProgress((prev) => ({
      ...prev,
      streak: 0,
    }));
  }, [currentPuzzle, nextExpectedMove, playSe, showCutin, speak, updateProgress]);

  const applyMove = useCallback((move) => {
    const result = chessRef.current.move(move);
    if (!result) return null;
    setHistory((prev) => [...prev, { san: result.san, color: result.color }]);
    setFen(chessRef.current.fen());

    let soundKey = null;
    if (result.flags && (result.flags.includes("c") || result.flags.includes("e"))) {
      soundKey = "capture";
    } else if (result.san.includes("#")) {
      soundKey = null;
    } else if (result.san.includes("+")) {
      soundKey = "check";
    } else {
      soundKey = "move";
    }
    if (soundKey) {
      playSe(soundKey);
    }

    return result;
  }, [playSe]);

  const handlePlayerMove = useCallback((from, to) => {
    if (status === "success") return false;

    const normalizedFrom = from.toLowerCase();
    const normalizedTo = to.toLowerCase();

    const legalCandidates = chessRef.current.moves({ square: normalizedFrom, verbose: true }) || [];
    const legalCandidate = legalCandidates.find((m) => m.to === normalizedTo);
    if (!legalCandidate) {
      playSe("blocked");
      return false;
    }

    const expected = nextExpectedMove;
    if (!expected) return false;

    if (expected.from !== normalizedFrom || expected.to !== normalizedTo) {
      handleFailure();
      return false;
    }

    if (expected.promotion && legalCandidate.promotion && legalCandidate.promotion !== expected.promotion) {
      handleFailure();
      return false;
    }

    const result = applyMove({ from, to, promotion: expected.promotion });
    if (!result) {
      handleFailure();
      return false;
    }

    setSelected(null);
    setLegalMoves(new Map());
    setHintSquares([]);

    if (expected.autoReply) {
      const replyResult = applyMove(expected.autoReply);
      if (!replyResult) {
        // undo the player move if auto reply fails for some reason
        chessRef.current.undo();
        setHistory((prev) => prev.slice(0, -1));
        setFen(chessRef.current.fen());
        handleFailure();
        return false;
      }
    }

    const isComplete = step + 1 >= (currentPuzzle.turns?.length || 0);
    if (isComplete) {
      handleSuccess();
    } else {
      speak("mid") || setStatus("mid");
      setStep((prev) => prev + 1);
    }
    return true;
  }, [applyMove, currentPuzzle.turns, handleFailure, handleSuccess, nextExpectedMove, playSe, speak, status, step]);

  const onSquareClick = useCallback((sq) => {
    if (status === "success") return;
    const g = chessRef.current;
    const piece = g.get(sq);

    if (!selected) {
      highlightSquare(sq);
      return;
    }

    if (selected === sq) {
      clearSelection();
      return;
    }

    const selPiece = g.get(selected);
    if (piece && selPiece && piece.color === selPiece.color) {
      highlightSquare(sq);
      return;
    }

    const moved = handlePlayerMove(selected, sq);
    if (!moved) {
      clearSelection();
    }
  }, [clearSelection, handlePlayerMove, highlightSquare, selected, status]);

  const beginDrag = useCallback((event, sq, pieceCode, canDragPiece) => {
    if (status === "success") {
      event.preventDefault();
      return;
    }
    if (!pieceCode || !canDragPiece || event.button !== 0) {
      if (!pieceCode) {
        clearSelection();
      }
      highlightSquare(sq);
      return;
    }

    const domRect = document.querySelector(".board")?.getBoundingClientRect();
    if (!domRect) return;
    const squareSize = domRect.width / 8;
    const piecePixels = squareSize * PIECE_SCALE;

    setDrag({
      active: true,
      from: sq,
      piece: pieceCode,
      x: event.clientX,
      y: event.clientY,
      offsetX: piecePixels / 2,
      offsetY: piecePixels / 2,
    });
    dragMetaRef.current = {
      pointerId: event.pointerId,
      squareSize,
      piecePixels,
      from: sq,
    };
    highlightSquare(sq);
    event.preventDefault();
  }, [clearSelection, highlightSquare, status]);

  useEffect(() => {
    if (!drag.active) return;

    const handleMove = (evt) => {
      if (status === "success") return;
      const meta = dragMetaRef.current;
      if (!meta || evt.pointerId !== meta.pointerId) return;
      setDrag((prev) => prev.active ? { ...prev, x: evt.clientX, y: evt.clientY } : prev);
      const target = (() => {
        const rect = document.querySelector(".board")?.getBoundingClientRect();
        if (!rect) return null;
        const squareSize = rect.width / 8;
        const relX = evt.clientX - rect.left;
        const relY = evt.clientY - rect.top;
        if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;
        const fileIndex = Math.floor(relX / squareSize);
        const rankIndex = Math.floor(relY / squareSize);
        const targetFile = files[fileIndex];
        const targetRank = ranks[rankIndex];
        if (targetFile === undefined || targetRank === undefined) return null;
        return `${targetFile}${targetRank}`;
      })();
      setHoverSquare(target);
    };

    const finishDrag = (evt) => {
      const meta = dragMetaRef.current;
      if (!meta || evt.pointerId !== meta.pointerId) return;
      const rect = document.querySelector(".board")?.getBoundingClientRect();
      let target = null;
      if (rect) {
        const squareSize = rect.width / 8;
        const relX = evt.clientX - rect.left;
        const relY = evt.clientY - rect.top;
        if (relX >= 0 && relY >= 0 && relX < rect.width && relY < rect.height) {
          const fileIndex = Math.floor(relX / squareSize);
          const rankIndex = Math.floor(relY / squareSize);
          const targetFile = files[fileIndex];
          const targetRank = ranks[rankIndex];
          if (targetFile !== undefined && targetRank !== undefined) {
            target = `${targetFile}${targetRank}`;
          }
        }
      }

      if (status !== "success" && target && target !== meta.from) {
        const moved = handlePlayerMove(meta.from, target);
        if (!moved) {
          clearSelection();
        }
      }

      setDrag({ active: false, from: null, piece: null, x: 0, y: 0, offsetX: 0, offsetY: 0 });
      setHoverSquare(null);
      dragMetaRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [clearSelection, drag.active, files, handlePlayerMove, ranks, status]);

  const goNextPuzzle = useCallback(async () => {
    const level = getSelectedDifficulty();
    const bucket = {
      1: "900-1200",
      2: "1200-1500",
      3: "1500-1800",
      4: "1800-2100",
      5: "2100-2400",
      6: "2400-4000",
    }[Number(level) || 3];

    try {
      const res = await fetch(`/api/problem?range=${bucket}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      const turns = buildTurnsFromUciArray(Array.isArray(data.moves) ? data.moves : []);
      const title = `タクティクス (${bucket})`;
      const rp = {
        id: data.id ?? `${bucket}-${Date.now()}`,
        title,
        fen: data.fen,
        side: (String(data.fen).split(' ')[1] === 'b') ? 'black' : 'white',
        characterId: 1,
        difficulty: Number(level) || 3,
        dialogue: { intro: '', mid: '', success: '', fail: '', retry: '' },
        turns,
      };
      loadRuntime(rp, "intro");
    } catch (err) {
      // Fallback to local rotation if API fails
      const nextIndex = (activeIndex + 1) % puzzles.length;
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, loadRuntime]);

  const theme = character.theme || FALLBACK_CHARACTER.theme;
  const accent = character.accent || FALLBACK_CHARACTER.accent;
  const cutinCharacter = CHARACTER_MAP[cutin.characterId] || character;
  const cutinStyle = cutin.type === "fail"
    ? { "--cutin-theme": "#ef4444", "--cutin-soft": "rgba(239,68,68,0.22)" }
    : {
        "--cutin-theme": cutinCharacter ? cutinCharacter.theme : theme,
        "--cutin-soft": cutinCharacter ? cutinCharacter.accent : accent,
      };
  const cutinSfx = cutin.type === "success"
    ? "ナイスショット!"
    : cutin.type === "fail"
      ? "もう一回！"
      : "";
  const handleBgmVolumeChange = useCallback((event) => {
    const value = Number(event.target.value);
    setBgmVolume(Math.max(0, Math.min(1, value / 100)));
  }, []);
  const handleSeVolumeChange = useCallback((event) => {
    const value = Number(event.target.value);
    setSeVolume(Math.max(0, Math.min(1, value / 100)));
  }, []);
  const toggleCutin = useCallback(() => {
    setCutinEnabled((prev) => !prev);
  }, []);
  const toggleLegalHints = useCallback(() => {
    setLegalHintsEnabled((prev) => !prev);
  }, []);
  const puzzleSolved = status === "success";
  const difficultyValue = Number(currentPuzzle.difficulty) || 0;
  const difficultyStars = difficultyValue > 0 ? "☆".repeat(Math.min(difficultyValue, 6)) : null;
  const formattedHistory = useMemo(() => {
    if (history.length === 0) return [];
    const entries = [];
    let index = 0;

    if (initialTurn === "b" && history[0]?.color === "b") {
      entries.push({
        moveNumber: 1,
        ellipsis: true,
        white: null,
        black: history[0].san,
      });
      index = 1;
    }

    let moveNumber;
    if (initialTurn === "b") {
      moveNumber = history[0]?.color === "b" ? 2 : 1;
    } else {
      moveNumber = 1;
    }
    while (index < history.length) {
      let whiteSan = null;
      let blackSan = null;

      if (history[index]?.color === "w") {
        whiteSan = history[index].san;
        index += 1;
      }

      if (history[index]?.color === "b") {
        blackSan = history[index].san;
        index += 1;
      }

      if (whiteSan || blackSan) {
        entries.push({
          moveNumber,
          ellipsis: !whiteSan,
          white: whiteSan,
          black: blackSan,
        });
        moveNumber += 1;
      } else {
        index += 1;
      }
    }

    return entries;
  }, [history, initialTurn]);

  return (
    <div className="page">
      <style>{CSS(theme, accent)}</style>
      <div
        className={`cutin cutin--${cutin.type || "idle"} ${cutin.visible ? "is-active" : ""}`}
        style={cutinStyle}
        aria-hidden={cutin.visible ? "false" : "true"}
      >
        <div className="cutin__flash" />
        <div className="cutin__panel">
          {cutinCharacter?.cutinImage ? (
            <div className="cutin__art">
              <img src={cutinCharacter.cutinImage} alt={`${cutinCharacter?.name || "キャラクター"}のカットイン`} />
            </div>
          ) : null}
          <div className="cutin__content">
            <div className="cutin__badge">{cutinCharacter?.badge}</div>
            <div className="cutin__text">{cutin.text}</div>
            {cutinSfx ? <div className="cutin__sfx">{cutinSfx}</div> : null}
          </div>
        </div>
      </div>
      <header className="topbar">
        <div className="topbar__brand">
          <img className="topbar__logo" src={siteLogo} alt={`${SITE_TITLE} ロゴ`} />
          <span className="topbar__title">{SITE_TITLE}</span>
        </div>
        <div className="topbar__status">
          <span>連続クリア: {streak}</span>
          <span>ベスト: {bestStreak}</span>
        </div>
      </header>
      <main className="layout">
        <section className="card board-card">
          <div className="toolbar">
            <div className="status-label">{status.toUpperCase()}</div>
            {difficultyStars ? (
              <div className="difficulty-badge" aria-label={`難易度 ${difficultyValue}`}>
                <span className="difficulty-badge__label">問題難易度</span>
                <span className="difficulty-badge__stars">{difficultyStars}</span>
              </div>
            ) : null}
            <div className="toolbar__actions">
              <a href="#/" style={{ textDecoration: 'none' }}>
                <button type="button" className="btn" style={{ marginRight: 8 }}>ホーム</button>
              </a>
              <a href="#/select" style={{ textDecoration: 'none' }}>
                <button type="button" className="btn" style={{ marginRight: 8 }}>難易度</button>
              </a>
              <button
                type="button"
                className="btn-primary btn-primary--tight"
                onClick={goNextPuzzle}
                disabled={!puzzleSolved && status !== "fail"}
              >
                次の問題へ
              </button>
            </div>
          </div>

          <div className="board-wrap">
            <div className="ranks">
              {ranks.map((rk) => (<div key={rk}>{rk}</div>))}
            </div>
            <div className="board">
              {squares.map((sq, idx) => {
                const fileIdx = idx % 8;
                const rankIdx = Math.floor(idx / 8);
                const dark = (fileIdx + rankIdx) % 2 === 1;
                const piece = chessRef.current.get(sq);
                const glyph = piece ? (piece.color === "w" ? piece.type.toUpperCase() : piece.type) : null;
                const isSel = selected === sq;
                const lastMoveSquares = history.length > 0 ? (() => {
                  const lastMove = chessRef.current.history({ verbose: true }).slice(-1)[0];
                  if (!lastMove) return [];
                  return [lastMove.from, lastMove.to];
                })() : [];
                const isFrom = lastMoveSquares[0] === sq;
                const isTo = lastMoveSquares[1] === sq;
                const lm = legalMoves.get(sq);
                const isLegal = legalHintsEnabled && Boolean(lm);
                const isCap = legalHintsEnabled && Boolean(lm?.flags && lm.flags.includes("c"));
                const inCheck = chessRef.current.inCheck() && kingSquare(chessRef.current.turn() === "w" ? "white" : "black") === sq;
                const canDragPiece = !puzzleSolved && piece
                  ? (piece.color === (chessRef.current.turn() === "w" ? "w" : "b"))
                  : false;
                const isDragSource = drag.active && drag.from === sq;
                const isHover = drag.active && hoverSquare === sq;
                const isHint = hintSquares.includes(sq);
                return (
                  <Square
                    key={sq}
                    sq={sq}
                    piece={glyph}
                    dark={dark}
                    selected={isSel}
                    from={isFrom}
                    to={isTo}
                    legal={isLegal}
                    capture={isCap}
                    inCheck={inCheck}
                    isDragSource={isDragSource}
                    isHover={isHover}
                    isHint={isHint}
                    canDrag={canDragPiece}
                    onClick={() => onSquareClick(sq)}
                    onPointerDown={(evt) => beginDrag(evt, sq, glyph, canDragPiece)}
                    disabled={puzzleSolved}
                  />
                );
              })}
            </div>
            <div className="files">
              {files.map((f) => (<div key={f}>{f}</div>))}
            </div>
          </div>

          {drag.active && drag.piece ? (
            <div
              className="drag-piece"
              style={{
                width: `${dragMetaRef.current?.piecePixels ?? SQUARE_SIZE * PIECE_SCALE}px`,
                height: `${dragMetaRef.current?.piecePixels ?? SQUARE_SIZE * PIECE_SCALE}px`,
                transform: `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)`,
              }}
            >
              <div className="piece-wrap piece-wrap--floating">
                <PieceIcon piece={drag.piece} />
              </div>
            </div>
          ) : null}
          <div className="options-panel">
            <div className="options-grid">
              <div className="option option--slider">
                <div className="option__header">
                  <label className="option__label" htmlFor="bgm-volume">BGM</label>
                  <span className="option__value">{Math.round(bgmVolume * 100)}%</span>
                </div>
                <input
                  id="bgm-volume"
                  className="option__range"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(bgmVolume * 100)}
                  onChange={handleBgmVolumeChange}
                />
              </div>
              <div className="option option--slider">
                <div className="option__header">
                  <label className="option__label" htmlFor="se-volume">SE</label>
                  <span className="option__value">{Math.round(seVolume * 100)}%</span>
                </div>
                <input
                  id="se-volume"
                  className="option__range"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(seVolume * 100)}
                  onChange={handleSeVolumeChange}
                />
              </div>
              <button
                type="button"
                className={`option option--toggle ${cutinEnabled ? "is-on" : "is-off"}`}
                onClick={toggleCutin}
                aria-pressed={cutinEnabled}
              >
                <span className="option__label">CUT-IN</span>
                <span className="option__state">{cutinEnabled ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                className={`option option--toggle ${legalHintsEnabled ? "is-on" : "is-off"}`}
                onClick={toggleLegalHints}
                aria-pressed={legalHintsEnabled}
              >
                <span className="option__label">MOVE HINT</span>
                <span className="option__state">{legalHintsEnabled ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </section>

        <SidePanel
          character={character}
          currentPuzzle={currentPuzzle}
          difficultyValue={difficultyValue}
          difficultyStars={difficultyStars}
          message={message}
          formattedHistory={formattedHistory}
        />
      </main>
    </div>
  );
}

const CSS = (themeColor, accentColor) => `
:root{
  --board-size:clamp(240px,78vw,${BOARD_SIZE}px);
  --piece-scale:${PIECE_SCALE};
  --square-size:calc(var(--board-size)/8);
  --sq-light:#f0d9b5;
  --sq-dark:#b58863;
  --accent:${themeColor};
  --accent-soft:${accentColor};
  --fg:#1f2937;
  --bg:#f6f5ff;
  --card:#ffffff;
  --muted:#6b7280;
}
*{box-sizing:border-box}
html,body,#root{height:100%}
body{margin:0;display:block;min-height:100vh;background:var(--bg);color:var(--fg);font-family:'Noto Sans JP',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.page{min-height:100vh;background:radial-gradient(circle at top,var(--accent-soft),rgba(15,23,42,0.05));position:relative;overflow:hidden}
.page::before{content:'';position:fixed;inset:0;background:url(${bgAurora}) center/cover no-repeat;opacity:0.24;pointer-events:none;z-index:0}
.page > *{position:relative;z-index:1}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:14px 22px;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(0,0,0,0.06)}
.topbar__brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:20px;letter-spacing:0.06em;color:var(--accent)}
.topbar__logo{width:48px;height:48px;object-fit:contain;filter:drop-shadow(0 6px 12px rgba(15,23,42,0.18))}
.topbar__title{text-transform:uppercase}
.topbar__status{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;font-weight:600;color:var(--muted)}
.layout{max-width:1200px;margin:24px auto 56px;display:grid;gap:24px;grid-template-columns:minmax(0,1fr) 320px;align-items:start;padding:0 24px;width:100%;box-sizing:border-box}
@media (max-width:960px){.layout{grid-template-columns:1fr;max-width:760px;gap:20px}}
.card{background:var(--card);border:1px solid rgba(15,23,42,0.08);border-radius:20px;box-shadow:0 14px 28px rgba(15,23,42,0.08);width:100%}
.board-card{padding:18px;position:relative;overflow:hidden}
.toolbar{display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;justify-content:space-between}
.toolbar__actions{display:flex;gap:10px;align-items:center}
.difficulty-badge{display:inline-flex;align-items:center;justify-content:center;padding:6px 12px;border-radius:999px;background:rgba(59,130,246,0.08);color:#1d4ed8;font-weight:800;letter-spacing:0.12em;font-size:12px;min-width:120px;gap:6px}
.difficulty-badge__label{text-transform:none;font-size:11px;letter-spacing:0.06em;color:#1e3a8a}
.difficulty-badge__stars{letter-spacing:0.3em}
.btn{background:var(--fg);color:#fff;border:none;border-radius:999px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 18px rgba(15,23,42,0.15)}
.btn:disabled{opacity:0.45;cursor:not-allowed;box-shadow:none;transform:none}
.btn-secondary{background:#fff;color:var(--fg);border:1px solid rgba(15,23,42,0.12);border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.btn-secondary:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(15,23,42,0.1)}
.btn-primary{background:var(--accent);border:none;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(59,130,246,0.2)}
.btn-primary:disabled{background:rgba(59,130,246,0.35);color:rgba(255,255,255,0.8)}
.btn-primary--tight{padding:8px 16px;font-size:12px;letter-spacing:0.04em}
.status-label{margin-right:auto;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:0.1em}
.board-wrap{display:grid;grid-template-columns:28px var(--board-size);grid-template-rows:var(--board-size) 26px;gap:10px;justify-content:center}
.ranks{display:flex;flex-direction:column;justify-content:space-between;height:var(--board-size);color:var(--muted);font-size:12px;padding:8px 6px 8px 0;grid-column:1;grid-row:1}
.ranks div{display:flex;justify-content:flex-end;align-items:center;height:calc(var(--board-size)/8)}
.files{display:grid;grid-template-columns:repeat(8,1fr);width:var(--board-size);color:var(--muted);font-size:12px;grid-column:2;grid-row:2}
.files div{display:flex;align-items:center;justify-content:center;height:26px}
.board{width:var(--board-size);height:var(--board-size);display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:12px;overflow:hidden;border:1px solid rgba(15,23,42,0.1);box-shadow:0 18px 38px rgba(15,23,42,0.18);position:relative;touch-action:none;-ms-touch-action:none}
.sq{position:relative;display:flex;align-items:center;justify-content:center;border:none;background:var(--sq-light);line-height:1;border-radius:0;margin:0;-webkit-tap-highlight-color:transparent;padding:0;cursor:pointer;transition:background .12s ease,box-shadow .12s ease;touch-action:none;-ms-touch-action:none;user-select:none;-webkit-user-select:none}
.sq:disabled{cursor:default;pointer-events:none;filter:saturate(.85)}
.sq--dark{background:var(--sq-dark)}
.sq--sel{box-shadow:inset 0 0 0 3px rgba(37,99,235,0.5)}
.sq--hint{box-shadow:inset 0 0 0 3px rgba(244,114,182,0.5)}
.sq--last{box-shadow:inset 0 0 0 3px rgba(59,130,246,0.45)}
.sq--check{box-shadow:inset 0 0 0 4px rgba(239,68,68,0.85),0 0 22px rgba(239,68,68,0.4);animation:checkGlow .85s ease-in-out infinite alternate}
.sq--hover{box-shadow:inset 0 0 0 3px rgba(59,130,246,0.35)}
.sq--hover::after{content:"";position:absolute;inset:6px;border:2px dashed rgba(59,130,246,0.35);border-radius:8px;pointer-events:none}
.sq--can-drag{cursor:grab !important}
.sq--dragging{cursor:grabbing !important}
.piece-wrap{width:var(--square-size);height:var(--square-size);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,filter .12s ease}
.piece-wrap--floating{transform:scale(1.05)}
.piece-svg{width:100%;height:100%;filter:drop-shadow(0 1px 2px rgba(17,24,39,0.25))}
.sq--dragging .piece-wrap{opacity:0;transform:scale(0.92)}
.hint{position:absolute;pointer-events:none}
.hint--dot{width:22%;height:22%;border-radius:50%;background:rgba(17,24,39,0.28)}
.hint--ring{width:72%;height:72%;border-radius:50%;border:3px solid rgba(17,24,39,0.35)}
.drag-piece{position:fixed;top:0;left:0;pointer-events:none;z-index:40;display:flex;align-items:center;justify-content:center}
.drag-piece .piece-wrap{width:100%;height:100%}
.drag-piece .piece-svg{filter:drop-shadow(0 12px 22px rgba(15,23,42,0.3))}
.options-panel{margin-top:12px;padding:8px;border-radius:10px;background:rgba(15,23,42,0.03);box-shadow:inset 0 0 0 1px rgba(148,163,184,0.16)}
.options-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}
.option{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:#fff;border:1px solid rgba(148,163,184,0.28);box-shadow:0 1px 3px rgba(15,23,42,0.08);font-size:11px;font-weight:600;letter-spacing:0.04em;min-height:42px;box-sizing:border-box}
.option--slider{flex-direction:column;align-items:stretch;gap:6px;min-height:56px}
.option__header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.option__label{text-transform:uppercase;font-weight:800;letter-spacing:0.08em;color:#475569;display:flex;align-items:center}
.option--slider .option__label{white-space:nowrap}
.option__range{flex:1;appearance:none;height:3px;border-radius:999px;background:rgba(148,163,184,0.35);outline:none;margin:0;max-width:100%}
.option__range::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:#1d4ed8;box-shadow:0 2px 5px rgba(15,23,42,0.2)}
.option__range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#1d4ed8;border:none;box-shadow:0 2px 5px rgba(15,23,42,0.2)}
.option__range:focus-visible{outline:2px solid rgba(59,130,246,0.35);outline-offset:2px}
.option__value{min-width:32px;text-align:right;font-size:10px;font-weight:800;color:#1f2937}
.option--toggle{justify-content:space-between;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease,background .12s ease;min-height:46px}
.option--toggle .option__label{flex:1;min-width:0}
.option--toggle:hover{transform:translateY(-1px);box-shadow:0 6px 12px rgba(15,23,42,0.12)}
.option--toggle:focus-visible{outline:2px solid rgba(59,130,246,0.4);outline-offset:3px}
.option__state{padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:0.08em;background:rgba(148,163,184,0.25);color:#475569}
.option--toggle.is-on{border-color:rgba(37,99,235,0.35);background:rgba(59,130,246,0.08)}
.option--toggle.is-on .option__label{color:#1d4ed8}
.option--toggle.is-on .option__state{background:rgba(59,130,246,0.22);color:#1d4ed8}
.side{padding:22px;display:flex;flex-direction:column;gap:18px}
.character{display:flex;gap:16px;align-items:center}
.character__badge{width:64px;height:64px;border-radius:18px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:18px;box-shadow:0 12px 20px rgba(15,23,42,0.15);overflow:hidden}
.character__badge-image{width:100%;height:100%;object-fit:cover}
.character__meta{display:flex;flex-direction:column;gap:4px}
.character__name{font-size:18px;font-weight:700}
.character__title{font-size:13px;color:var(--muted)}
.character__puzzle{margin-top:4px;font-size:12px;font-weight:600;color:var(--accent)}
.character__difficulty{font-size:12px;font-weight:800;letter-spacing:0.08em;color:#f59e0b;display:flex;align-items:center;gap:6px}
.character__difficulty-label{color:#f97316;font-weight:700}
.character__difficulty-stars{letter-spacing:0.2em}
.speech{background:var(--accent-soft);border:1px solid rgba(15,23,42,0.06);border-radius:14px;padding:16px;font-size:14px;line-height:1.6;min-height:78px;position:relative}
.speech::before{content:'';position:absolute;top:-10px;left:28px;border-width:0 14px 14px;border-style:solid;border-color:transparent transparent var(--accent-soft)}
.puzzle-actions{display:flex;gap:12px;flex-wrap:wrap}
.puzzle-actions .btn{opacity:var(--btn-opacity,1)}
.history-panel{background:#f9f9ff;border:1px dashed rgba(59,130,246,0.25);border-radius:12px;padding:14px}
.history-panel h3{margin:0 0 8px;font-size:14px;letter-spacing:0.08em;color:rgba(15,23,42,0.75)}
.history-panel__empty{margin:4px 0 0;font-size:12px;color:var(--muted)}
.history-list{margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;color:#1f2937}
.history-move{display:flex;gap:8px;align-items:baseline;line-height:1.4}
.history-move__number{font-weight:700;color:var(--accent);min-width:42px}
.history-move__white{font-weight:600}
.history-move__black{color:#0f172a}
.history-move__black--solo{margin-left:0}
.cutin{position:fixed;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:60;opacity:0;transform:scale(.92);transition:opacity .22s ease,transform .22s ease}
.cutin::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at center,rgba(15,23,42,0.35),rgba(15,23,42,0.75));opacity:0;transition:opacity .22s ease}
.cutin__panel{position:relative;padding:26px 44px;border-radius:28px;background:linear-gradient(135deg,var(--cutin-theme) 0%,rgba(255,255,255,0.15) 100%);box-shadow:0 24px 44px rgba(15,23,42,0.5);color:#fff;display:flex;align-items:center;gap:28px;transform:skew(-6deg) scale(.9);opacity:0;transition:transform .28s cubic-bezier(.21,.82,.25,1),opacity .22s ease;text-align:left;border:1px solid rgba(255,255,255,0.32);min-width:320px;max-width:620px}
.cutin__content{display:flex;flex-direction:column;gap:12px;align-items:flex-start;text-align:left}
.cutin__badge{font-size:22px;font-weight:800;padding:10px 24px;border-radius:999px;background:rgba(255,255,255,0.2);box-shadow:0 12px 24px rgba(0,0,0,0.25);display:inline-flex;align-items:center;justify-content:center;letter-spacing:0.08em}
.cutin__text{font-size:18px;font-weight:700;line-height:1.5;letter-spacing:0.02em;max-width:320px}
.cutin__sfx{font-size:30px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;text-shadow:0 10px 28px rgba(0,0,0,0.35);animation:cutinPulse .9s ease-in-out infinite alternate}
.cutin__art{width:180px;max-width:38vw;flex-shrink:0;border-radius:24px;overflow:hidden;position:relative;background:rgba(255,255,255,0.14);box-shadow:0 18px 32px rgba(15,23,42,0.45)}
.cutin__art::after{content:'';position:absolute;inset:0;background:linear-gradient(165deg,rgba(255,255,255,0.45) 0%,rgba(255,255,255,0.05) 45%,rgba(0,0,0,0.35) 100%);mix-blend-mode:screen;pointer-events:none}
.cutin__art img{display:block;width:100%;height:100%;object-fit:cover}
.cutin__flash{position:absolute;inset:-20%;background:radial-gradient(circle,var(--cutin-theme) 0%,transparent 60%);opacity:0;transform:scale(.8)}
.cutin.is-active{opacity:1;transform:scale(1)}
.cutin.is-active::before{opacity:.85}
.cutin.is-active .cutin__panel{opacity:1;transform:skew(-6deg) scale(1)}
.cutin.is-active .cutin__flash{animation:cutinBurst .6s ease-out forwards}
.cutin--fail{--cutin-theme:#ef4444;--cutin-soft:rgba(239,68,68,0.22)}
.cutin--fail .cutin__panel{background:linear-gradient(135deg,var(--cutin-theme) 0%,rgba(239,68,68,0.7) 100%)}
.cutin--success .cutin__panel{background:linear-gradient(135deg,var(--cutin-theme) 0%,rgba(255,255,255,0.2) 85%)}
@keyframes cutinBurst{0%{opacity:0;transform:scale(.7)}40%{opacity:.95}100%{opacity:0;transform:scale(1.15)}}
@keyframes cutinPulse{0%{transform:scale(.96)}100%{transform:scale(1.05)}}
@keyframes checkGlow{0%{box-shadow:inset 0 0 0 4px rgba(239,68,68,0.78),0 0 14px rgba(239,68,68,0.35)}100%{box-shadow:inset 0 0 0 6px rgba(239,68,68,0.92),0 0 30px rgba(239,68,68,0.6)}}
@media (max-width:640px){
  .cutin__panel{flex-direction:column;gap:18px;text-align:center}
  .cutin__content{align-items:center;text-align:center}
  .cutin__badge{align-self:center}
  .cutin__text{max-width:none}
  .cutin__art{width:220px}
}
@media (max-width:720px){
  .topbar{flex-direction:column;align-items:flex-start;gap:8px;padding:12px 16px}
  .topbar__status{width:100%;justify-content:space-between}
  .layout{margin:16px auto 36px;padding:0 16px}
  .board-card{padding:14px}
  .side{padding:18px}
  .toolbar{flex-direction:column;align-items:stretch;gap:10px}
  .toolbar__actions{width:100%;justify-content:center}
  .toolbar__actions .btn-primary{width:100%}
  .difficulty-badge{width:100%;justify-content:center}
  .status-label{margin:0 auto;text-align:center}
}
@media (max-width:600px){
  .layout{padding:0 12px;margin:16px auto 28px;gap:18px}
  .board-wrap{grid-template-columns:var(--board-size);grid-template-rows:var(--board-size) auto;gap:6px}
  .ranks{display:none}
  .files{grid-column:1;grid-row:2;width:var(--board-size);justify-self:center;font-size:11px}
  .options-panel{padding:6px}
  .options-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px}
  .option{min-height:40px;padding:5px 6px}
  .option--slider{min-height:50px}
  .option__label{font-size:10px}
  .option__value{font-size:9px}
}
@media (max-width:480px){
  .topbar__brand{font-size:18px}
  .topbar__logo{width:40px;height:40px}
  .board-card{padding:12px}
  .side{padding:16px}
  .options-panel{margin-top:8px;padding:6px}
  .options-grid{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
  .option{gap:6px}
  .option__label{font-size:9px}
  .option__header{gap:6px}
  .option__value{min-width:28px}
}
`;
