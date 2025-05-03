const gameContainer = document.getElementById('game');
const size = 5;
const mineCount = 5;

let board = [];
let gameOver = false;

// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

function initGame() {
  gameContainer.innerHTML = '';
  board = [];
  gameOver = false;

  // Generate mines
  const mines = new Set();
  while (mines.size < mineCount) {
    mines.add(Math.floor(Math.random() * size * size));
  }

  // Create board
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;
    cell.dataset.mine = mines.has(i) ? 'true' : 'false';

    // Left click to reveal
    cell.addEventListener('click', () => {
      if (gameOver || cell.classList.contains('revealed') || cell.classList.contains('flagged')) return;
      
      if (cell.dataset.mine === 'true') {
        revealAll();
        gameOver = true;
        tg.showAlert('💥 Бум! Игра окончена.');
      } else {
        revealCell(cell);
        checkWin();
      }
    });

    // Right click to flag
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (gameOver || cell.classList.contains('revealed')) return;
      
      cell.classList.toggle('flagged');
    });

    gameContainer.appendChild(cell);
    board.push(cell);
  }
}

function revealCell(cell) {
  if (cell.classList.contains('revealed')) return;
  
  cell.classList.add('revealed');
  const index = parseInt(cell.dataset.index);
  const row = Math.floor(index / size);
  const col = index % size;
  
  // Count adjacent mines
  let count = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const newRow = row + i;
      const newCol = col + j;
      if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
        const adjacentIndex = newRow * size + newCol;
        if (board[adjacentIndex].dataset.mine === 'true') {
          count++;
        }
      }
    }
  }
  
  if (count > 0) {
    cell.textContent = count;
  } else {
    // Reveal adjacent cells if no mines nearby
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const newRow = row + i;
        const newCol = col + j;
        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
          const adjacentIndex = newRow * size + newCol;
          revealCell(board[adjacentIndex]);
        }
      }
    }
  }
}

function revealAll() {
  board.forEach(cell => {
    if (cell.dataset.mine === 'true') {
      cell.classList.add('mine');
    }
  });
}

function checkWin() {
  const unrevealed = board.filter(cell => !cell.classList.contains('revealed')).length;
  if (unrevealed === mineCount) {
    gameOver = true;
    tg.showAlert('🎉 Победа!');
  }
}

// Initialize the game
initGame(); 