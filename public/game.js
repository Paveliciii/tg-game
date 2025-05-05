const gameContainer = document.getElementById('game');
let board = [];
let gameOver = false;
let gameStarted = false;
let startTime = 0;
let timer = null;
let difficulty = 'easy';
let bestTimes = {
  easy: localStorage.getItem('bestTime_easy') || null,
  medium: localStorage.getItem('bestTime_medium') || null,
  hard: localStorage.getItem('bestTime_hard') || null
};

// Настройки для разных уровней сложности
const difficulties = {
  easy: { size: 5, mineCount: 5 },
  medium: { size: 8, mineCount: 12 },
  hard: { size: 10, mineCount: 20 }
};

// Состояние игры
let gridW; // ширина поля
let gridH; // высота поля
let numMines; // количество мин
let mines; // массив мин (1 - мина есть, 0 - мины нет)
let flags; // массив флагов (true - флаг установлен)
let revealed; // массив открытых клеток (true - клетка открыта)

// Добавляем переменные для отслеживания долгого нажатия
let longPressTimer;
let isLongPress = false;

// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Глобальные переменные
let gameBoard = [];
let moves = [];

// DOM элементы
const modal = document.getElementById('modal');
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const startBtn = document.getElementById('startBtn');
const helpBtn = document.getElementById('help');
const closeHelpBtn = document.getElementById('close-help');
const viewPastGamesBtn = document.getElementById('view-past-games');
const closeHistoryBtn = document.getElementById('close-history');
const helpContainer = document.getElementById('help-container');
const pastGamesContainer = document.getElementById('past-games-container');
const errorMessageDiv = document.getElementById('error-message');
const gameBoardDiv = document.getElementById('game-board');
const gameStatusDiv = document.getElementById('game-status');

// Обработчики событий
openModalBtn.addEventListener('click', () => modal.showModal());
closeModalBtn.addEventListener('click', () => modal.close());
startBtn.addEventListener('click', startNewGame);
helpBtn.addEventListener('click', () => helpContainer.style.display = 'block');
closeHelpBtn.addEventListener('click', () => helpContainer.style.display = 'none');
viewPastGamesBtn.addEventListener('click', showPastGames);
closeHistoryBtn.addEventListener('click', () => pastGamesContainer.style.display = 'none');

// Начальный экран с выбором сложности
function showDifficultySelection() {
  gameContainer.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = 'Выберите сложность:';
  gameContainer.appendChild(title);

  const difficultyButtons = document.createElement('div');
  difficultyButtons.className = 'difficulty-buttons';
  
  ['easy', 'medium', 'hard'].forEach(diff => {
    const button = document.createElement('button');
    button.textContent = diff === 'easy' ? 'Легкий' : diff === 'medium' ? 'Средний' : 'Сложный';
    button.className = 'difficulty-button';
    
    // Показываем лучшее время, если оно есть
    if (bestTimes[diff]) {
      button.textContent += ` (${formatTime(parseInt(bestTimes[diff]))})`;
    }
    
    button.addEventListener('click', () => {
      difficulty = diff;
      initGame();
    });
    
    difficultyButtons.appendChild(button);
  });
  
  gameContainer.appendChild(difficultyButtons);
}

// Форматирование времени в мм:сс
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Обновление таймера
function updateTimer() {
  if (!gameStarted || gameOver) return;
  
  const currentTime = Date.now() - startTime;
  document.getElementById('timer').textContent = formatTime(currentTime);
}

// Проверка выхода за пределы поля
function outBounds(x, y) {
  return x < 0 || y < 0 || x >= gridW || y >= gridH;
}

// Подсчет количества мин вокруг клетки
function calcNear(x, y) {
  if (outBounds(x, y)) return 0;
  let count = 0;
  for (let offsetX = -1; offsetX <= 1; offsetX++) {
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      if (outBounds(x + offsetX, y + offsetY)) continue;
      count += mines[x + offsetX][y + offsetY];
    }
  }
  return count;
}

