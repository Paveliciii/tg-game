const gameContainer = document.getElementById('game');
let timer = null;
let difficulty = 'easy';
let bestTimes = {
  easy: localStorage.getItem('bestTime_easy') || null,
  medium: localStorage.getItem('bestTime_medium') || null,
  hard: localStorage.getItem('bestTime_hard') || null
};

// Настройки для разных уровней сложности
const difficulties = {
  easy: { size: 8, mineCount: 10 },
  medium: { size: 10, mineCount: 15 },
  hard: { size: 12, mineCount: 25 }
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

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Глобальные переменные состояния игры
const gameState = {
    width: 0,
    height: 0,
    mineCount: 0,
    mines: [],
    revealed: [],
    flags: [],
    gameBoard: [],
    gameOver: false,
    gameStarted: false,
    startTime: 0,
    isFlagMode: false,
    remainingMines: 0,
    difficulty: 'easy',
    bestTimes: {
        easy: localStorage.getItem('bestTime_easy') || null,
        medium: localStorage.getItem('bestTime_medium') || null,
        hard: localStorage.getItem('bestTime_hard') || null
    }
};

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
const flagModeBtn = document.getElementById('flag-mode');
const minesCounter = document.getElementById('mines-counter');

// Обработчики событий
openModalBtn.addEventListener('click', () => modal.showModal());
closeModalBtn.addEventListener('click', () => modal.close());
startBtn.addEventListener('click', startNewGame);
helpBtn.addEventListener('click', () => helpContainer.style.display = 'block');
closeHelpBtn.addEventListener('click', () => helpContainer.style.display = 'none');
viewPastGamesBtn.addEventListener('click', showPastGames);
closeHistoryBtn.addEventListener('click', () => pastGamesContainer.style.display = 'none');
flagModeBtn.addEventListener('click', toggleFlagMode);

// Переключение режима флажков
function toggleFlagMode() {
    gameState.isFlagMode = !gameState.isFlagMode;
    flagModeBtn.classList.toggle('active');
}

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
    if (gameState.bestTimes[diff]) {
      button.textContent += ` (${formatTime(parseInt(gameState.bestTimes[diff]))})`;
    }
    
    button.addEventListener('click', () => {
      gameState.difficulty = diff;
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
    if (!gameState.gameStarted || gameState.gameOver) return;
    
    const currentTime = Date.now() - gameState.startTime;
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = formatTime(currentTime);
    }
}

// Запуск таймера
function startTimer() {
    if (timer) {
        clearInterval(timer);
    }
    gameState.startTime = Date.now();
    gameState.gameStarted = true;
    timer = setInterval(updateTimer, 1000);
    updateTimer(); // Немедленное обновление для избежания задержки
}

// Остановка таймера
function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
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
  console.log('Revealing:', x, y);
  
  if (x < 0 || x >= gridW || y < 0 || y >= gridH || 
      revealed[x][y] || flags[x][y]) {
    return;
  }
  
  const cellIndex = x * gridH + y;
  const cell = mines[cellIndex];
  
  revealed[x][y] = true;
  cell.classList.add('revealed');
  
  const nearbyMines = calcNear(x, y);
  console.log('Nearby mines:', nearbyMines);
  
  if (nearbyMines === 0) {
    // Если рядом нет мин, открываем соседние клетки
    reveal(x - 1, y - 1);
    reveal(x - 1, y + 1);
    reveal(x + 1, y - 1);
    reveal(x + 1, y + 1);
    reveal(x - 1, y);
    reveal(x + 1, y);
    reveal(x, y - 1);
    reveal(x, y + 1);
  } else {
    cell.textContent = nearbyMines;
    cell.classList.add(`cell-${nearbyMines}`);
  }
}

