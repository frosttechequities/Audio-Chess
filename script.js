document.addEventListener('DOMContentLoaded', () => {

    // --- Global State and Constants ---
    const game = new Chess();
    let currentMode = 'play'; // 'play', 'square_trainer', 'move_executor', 'vision_trainer'
    let isAiEnabled = false;
    let aiDifficulty = 2;
    let targetSquare = null; // for square_trainer
    let targetMove = null; // for move_executor
    let promotionData = null; // { from, to } for pending promotion

    const PIECE_UNICODE = {
        'w': { 'p': '♙', 'r': '♖', 'n': '♘', 'b': '♗', 'q': '♕', 'k': '♔' },
        'b': { 'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚' }
    };
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 900 };

    // --- UI Element Selectors ---
    const boardElement = document.getElementById('board');
    const moveHistoryElement = document.getElementById('moveHistory');
    const gameStatusElement = document.getElementById('gameStatus');
    const promotionModal = document.querySelector('.promotion-modal');
    const promotionOptionsContainer = document.querySelector('.promotion-options');
    const peekBtn = document.getElementById('peek-btn');
    const toggleAiBtn = document.getElementById('toggle-ai-btn');
    const voiceControlBtn = document.getElementById('voice-control-btn');
    const voiceStatusElement = document.getElementById('voice-status');
    const aiDifficultySlider = document.getElementById('ai-difficulty-slider');
    const aiDifficultyLabel = document.getElementById('ai-difficulty-label');

    // --- Speech Recognition & Synthesis ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const synth = window.speechSynthesis;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    }

    // ===================================================================
    //                          CORE UI & GAME LOGIC
    // ===================================================================

    function createBoard() {
        boardElement.innerHTML = '';
        for (let i = 0; i < 64; i++) {
            const square = document.createElement('div');
            const row = 7 - Math.floor(i / 8);
            const col = i % 8;
            square.dataset.square = String.fromCharCode(97 + col) + (row + 1);
            square.classList.add('square', (row + col) % 2 === 0 ? 'dark' : 'light');
            boardElement.appendChild(square);
        }
    }

    function renderPieces() {
        document.querySelectorAll('.piece').forEach(p => p.remove());
        game.board().forEach((row, rowIndex) => {
            row.forEach((piece, colIndex) => {
                if (piece) {
                    const squareName = String.fromCharCode(97 + colIndex) + (8 - rowIndex);
                    const squareEl = document.querySelector(`[data-square="${squareName}"]`);
                    const pieceEl = document.createElement('div');
                    pieceEl.classList.add('piece', `${piece.color === 'w' ? 'white' : 'black'}-piece`);
                    pieceEl.innerText = PIECE_UNICODE[piece.color][piece.type];
                    squareEl.appendChild(pieceEl);
                }
            });
        });
    }

    function updateGameStatus() {
        let status = '';
        const turn = game.turn() === 'w' ? 'White' : 'Black';

        if (game.in_checkmate()) {
            status = `Checkmate! ${turn === 'White' ? 'Black' : 'White'} wins.`;
        } else if (game.in_draw()) {
            status = 'Draw!';
        } else {
            status = `${turn}'s turn`;
            if (game.in_check()) status += ' - Check!';
        }
        gameStatusElement.textContent = status;
        updateMoveHistory();
    }

    function updateMoveHistory() {
        moveHistoryElement.innerHTML = '';
        const history = game.history({ verbose: true });
        for (let i = 0; i < history.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = history[i] ? history[i].san : '';
            const blackMove = history[i+1] ? history[i+1].san : '';
            const moveEntry = document.createElement('div');
            moveEntry.innerHTML = `<span>${moveNumber}.</span> ${whiteMove} <span>${blackMove}</span>`;
            moveHistoryElement.appendChild(moveEntry);
        }
        moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
    }

    function highlightLastMove() {
        document.querySelectorAll('.last-move').forEach(el => el.classList.remove('last-move'));
        const history = game.history({ verbose: true });
        const lastMove = history[history.length - 1];
        if (lastMove) {
            document.querySelector(`[data-square="${lastMove.from}"]`).classList.add('last-move');
            document.querySelector(`[data-square="${lastMove.to}"]`).classList.add('last-move');
        }
    }

    function speak(text) {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }

    // ===================================================================
    //                          PLAYER INPUT HANDLING
    // ===================================================================

    let selectedSquare = null;

    function handleSquareClick(e) {
        const squareElement = e.currentTarget;
        const squareName = squareElement.dataset.square;

        // --- Handle Clicks in Different Game Modes ---
        if (currentMode === 'square_trainer') {
            handleSquareTrainerClick(squareElement, squareName);
            return;
        }

        if (currentMode === 'move_executor') {
            handleMoveExecutorClick(squareElement, squareName);
            return;
        }

        // --- Default 'play' mode logic ---
        if (selectedSquare) {
            const from = selectedSquare.dataset.square;
            const to = squareName;

            // Check for promotion
            const piece = game.get(from);
            if (piece.type === 'p' && (to.endsWith('8') || to.endsWith('1'))) {
                promotionData = { from, to };
                promptForPromotion(piece.color);
                return; // Wait for promotion choice
            }

            makeMove(from, to);
            resetSelection();
        } else {
            const piece = game.get(squareName);
            if (piece && piece.color === game.turn()) {
                selectedSquare = squareElement;
                selectedSquare.classList.add('selected');
                highlightPossibleMoves(squareName);
            }
        }
    }

    function makeMove(from, to, promotion) {
        const move = game.move({ from, to, promotion });
        if (move) {
            renderPieces();
            updateGameStatus();
            highlightLastMove();
            new Audio('https://freesound.org/data/previews/240/240776_4019028-lq.mp3').play();

            if (isAiEnabled && game.turn() === 'b') {
                setTimeout(makeAiMove, 500);
            }
        }
        return move;
    }

    function resetSelection() {
        if (selectedSquare) selectedSquare.classList.remove('selected');
        selectedSquare = null;
        document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    }

    function highlightPossibleMoves(square) {
        const moves = game.moves({ square: square, verbose: true });
        moves.forEach(move => {
            document.querySelector(`[data-square="${move.to}"]`).classList.add('highlight');
        });
    }

    function promptForPromotion(color) {
        promotionOptionsContainer.innerHTML = '';
        ['q', 'r', 'b', 'n'].forEach(type => {
            const option = document.createElement('div');
            option.classList.add('promotion-option', `${color === 'w' ? 'white' : 'black'}-piece`);
            option.innerText = PIECE_UNICODE[color][type];
            option.dataset.type = type;
            promotionOptionsContainer.appendChild(option);
        });
        promotionModal.style.display = 'grid';
    }

    function handlePromotionChoice(e) {
        const promotion = e.target.dataset.type;
        if (promotion && promotionData) {
            makeMove(promotionData.from, promotionData.to, promotion);
        }
        promotionData = null;
        promotionModal.style.display = 'none';
        resetSelection();
    }

    // ===================================================================
    //                             VOICE CONTROL
    // ===================================================================

    function handleVoiceCommand(command) {
        voiceStatusElement.textContent = `Recognized: "${command}"`;
        let moveStr = command.replace(/[\.\,]/g, '').replace(/\s/g,'');

        const result = game.move(moveStr, { sloppy: true });

        if (result) {
            voiceStatusElement.textContent = `Played ${result.san}.`;
            renderPieces();
            updateGameStatus();
            highlightLastMove();
            new Audio('https://freesound.org/data/previews/240/240776_4019028-lq.mp3').play();

            if (isAiEnabled && game.turn() === 'b') {
                setTimeout(makeAiMove, 500);
            }
        } else {
            voiceStatusElement.textContent = `Invalid move: "${command}". Try again.`;
        }
    }

    // ===================================================================
    //                              AI LOGIC
    // ===================================================================

    function makeAiMove() {
        if (game.game_over()) return;

        const bestMove = getBestMove(game, aiDifficulty);
        const moveResult = bestMove ? game.move(bestMove) : null;

        if (moveResult) {
            let announcement = `My move is ${moveResult.san}.`;
            if (document.getElementById('tutor-commentary-checkbox').checked) {
                const commentary = getTutorCommentary(moveResult);
                if (commentary) announcement += ` ${commentary}`;
            }
            speak(announcement);
        }

        renderPieces();
        updateGameStatus();
        highlightLastMove();
    }

    function getTutorCommentary(move) {
        const comments = [];
        if (move.flags.includes('c')) comments.push('That was a capture.');
        if (game.in_check()) comments.push('Putting your king in check.');
        if (move.piece === 'p' && (move.to.includes('e4') || move.to.includes('d4'))) comments.push('Controlling the center.');
        return comments.length > 0 ? comments[Math.floor(Math.random() * comments.length)] : '';
    }

    function getBestMove(game, depth) {
        let bestMove = null;
        let bestValue = -Infinity;
        const possibleMoves = game.moves({ verbose: true });

        if (possibleMoves.length === 0) return null;

        for (const move of possibleMoves) {
            game.move(move.san);
            const boardValue = minimax(game, depth - 1, -Infinity, Infinity, false);
            game.undo();
            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = move;
            }
        }
        return bestMove;
    }

    function minimax(game, depth, alpha, beta, isMaximizingPlayer) {
        if (depth === 0 || game.game_over()) {
            return evaluateBoard(game);
        }

        const moves = game.moves();
        if (isMaximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of moves) {
                game.move(move);
                const evaluation = minimax(game, depth - 1, alpha, beta, false);
                game.undo();
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else { // Minimizing player (White)
            let minEval = Infinity;
            for (const move of moves) {
                game.move(move);
                const evaluation = minimax(game, depth - 1, alpha, beta, true);
                game.undo();
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    function evaluateBoard(game) {
        let totalEvaluation = 0;
        game.board().forEach(row => {
            row.forEach(piece => {
                if (!piece) return;
                const value = pieceValues[piece.type] || 0;
                totalEvaluation += (piece.color === 'b') ? value : -value; // AI is black
            });
        });
        return totalEvaluation;
    }

    // ===================================================================
    //                           DRILL LOGIC
    // ===================================================================

    function startSquareTrainer() {
        resetToMode('square_trainer');
        gameStatusElement.textContent = 'Square Trainer Mode';
        speak('Square trainer started. Tap the square I call out.');
        setTimeout(nextSquareDrill, 2000);
    }

    function nextSquareDrill() {
        if (currentMode !== 'square_trainer') return;
        const col = Math.floor(Math.random() * 8);
        const row = Math.floor(Math.random() * 8);
        targetSquare = String.fromCharCode(97 + col) + (row + 1);
        speak(targetSquare);
        voiceStatusElement.textContent = `Find: ${targetSquare}`;
    }

    function handleSquareTrainerClick(squareElement, squareName) {
        if (squareName === targetSquare) {
            speak('Correct!');
            squareElement.classList.add('correct');
            setTimeout(() => {
                squareElement.classList.remove('correct');
                nextSquareDrill();
            }, 500);
        } else {
            speak(`That's ${squareName}. Try again.`);
            squareElement.classList.add('incorrect');
            setTimeout(() => squareElement.classList.remove('incorrect'), 500);
        }
    }

    const drillPuzzles = [
        { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', move: { from: 'f1', to: 'c4' }, instruction: 'Play Bishop to c4' },
        { fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', move: { from: 'g1', to: 'f3' }, instruction: 'Develop your knight to f3' }
    ];

    function startMoveExecutor() {
        resetToMode('move_executor');
        gameStatusElement.textContent = 'Move Executor Mode';
        speak('Move executor started. Play the move I announce.');
        setTimeout(nextMoveDrill, 2000);
    }

    function nextMoveDrill() {
        if (currentMode !== 'move_executor') return;
        const puzzle = drillPuzzles[Math.floor(Math.random() * drillPuzzles.length)];
        targetMove = puzzle.move;
        game.load(puzzle.fen);
        renderPieces();
        speak(puzzle.instruction);
        voiceStatusElement.textContent = `Task: ${puzzle.instruction}`;
    }

    function handleMoveExecutorClick(squareElement, squareName) {
        if (selectedSquare) {
            const from = selectedSquare.dataset.square;
            const to = squareName;
            if (from === targetMove.from && to === targetMove.to) {
                game.move({ from, to });
                renderPieces();
                highlightLastMove();
                speak("Correct!");
                setTimeout(nextMoveDrill, 1500);
            } else {
                speak("Incorrect move. Try again.");
            }
            resetSelection();
        } else {
            const piece = game.get(squareName);
            if (piece) {
                selectedSquare = squareElement;
                selectedSquare.classList.add('selected');
            }
        }
    }

    function startVisionTrainer() {
        resetToMode('vision_trainer');
        isAiEnabled = true;
        boardElement.classList.add('vision-mode-active');
        peekBtn.style.display = 'inline-block';
        toggleAiBtn.disabled = true;
        gameStatusElement.textContent = 'Vision Trainer (Blindfold)';
        speak('Vision trainer started. Pieces are hidden. Speak your move.');
    }

    // ===================================================================
    //                      INITIALIZATION & EVENT LISTENERS
    // ===================================================================

    function resetToMode(newMode) {
        currentMode = newMode;
        isAiEnabled = false;
        targetSquare = null;
        targetMove = null;
        promotionData = null;
        if (synth.speaking) synth.cancel();

        // Reset UI elements
        boardElement.classList.remove('vision-mode-active', 'peeking');
        peekBtn.style.display = 'none';
        toggleAiBtn.disabled = false;
        toggleAiBtn.textContent = 'Play vs AI';
        promotionModal.style.display = 'none';
        resetSelection();

        // Reset game state
        if (newMode === 'play' || newMode === 'vision_trainer') {
            game.reset();
        } else {
            game.clear();
        }
        renderPieces();
        updateGameStatus();
        voiceStatusElement.textContent = 'Click the mic to speak your move.';
    }

    function setupEventListeners() {
        // Board
        boardElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('square')) {
                handleSquareClick(e);
            }
        });

        // Promotion
        promotionOptionsContainer.addEventListener('click', handlePromotionChoice);

        // Controls
        document.getElementById('newGame').addEventListener('click', () => resetToMode('play'));
        document.getElementById('undoMove').addEventListener('click', () => {
            if (currentMode === 'play') {
                game.undo();
                if (isAiEnabled) game.undo(); // Undo AI move as well
                renderPieces();
                updateGameStatus();
            }
        });
        toggleAiBtn.addEventListener('click', (e) => {
            isAiEnabled = !isAiEnabled;
            e.target.textContent = isAiEnabled ? 'Play vs Human' : 'Play vs AI';
            resetToMode('play');
        });

        // Drills
        document.getElementById('square-trainer-btn').addEventListener('click', startSquareTrainer);
        document.getElementById('move-executor-btn').addEventListener('click', startMoveExecutor);
        document.getElementById('vision-trainer-btn').addEventListener('click', startVisionTrainer);
        peekBtn.addEventListener('click', () => {
            if (currentMode !== 'vision_trainer') return;
            boardElement.classList.add('peeking');
            setTimeout(() => boardElement.classList.remove('peeking'), 2000);
        });

        // Voice
        if (recognition) {
            voiceControlBtn.addEventListener('click', () => recognition.start());
            recognition.onstart = () => {
                voiceStatusElement.textContent = 'Listening...';
                voiceControlBtn.classList.add('listening');
            };
            recognition.onend = () => {
                voiceStatusElement.textContent = 'Click mic to speak move.';
                voiceControlBtn.classList.remove('listening');
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.trim();
                handleVoiceCommand(transcript);
            };
        }

        // Settings
        aiDifficultySlider.addEventListener('input', (e) => {
            aiDifficulty = parseInt(e.target.value, 10);
            aiDifficultyLabel.textContent = aiDifficulty;
        });
    }

    // --- Start the application ---
    createBoard();
    resetToMode('play');
    setupEventListeners();
});