// Открытие клетки
function reveal(x, y) {
  if (outBounds(x, y)) return;
  if (revealed[x][y]) return;
  if (flags[x][y]) return;

  revealed[x][y] = true;
  updateCellAppearance(x, y);

  if (calcNear(x, y) !== 0) return;

  // Если вокруг нет мин, открываем соседние клетки
  reveal(x - 1, y - 1);
  reveal(x - 1, y + 1);
  reveal(x + 1, y - 1);
  reveal(x + 1, y + 1);
  reveal(x - 1, y);
  reveal(x + 1, y);
  reveal(x, y - 1);
  reveal(x, y + 1);
}

// Обновление внешнего вида клетки
function updateCellAppearance(x, y) {
  const index = x * gridH + y;
  const cell = board[index];
  
  if (revealed[x][y]) {
    cell.classList.add('revealed');
    const nearCount = calcNear(x, y);
    if (nearCount > 0) {
      cell.textContent = nearCount;
      cell.classList.add(`cell-${nearCount}`);
    }
  }
}

// Размещение мин на поле
function placeMines(excludeX, excludeY) {
  let placed = 0;
  while (placed < numMines) {
    const x = Math.floor(Math.random() * gridW);
    const y = Math.floor(Math.random() * gridH);
    
    // Не ставим мину в клетку первого клика и вокруг неё
    if (Math.abs(x - excludeX) <= 1 && Math.abs(y - excludeY) <= 1) continue;
    
    if (mines[x][y] === 0) {
      mines[x][y] = 1;
      placed++;
    }
  }
}

// Очистка поля от мин
function clearMines() {
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      mines[x][y] = 0;
    }
  }
}

// Обработка клика по клетке
function handleCellClick(cell) {
  if (gameOver) return;
  
  const index = parseInt(cell.dataset.index);
  const x = Math.floor(index / gridH);
  const y = index % gridH;
  
  if (flags[x][y]) return;
  
  if (!gameStarted) {
    gameStarted = true;
    startTime = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(updateTimer, 1000);
    
    // Первый клик не должен быть на мину
    do {
      clearMines();
      placeMines(x, y);
    } while (calcNear(x, y) !== 0);
  }
  
  if (mines[x][y] === 1) {
    gameOver = true;
    revealAll();
    clearInterval(timer);
    tg.showAlert('💥 Бум! Игра окончена.');
  } else {
    reveal(x, y);
    checkWin();
  }
}

// Обработка установки флага
function toggleFlag(cell) {
  if (gameOver || !cell) return;
  
  const index = parseInt(cell.dataset.index);
  const x = Math.floor(index / gridH);
  const y = index % gridH;
  
  if (revealed[x][y]) return;
  
  if (!gameStarted) {
    gameStarted = true;
    startTime = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(updateTimer, 1000);
  }
  
  flags[x][y] = !flags[x][y];
  cell.classList.toggle('flagged');
  updateFlagCounter();
}

// Инициализация игры
function initGame() {
  const size = difficulties[difficulty].size;
  numMines = difficulties[difficulty].mineCount;
  gridW = size;
  gridH = size;
  
  // Инициализация массивов
  mines = Array(gridW).fill().map(() => Array(gridH).fill(0));
  flags = Array(gridW).fill().map(() => Array(gridH).fill(false));
  revealed = Array(gridW).fill().map(() => Array(gridH).fill(false));
  
  gameContainer.innerHTML = '';
  board = [];
  gameOver = false;
  gameStarted = false;
  
  // Создаем интерфейс
  createGameInterface();
  
  // Создаем игровое поле
  createGameBoard();
}

// Создание интерфейса игры
function createGameInterface() {
  const gameHeader = document.createElement('div');
  gameHeader.className = 'game-header';
  
  const flagCounter = document.createElement('div');
  flagCounter.id = 'flag-counter';
  flagCounter.textContent = numMines;
  
  const timerDisplay = document.createElement('div');
  timerDisplay.id = 'timer';
  timerDisplay.textContent = '00:00';
  
  const restartButton = document.createElement('button');
  restartButton.id = 'restart-button';
  restartButton.textContent = '🔄';
  restartButton.addEventListener('click', () => {
    clearInterval(timer);
    initGame();
  });
  
  const backButton = document.createElement('button');
  backButton.id = 'back-button';
  backButton.textContent = '⬅️';
  backButton.addEventListener('click', () => {
    clearInterval(timer);
    showDifficultySelection();
  });
  
  gameHeader.appendChild(flagCounter);
  gameHeader.appendChild(timerDisplay);
  gameHeader.appendChild(restartButton);
  gameHeader.appendChild(backButton);
  
  gameContainer.appendChild(gameHeader);
}

