// Fast manual clone for an 8x8 board (each row is a shallow copy)
function cloneBoard(board) {
    return board.map(row => row.slice());
}

// Manually clone the parts of the state we care about (we store history separately)
function cloneState(state) {
    return {
        board: cloneBoard(state.board),
        currentPlayer: state.currentPlayer,
        moveHistory: state.moveHistory.slice(),
        gameOver: state.gameOver,
        enPassantTarget: state.enPassantTarget ? { row: state.enPassantTarget.row, col: state.enPassantTarget.col } : null,
        castlingRights: { ...state.castlingRights },
        timers: { w: state.timers.w, b: state.timers.b }
    };
}

// Sound effects (feel free to replace URLs with your own sound files)
const moveSound = new Audio('https://freesound.org/data/previews/240/240776_4019028-lq.mp3');
const captureSound = new Audio('https://freesound.org/data/previews/131/131660_2398400-lq.mp3');

const PIECE_IMAGES = {
    'w': { 'p': '♙', 'r': '♖', 'n': '♘', 'b': '♗', 'q': '♕', 'k': '♔' },
    'b': { 'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚' }
};

class ChessGame {
    constructor() {
        this.boardElement = document.getElementById('board');
        this.moveHistoryElement = document.getElementById('moveHistory');
        this.gameStatusElement = document.getElementById('gameStatus');
        this.whiteTimerElement = document.getElementById('whiteTime');
        this.blackTimerElement = document.getElementById('blackTime');
        this.promotionModal = document.querySelector('.promotion-modal');
        this.promotionCallback = null;
        this.draggedPiece = null;
        this.selectedSquare = null; // for click-based moves

        // initial state
        this.initialState = {
            board: [
                ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
                ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
                ["", "", "", "", "", "", "", ""],
                ["", "", "", "", "", "", "", ""],
                ["", "", "", "", "", "", "", ""],
                ["", "", "", "", "", "", "", ""],
                ["wP", "w极
[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]