// Обновление внешнего вида клетки
function updateCellAppearance(x, y) {
  const index = x * gridH + y;
  const cell = mines[index];
  
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
function handleCellClick(x, y) {
  console.log('Click handler called:', x, y, gameState); // Отладочный вывод
  
  if (gameState.gameOver) {
    console.log('Game is over');
    return;
  }
  
  const cellIndex = x * gridH + y;
  const cell = mines[cellIndex];
  
  // Если клетка уже открыта и на ней цифра, пробуем открыть соседние клетки
  if (revealed[x][y] && cell.textContent) {
    handleChordClick(x, y);
    return;
  }
  
  // Если режим флажков активен
  if (gameState.isFlagMode) {
    toggleFlag(x, y);
    return;
  }
  
  // Нельзя открывать клетки с флажками
  if (flags[x][y]) {
    console.log('Cell is flagged');
    return;
  }
  
  console.log('Revealing cell:', x, y);
  
  if (mines[x][y]) {
    // Попали на мину
    gameState.gameOver = true;
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
      gameState.gameOver = true;
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

// Обработка установки флага
function toggleFlag(x, y) {
  if (revealed[x][y]) return;
  
  const cell = mines[x * gridH + y];
  
  if (flags[x][y]) {
    flags[x][y] = false;
    cell.classList.remove('flagged');
    gameState.remainingMines++;
  } else {
    if (gameState.remainingMines > 0) {
      flags[x][y] = true;
      cell.classList.add('flagged');
      gameState.remainingMines--;
    } else {
      tg.showAlert('Все флажки уже использованы!');
      return;
    }
  }
  
  updateMinesCounter();
}

// Инициализация игры
function initGame() {
  const size = difficulties[gameState.difficulty].size;
  numMines = difficulties[gameState.difficulty].mineCount;
  gridW = size;
  gridH = size;
  
  // Инициализация массивов
  mines = Array(gridW).fill().map(() => Array(gridH).fill(0));
  flags = Array(gridW).fill().map(() => Array(gridH).fill(false));
  revealed = Array(gridW).fill().map(() => Array(gridH).fill(false));
  
  gameContainer.innerHTML = '';
  gameState.gameBoard = [];
  gameState.gameOver = false;
  gameState.gameStarted = false;
  
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
      
      cell.addEventListener('click', (e) => handleCellClick(x, y, e));
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(x, y);
      });
      
      // Поддержка мобильных устройств
      let touchTimeout;
      cell.addEventListener('touchstart', () => {
        touchTimeout = setTimeout(() => {
          toggleFlag(x, y);
        }, 500);
      });
      
      cell.addEventListener('touchend', (e) => {
        if (touchTimeout) {
          clearTimeout(touchTimeout);
          handleCellClick(x, y, e);
        }
      });
      
      cell.addEventListener('touchmove', () => {
        if (touchTimeout) {
          clearTimeout(touchTimeout);
        }
      });
      
      boardElement.appendChild(cell);
      gameState.gameBoard.push(cell);
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
      const cell = mines[index];
      
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
    gameState.gameOver = true;
    stopTimer();
    
    // Помечаем все мины флажками
    for (let x = 0; x < gridW; x++) {
      for (let y = 0; y < gridH; y++) {
        if (mines[x][y] === 1 && !flags[x][y]) {
          flags[x][y] = true;
          mines[x * gridH + y].classList.add('flagged');
        }
      }
    }
    
    const gameTime = Date.now() - gameState.startTime;
    let newRecord = false;
    
    if (!gameState.bestTimes[gameState.difficulty] || gameTime < parseInt(gameState.bestTimes[gameState.difficulty])) {
      gameState.bestTimes[gameState.difficulty] = gameTime.toString();
      localStorage.setItem(`bestTime_${gameState.difficulty}`, gameTime);
      newRecord = true;
    }
    
    const message = newRecord 
      ? `🎉 Победа! Новый рекорд: ${formatTime(gameTime)}!` 
      : `🎉 Победа! Ваше время: ${formatTime(gameTime)}. Рекорд: ${formatTime(parseInt(gameState.bestTimes[gameState.difficulty]))}`;
    
    tg.showAlert(message);
  }
}