// Создание игрового поля
function createGameBoard() {
  const boardElement = document.createElement('div');
  boardElement.id = 'board';
  boardElement.style.gridTemplateColumns = `repeat(${gridW}, 40px)`;
  
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.index = x * gridH + y;
      
      cell.addEventListener('click', () => handleCellClick(cell));
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(cell);
      });
      
      // Поддержка мобильных устройств
      let touchTimeout;
      cell.addEventListener('touchstart', () => {
        touchTimeout = setTimeout(() => {
          toggleFlag(cell);
        }, 500);
      });
      
      cell.addEventListener('touchend', (e) => {
        if (touchTimeout) {
          clearTimeout(touchTimeout);
          handleCellClick(cell);
        }
      });
      
      cell.addEventListener('touchmove', () => {
        if (touchTimeout) {
          clearTimeout(touchTimeout);
        }
      });
      
      boardElement.appendChild(cell);
      board.push(cell);
    }
  }
  
  gameContainer.appendChild(boardElement);
}

// Обновление счетчика флажков
function updateFlagCounter() {
  let flagCount = 0;
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      if (flags[x][y]) flagCount++;
    }
  }
  document.getElementById('flag-counter').textContent = numMines - flagCount;
}

// Открыть все ячейки при окончании игры
function revealAll() {
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      const index = x * gridH + y;
      const cell = board[index];
      
      if (mines[x][y] === 1) {
        cell.classList.add('mine');
        if (flags[x][y]) {
          cell.classList.add('correct-flag');
        }
      } else if (flags[x][y]) {
        cell.classList.add('wrong-flag');
      }
      
      if (!revealed[x][y] && !flags[x][y]) {
        revealed[x][y] = true;
        updateCellAppearance(x, y);
      }
    }
  }
}

// Проверка победы
function checkWin() {
  let unrevealedSafeCells = 0;
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      if (!revealed[x][y] && mines[x][y] === 0) {
        unrevealedSafeCells++;
      }
    }
  }
  
  if (unrevealedSafeCells === 0) {
    gameOver = true;
    clearInterval(timer);
    
    // Помечаем все мины флажками
    for (let x = 0; x < gridW; x++) {
      for (let y = 0; y < gridH; y++) {
        if (mines[x][y] === 1 && !flags[x][y]) {
          flags[x][y] = true;
          board[x * gridH + y].classList.add('flagged');
        }
      }
    }
    
    const gameTime = Date.now() - startTime;
    let newRecord = false;
    
    if (!bestTimes[difficulty] || gameTime < parseInt(bestTimes[difficulty])) {
      bestTimes[difficulty] = gameTime.toString();
      localStorage.setItem(`bestTime_${difficulty}`, gameTime);
      newRecord = true;
    }
    
    const message = newRecord 
      ? `🎉 Победа! Новый рекорд: ${formatTime(gameTime)}!` 
      : `🎉 Победа! Ваше время: ${formatTime(gameTime)}. Рекорд: ${formatTime(parseInt(bestTimes[difficulty]))}`;
    
    tg.showAlert(message);
  }
}

// Функция начала новой игры
function startNewGame() {
    width = parseInt(document.getElementById('width').value);
    height = parseInt(document.getElementById('height').value);
    mineCount = parseInt(document.getElementById('mines').value);

    if (mineCount >= width * height) {
        showError('Количество мин не может быть больше или равно количеству клеток');
        return;
    }

    if (width < 5 || height < 5 || width > 16 || height > 16) {
        showError('Размер поля должен быть от 5x5 до 16x16');
        return;
    }

    modal.close();
    initializeGame();
}

// Инициализация игры
function initializeGame() {
    gameOver = false;
    moves = [];
    revealed = Array(width).fill().map(() => Array(height).fill(false));
    mines = Array(width).fill().map(() => Array(height).fill(false));
    gameBoard = [];
    
    // Очищаем статус игры
    gameStatusDiv.textContent = '';
    
    // Создаем игровое поле
    createBoard();
    
    // Размещаем мины
    placeMines();
}

