/// <reference lib="webworker" />

let stockfish: Worker | null = null;
let resolvePromise: ((value: string) => void) | null = null;
let rejectPromise: ((reason?: unknown) => void) | null = null;

function initStockfish() {
    if (stockfish) return; 

    stockfish = new Worker('/stockfish/stockfish.js');

    stockfish.onmessage = (event) => {
        const message = event.data;
        // console.log("Stockfish message:", message); // Debugging

        if (message.startsWith('bestmove')) {
            if (resolvePromise) {
                const bestMove = message.split(' ')[1];
                resolvePromise(bestMove);
                resolvePromise = null;
                rejectPromise = null;
            }
        }
    };

    stockfish.onerror = (error) => {
        console.error("Stockfish Worker Error:", error);
        if (rejectPromise) {
            rejectPromise(error);
            rejectPromise = null;
        }
    };

    // Send UCI commands to initialize Stockfish
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
}

self.onmessage = (event) => {
    const { command, fen } = event.data;

    if (command === 'init') {
        initStockfish();
    } else if (command === 'getBestMove' && stockfish) {
        if (resolvePromise || rejectPromise) {
            console.warn("Already awaiting a move. Ignoring new request.");
            return;
        }

        return new Promise<string>((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;

            stockfish!.postMessage(`position fen ${fen}`);
            stockfish!.postMessage('go depth 15'); 
        }).then(
            (move) => self.postMessage({ type: 'moveResult', move }),
            (error) => self.postMessage({ type: 'moveError', error: error.message })
        );
    }
};