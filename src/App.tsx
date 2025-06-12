import { useState, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import useAIService from './hooks/useAiService';
import './App.css';

type Square =
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8'
  | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8'
  | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8'
  | 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'e7' | 'e8'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8'
  | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7' | 'g8'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8';

function App() {
  const chess = useRef(new Chess());
  const [gamePosition, setGamePosition] = useState(chess.current.fen());
  const stockfishWorker = useRef<Worker | null>(null);
  const [suggestedMove, setSuggestedMove] = useState<[string, string] | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [evaluationScore, setEvaluationScore] = useState<string | null>(null);
  const { commentary, generateComment, isSpeaking, stopSpeaking } = useAIService();
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [displayedCommentary, setDisplayedCommentary] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);

  const bestMoveArrows: [Square, Square][] = [];

  useEffect(() => {
    if (commentary) {
      setTypingIndex(0);
      setDisplayedCommentary("");
    }
  }, [commentary]);

  useEffect(() => {
    if (commentary && typingIndex < commentary.length) {
      const timeout = setTimeout(() => {
        setDisplayedCommentary(prev => prev + commentary[typingIndex]);
        setTypingIndex(prev => prev + 1);
      }, 20); // Adjust typing speed here

      return () => clearTimeout(timeout);
    }
  }, [typingIndex, commentary]);

  const boardStyle = useMemo(() => {
    const style: Record<string, React.CSSProperties> = {};
    bestMoveArrows.forEach((arrow) => {
      style[arrow[0]] = { ...style[arrow[0]], backgroundColor: 'rgba(144, 238, 144, 0.7)' };
      style[arrow[1]] = { ...style[arrow[1]], backgroundColor: 'rgba(144, 238, 144, 0.7)' };
    });
    if (selectedSquare) {
      style[selectedSquare] = { ...style[selectedSquare], border: '3px solid #FFD700' };
    }
    possibleMoves.forEach((square) => {
      style[square] = { ...style[square], backgroundColor: 'rgba(100, 149, 237, 0.7)' };
    });
    return style;
  }, [bestMoveArrows, possibleMoves, selectedSquare]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    let move = null;
    try {
      move = chess.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });
    } catch (e) {
      console.log("Illegal move:", e);
      return false;
    }

    if (move === null) return false;
    setGamePosition(chess.current.fen());
    setSuggestedMove(null);
    setEvaluationScore(null);
    setLastMove(`${sourceSquare}-${targetSquare}`);
    generateComment(lastMove, evaluationScore, muted);

    if (chess.current.isGameOver()) {
      alert('Game Over!');
    }

    return true;
  }

  function handleSquareClick(square: Square) {
    if (selectedSquare) {
      const pieceOnTarget = chess.current.get(square);
      const pieceOnSelected = chess.current.get(selectedSquare);

      if (pieceOnTarget && pieceOnSelected && pieceOnTarget.color === pieceOnSelected.color) {
        setSelectedSquare(square);
        const moves = chess.current.moves({ square: square, verbose: true });
        setPossibleMoves(moves.map((m) => m.to as Square));
      } else {
        const move = chess.current.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        });
    
        if (move) {
          setGamePosition(chess.current.fen());
          setSuggestedMove(null);
          setEvaluationScore(null);
          setLastMove(`${selectedSquare}-${square}`);
          generateComment(lastMove, evaluationScore, muted);
          setSelectedSquare(null);
          setPossibleMoves([]);
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      if (chess.current.get(square)) {
        setSelectedSquare(square);
        const moves = chess.current.moves({ square: square, verbose: true });
        setPossibleMoves(moves.map((m) => m.to as Square));
      }
    }
  }

  useEffect(() => {
    generateComment(lastMove, evaluationScore, muted);
    stockfishWorker.current = new Worker(new URL('./stockfishWorker.ts', import.meta.url), {
      type: 'module',
    });
    stockfishWorker.current.postMessage({ command: 'init' });

    stockfishWorker.current.onmessage = (event) => {
      const { type, move, score } = event.data;
      if (type === 'moveResult') {
        if (move && typeof move === 'string' && move.length >= 4) {
          const from = move.slice(0, 2);
          const to = move.slice(2, 4);
          setSuggestedMove([from, to]);
          setEvaluationScore(score);
        }
      } else if (type === 'moveError') {
        setEvaluationScore(null);
      }
    };

    return () => {
      if (stockfishWorker.current) {
        stockfishWorker.current.terminate();
      }
    };
  }, []); 

  useEffect(() => {
    if (muted) {
      stopSpeaking();
    }
  }, [muted, stopSpeaking]);

  const getStockfishMove = () => {
    if (stockfishWorker.current) {
      stockfishWorker.current.postMessage({
        command: 'getBestMove',
        fen: chess.current.fen(),
      });
    }
  };

  const customArrows: [Square, Square, string?][] = suggestedMove
    ? [[suggestedMove[0] as Square, suggestedMove[1] as Square, 'rgb(0, 200, 255)']]
    : [];

  return (
    <div className="app-container">
      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="app-title">My Chess Bro</h1>
        </div>
        <div className="toolbar-right">
          <button 
            onClick={getStockfishMove}
            className="toolbar-button"
            title="Get AI suggestion"
          >
            <i className="icon-ai"></i> AI Move
          </button>
          <button 
            onClick={() => setMuted(!muted)}
            className={`toolbar-button ${muted ? 'active' : ''}`}
            title={muted ? "Unmute commentary" : "Mute commentary"}
          >
            <i className={`icon-volume-${muted ? 'off' : 'on'}`}></i> {muted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={() => {
              chess.current.reset();
              setGamePosition(chess.current.fen());
              setSuggestedMove(null);
              setLastMove(null);
              setEvaluationScore(null);
              stopSpeaking();
              setDisplayedCommentary("");
            }}
            className="toolbar-button"
            title="Reset game"
          >
            <i className="icon-reset"></i> Reset
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="chessboard-container">
          <Chessboard
            position={gamePosition}
            onPieceDrop={onDrop}
            boardOrientation="white"
            customArrows={customArrows}
            onSquareClick={handleSquareClick}
            customSquareStyles={boardStyle}
            customDarkSquareStyle={{ backgroundColor: '#4a6b8a' }}
            customLightSquareStyle={{ backgroundColor: '#b5c7d3' }}
            boardWidth={600}
          />
        </div>

        <div className="commentary-container">
          <div className="commentary-header">
            <div className="commentary-avatar">
              <div className="avatar-circle">
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/46/Samay_raina_%28cropped%29.jpg" 
                  style={{ width: '100%', height: '100%' ,borderRadius: '50%' }}
                alt="" />
              </div>
            </div>
            <div className="commentary-title">
              <h3>Samay's Commentary</h3>
              {isSpeaking && (
                <div className="speaking-indicator">
                  <span className="pulse-dot"></span>
                  <span>AI is speaking...</span>
                </div>
              )}
            </div>
          </div>
          <div className="commentary-content">
            {displayedCommentary ? (
              <p className="typing-text">{displayedCommentary}</p>
            ) : (
              <p className="placeholder-text">Make a move to hear commentary!</p>
            )}
          </div>
        </div>
      </div>

      <div className="status-bar">
        <div className="fen-display">
          <span>FEN: </span>
          <code>{gamePosition.length > 50 ? `${gamePosition.substring(0, 50)}...` : gamePosition}</code>
        </div>
        {evaluationScore && (
          <div className="evaluation">
            <span>Evaluation: </span>
            <strong>{evaluationScore}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;