// Создание игрового поля
function createBoard() {
    gameBoardDiv.innerHTML = '';
    gameBoardDiv.style.gridTemplateColumns = `repeat(${width}, 35px)`;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            cell.addEventListener('click', () => handleClick(x, y));
            
            gameBoardDiv.appendChild(cell);
            gameBoard.push(cell);
        }
    }
}

// Размещение мин
function placeMines() {
    let placedMines = 0;
    while (placedMines < mineCount) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        
        if (!mines[x][y]) {
            mines[x][y] = true;
            placedMines++;
        }
    }
}

// Обработка клика по клетке
function handleClick(x, y) {
    if (gameOver || revealed[x][y]) return;
    
    // Записываем ход
    moves.push({ x, y, result: mines[x][y] ? 'Мина' : 'Безопасно' });
    
    if (mines[x][y]) {
        gameOver = true;
        revealAll();
        gameStatusDiv.textContent = '💥 Игра окончена!';
        tg.showPopup({
            title: 'Игра окончена',
            message: '💥 Вы попали на мину!',
            buttons: [{
                type: 'ok',
                text: 'Новая игра'
            }]
        }).then(() => {
            modal.showModal();
        });
        saveGame(false);
    } else {
        reveal(x, y);
        if (checkWin()) {
            gameOver = true;
            gameStatusDiv.textContent = '🎉 Победа!';
            tg.showPopup({
                title: 'Победа!',
                message: '🎉 Поздравляем! Вы нашли все мины!',
                buttons: [{
                    type: 'ok',
                    text: 'Новая игра'
                }]
            }).then(() => {
                modal.showModal();
            });
            saveGame(true);
        }
    }
}

// Открытие клетки
function reveal(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height || revealed[x][y]) return;
    
    revealed[x][y] = true;
    const cell = gameBoard[x * height + y];
    cell.classList.add('revealed');
    
    const nearbyMines = countNearbyMines(x, y);
    if (nearbyMines === 0) {
        // Если рядом нет мин, открываем соседние клетки
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                reveal(x + dx, y + dy);
            }
        }
    } else {
        cell.textContent = nearbyMines;
        cell.classList.add(`color-${nearbyMines}`);
    }
}

// Подсчет мин вокруг клетки
function countNearbyMines(x, y) {
    let count = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < width && newY >= 0 && newY < height && mines[newX][newY]) {
                count++;
            }
        }
    }
    return count;
}

// Открытие всех клеток
function revealAll() {
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const cell = gameBoard[x * height + y];
            cell.classList.add('revealed');
            if (mines[x][y]) {
                cell.classList.add('mine');
            } else {
                const nearbyMines = countNearbyMines(x, y);
                if (nearbyMines > 0) {
                    cell.textContent = nearbyMines;
                    cell.classList.add(`color-${nearbyMines}`);
                }
            }
        }
    }
}

// Проверка победы
function checkWin() {
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            if (!mines[x][y] && !revealed[x][y]) return false;
        }
    }
    return true;
}

// Сохранение игры
function saveGame(isWin) {
    const gameData = {
        timestamp: new Date().toISOString(),
        size: `${width}x${height}`,
        mines: mineCount,
        moves: moves,
        result: isWin ? 'Победа' : 'Поражение'
    };
    
    let games = JSON.parse(localStorage.getItem('minesweeper_games') || '[]');
    games.unshift(gameData);
    localStorage.setItem('minesweeper_games', JSON.stringify(games.slice(0, 10))); // Храним только 10 последних игр
}

// Показ прошлых игр
function showPastGames() {
    const games = JSON.parse(localStorage.getItem('minesweeper_games') || '[]');
    const gameList = document.getElementById('game-list');
    gameList.innerHTML = '';
    
    games.forEach(game => {
        const li = document.createElement('li');
        const date = new Date(game.timestamp);
        li.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} - ${game.size} - ${game.mines} мин - ${game.result}`;
        gameList.appendChild(li);
    });
    
    pastGamesContainer.style.display = 'block';
}

// Вспомогательные функции
function showError(message) {
    errorMessageDiv.textContent = message;
}

// Инициализация при загрузке страницы
modal.showModal();

// Запускаем игру с экрана выбора сложности
showDifficultySelection();