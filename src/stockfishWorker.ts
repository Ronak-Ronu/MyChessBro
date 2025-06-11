/// <reference lib="webworker" />

let stockfish: Worker | null = null;
let resolvePromise: ((value: { bestMove: string; score: string | null }) => void) | null = null;
let rejectPromise: ((reason?: unknown) => void) | null = null;
let currentScore: string | null = null;
let bestMove: string | null = null;

function initStockfish() {
    if (stockfish) return;

    stockfish = new Worker('/stockfish/stockfish.js');

    stockfish.onmessage = (event) => {
        const message = event.data;

        if (message.startsWith('bestmove')) {
            bestMove = message.split(' ')[1];
            if (resolvePromise) {
                resolvePromise({ bestMove: bestMove!, score: currentScore });
                resolvePromise = null;
                rejectPromise = null;
                currentScore = null;
                bestMove = null;
            }
        } else if (message.startsWith('info depth')) {
            const parts = message.split(' ');
            if (parts.includes('score')) {
                const scoreIndex = parts.indexOf('score') + 1;
                const scoreType = parts[scoreIndex];
                const scoreValue = parts[scoreIndex + 1];

                if (scoreType === 'cp') {
                    currentScore = (parseInt(scoreValue) / 100).toFixed(2); // Convert centipawns to pawns
                } else if (scoreType === 'mate') {
                    currentScore = `#${scoreValue}`; // Mate in X moves
                }
            }
        } else if (message.startsWith('uciok') || message.startsWith('readyok')) {
            // Engine initialized or ready
        } else if (message.startsWith('id name') || message.startsWith('id author')) {
            // Engine info
        } else {
            // console.log("Stockfish message:", message); // For debugging other messages
        }
    };

    stockfish.onerror = (error) => {
        console.error("Stockfish Worker Error:", error);
        if (rejectPromise) {
            rejectPromise(error);
            rejectPromise = null;
            currentScore = null;
            bestMove = null;
        }
    };

    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
}

self.onmessage = (event) => {
    const { command, fen } = event.data;

    if (command === 'init') {
        initStockfish();
    } else if (command === 'getBestMove' && stockfish) {
        console.log("Worker received getBestMove command:", fen); // Add this line
        if (resolvePromise || rejectPromise) {
            console.warn("Already awaiting a move. Ignoring new request.");
            return;
        }

        return new Promise<{ bestMove: string; score: string | null }>((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
            stockfish!.postMessage(`position fen ${fen}`);
            stockfish!.postMessage('go depth 15');
        }).then(
            (result) => self.postMessage({ type: 'moveResult', move: result.bestMove, score: result.score }),
            (error) => self.postMessage({ type: 'moveError', error: error.message })
        );
    }
};