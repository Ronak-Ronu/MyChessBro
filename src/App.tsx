// src/App.tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import useAIService from './hooks/useAiService'; // Import the hook
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
  const { commentary, generateComment,isSpeaking ,stopSpeaking} = useAIService();
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const bestMoveArrows: [Square, Square][] = [];

  const boardStyle = useMemo(() => {
    const style: Record<string, React.CSSProperties> = {};
    bestMoveArrows.forEach((arrow) => {
      style[arrow[0]] = { ...style[arrow[0]], backgroundColor: 'rgba(144, 238, 144, 0.7)' };
      style[arrow[1]] = { ...style[arrow[1]], backgroundColor: 'rgba(144, 238, 144, 0.7)' };
    });
    if (selectedSquare) {
      style[selectedSquare] = { ...style[selectedSquare], border: '3px solid yellow' };
    }
    possibleMoves.forEach((square) => {
      style[square] = { ...style[square], backgroundColor: 'rgba(173, 216, 230, 0.7)' };
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
      alert('Illegal move!');
    }

    if (move === null) return false;
    setGamePosition(chess.current.fen());
    setSuggestedMove(null);
    setEvaluationScore(null);
    setLastMove(`${sourceSquare}-${targetSquare}`);
    generateComment(lastMove, evaluationScore,muted);

    if (chess.current.isGameOver()) {
      alert('Game Over!');
    } else {
      // Remove the following block of code to stop automatic AI suggestions:
      // if (stockfishWorker.current) {
      //   stockfishWorker.current.postMessage({
      //     command: 'getBestMove',
      //     fen: chess.current.fen(),
      //   });
      // }
    generateComment(lastMove, evaluationScore,muted);

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
          generateComment(lastMove, evaluationScore,muted);
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
    generateComment(lastMove, evaluationScore,muted);
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
  }, []); 
  useEffect(() => {
    if (muted) {
      stopSpeaking(); // Stop any ongoing speech when muted
    }
  }, [muted, stopSpeaking]);
  // useEffect(() => {
  //   if ('speechSynthesis' in window) {
  //     speechSynthesis.addEventListener('voiceschanged', () => {
  //       // const voices = window.speechSynthesis.getVoices();
  //       console.log("Available Voices:", voices);
  //     });
  //     // Also get the voices initially if they are already loaded
  //     const initialVoices = window.speechSynthesis.getVoices();
  //     if (initialVoices.length > 0) {
  //       // console.log("Initial Available Voices:", initialVoices);
  //     }
  //   }
  // }, []);

  const appStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#282c34',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
  };

  const boardContainerStyle: React.CSSProperties = {
    width: 'calc(100vmin - 100px)',
    maxWidth: '800px',
    margin: '20px auto',
    border: '5px solid #61dafb',
    borderRadius: '8px',
    overflow: 'hidden',
  };

  const getStockfishMove = () => {
    if (stockfishWorker.current) {
      stockfishWorker.current.postMessage({
        command: 'getBestMove',
        fen: chess.current.fen(),
      });
    }
  };

  const customArrows: [Square, Square, string?][] = suggestedMove
    ? [[suggestedMove[0] as Square, suggestedMove[1] as Square, 'rgb(0, 128, 255)']]
    : [];



    return (
      <div style={appStyle}>
        <div style={boardContainerStyle}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
              <Chessboard
                position={gamePosition}
                onPieceDrop={onDrop}
                boardOrientation="white"
                customArrows={customArrows}
                onSquareClick={handleSquareClick}
                customSquareStyles={boardStyle}
                customDarkSquareStyle={{ backgroundColor: '#779556' }}
                customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
              />
          </div>
        </div>
  
            {commentary && (
              <p style={{ marginLeft: '20px', marginTop: 0, width: '80vw', fontSize: '1.5em', lineHeight: '1.4' }}>
                <strong>Samay Raina Commentary:</strong> {commentary}
              </p>

            )}
                              {isSpeaking && <p>AI is speaking...</p>}
                  {/* {audioUrl && (
                    <audio controls autoPlay src={audioUrl} />
                  )} */}

        <p>Current FEN: {gamePosition}</p>
  
        <div className='buttons'>
          <div>
            <button onClick={getStockfishMove} >Get AI Suggestion</button>
          </div>
          <div>
          <button onClick={() => setMuted(!muted)}>
            {muted ? "Unmute Commentary" : "Mute Commentary"}
          </button>

          </div>
          <div>
            <button
              onClick={() => {
                chess.current.reset();
                setGamePosition(chess.current.fen());
                setSuggestedMove(null);
                setLastMove(null);
                setEvaluationScore(null);
                stopSpeaking(); // Stop any ongoing speech           
                   }}
            >
              Reset Game
            </button>
          </div>
        </div>
      </div>
    );
}

export default App;