// Функция начала новой игры
function startNewGame() {
    const width = parseInt(document.getElementById('width').value);
    const height = parseInt(document.getElementById('height').value);
    const mineCount = parseInt(document.getElementById('mines').value);

    if (mineCount >= width * height) {
        showError('Количество мин не может быть больше или равно количеству клеток');
        return;
    }

    if (width < 5 || height < 5 || width > 16 || height > 16) {
        showError('Размер поля должен быть от 5x5 до 16x16');
        return;
    }

    gameState.width = width;
    gameState.height = height;
    gameState.mineCount = mineCount;

    modal.close();
    initializeGame();
}

// Инициализация игры
function initializeGame() {
    gameState.gameOver = false;
    gameState.isFlagMode = false;
    flagModeBtn.classList.remove('active');
    gameState.remainingMines = gameState.mineCount;
    
    // Инициализация массивов
    gameState.mines = Array(gameState.width).fill().map(() => Array(gameState.height).fill(false));
    gameState.revealed = Array(gameState.width).fill().map(() => Array(gameState.height).fill(false));
    gameState.flags = Array(gameState.width).fill().map(() => Array(gameState.height).fill(false));
    gameState.gameBoard = [];
    
    // Очищаем статус игры
    gameStatusDiv.textContent = '';
    
    // Обновляем счетчик мин
    updateMinesCounter();
    
    // Создаем игровое поле
    createBoard();
    
    // Размещаем мины
    placeMines();
}

// Создание игрового поля
function createBoard() {
    gameBoardDiv.innerHTML = '';
    gameBoardDiv.style.gridTemplateColumns = `repeat(${gameState.width}, 35px)`;
    gameState.gameBoard = [];
    
    for (let x = 0; x < gameState.width; x++) {
        for (let y = 0; y < gameState.height; y++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            cell.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`Clicked cell at ${x},${y}`);
                handleCellClick(x, y);
            });
            
            gameBoardDiv.appendChild(cell);
            gameState.gameBoard.push(cell);
        }
    }
    
    console.log('Board created:', gameState.gameBoard.length, 'cells');
}

// Размещение мин
function placeMines() {
    let placedMines = 0;
    console.log('Placing mines:', gameState.mineCount);
    
    while (placedMines < gameState.mineCount) {
        const x = Math.floor(Math.random() * gameState.width);
        const y = Math.floor(Math.random() * gameState.height);
        
        if (!gameState.mines[x][y]) {
            gameState.mines[x][y] = true;
            placedMines++;
            console.log('Placed mine at:', x, y);
        }
    }
}

// Функция обновления счетчика мин
function updateMinesCounter() {
    minesCounter.textContent = `Мины: ${gameState.remainingMines}`;
}

// Функция для открытия клеток вокруг цифры
function handleChordClick(x, y) {
    const number = parseInt(gameState.gameBoard[x * gameState.height + y].textContent);
    if (!number) return;
    
    // Подсчитываем количество флажков вокруг
    let flagCount = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < gameState.width && newY >= 0 && newY < gameState.height && gameState.flags[newX][newY]) {
                flagCount++;
            }
        }
    }
    
    // Если количество флажков совпадает с цифрой
    if (flagCount === number) {
        // Открываем все не отмеченные клетки вокруг
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const newX = x + dx;
                const newY = y + dy;
                if (newX >= 0 && newX < gameState.width && newY >= 0 && newY < gameState.height && !gameState.flags[newX][newY] && !gameState.revealed[newX][newY]) {
                    handleCellClick(newX, newY);
                }
            }
        }
    }
}

// Сохранение игры
function saveGame(isWin) {
    const gameData = {
        timestamp: new Date().toISOString(),
        size: `${gameState.width}x${gameState.height}`,
        mines: gameState.mineCount,
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