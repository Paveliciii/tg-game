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
  easy: { size: 5, mines: 5 },
  medium: { size: 8, mines: 12 },
  hard: { size: 10, mines: 20 }
};

// Добавляем переменные для отслеживания долгого нажатия
let longPressTimer;
let isLongPress = false;

// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

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

// Начальный экран с выбором сложности
function showDifficultySelection() {
  gameContainer.innerHTML = '';
  
  const title = document.createElement('h2');
  title.textContent = 'Выберите сложность:';
  gameContainer.appendChild(title);

  const difficultyButtons = document.createElement('div');
  difficultyButtons.className = 'difficulty-buttons';
  
  for (const diff of ['easy', 'medium', 'hard']) {
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
  }
  
  gameContainer.appendChild(difficultyButtons);
}

// Открыть все ячейки при окончании игры
function revealAll() {
  board.forEach(cell => {
    if (cell.dataset.mine === 'true') {
      cell.classList.add('mine');
      if (cell.classList.contains('flagged')) {
        cell.classList.add('correct-flag');
      }
    } else if (cell.classList.contains('flagged')) {
      cell.classList.add('wrong-flag');
    }
  });
}

// Обновление счетчика флажков
function updateFlagCounter() {
  const flaggedCount = board.filter(cell => cell.classList.contains('flagged')).length;
  const mineCount = difficulties[difficulty].mines;
  document.getElementById('flag-counter').textContent = mineCount - flaggedCount;
}

// Начало игры после первого клика
function startGame() {
  gameStarted = true;
  startTime = Date.now();
  if (timer) clearInterval(timer);
  timer = setInterval(updateTimer, 1000);
}

// Проверка победы
function checkWin() {
  const mineCount = difficulties[difficulty].mines;
  const size = difficulties[difficulty].size;
  const revealed = board.filter(cell => cell.classList.contains('revealed')).length;
  
  if (revealed === size * size - mineCount) {
    gameOver = true;
    clearInterval(timer);
    
    // Помечаем все мины флажками
    board.forEach(cell => {
      if (cell.dataset.mine === 'true' && !cell.classList.contains('flagged')) {
        cell.classList.add('flagged');
      }
    });
    
    // Вычисляем время
    const gameTime = Date.now() - startTime;
    
    // Проверяем, лучшее ли это время
    let newRecord = false;
    if (!bestTimes[difficulty] || gameTime < parseInt(bestTimes[difficulty])) {
      bestTimes[difficulty] = gameTime.toString();
      localStorage.setItem(`bestTime_${difficulty}`, gameTime);
      newRecord = true;
    }
    
    // Показываем сообщение с результатом
    const message = newRecord 
      ? `🎉 Победа! Новый рекорд: ${formatTime(gameTime)}!` 
      : `🎉 Победа! Ваше время: ${formatTime(gameTime)}. Рекорд: ${formatTime(parseInt(bestTimes[difficulty]))}`;
    
    tg.showAlert(message);
  }
}

// Открытие ячейки
function revealCell(cell) {
  if (cell.classList.contains('revealed') || cell.classList.contains('flagged')) return;
  
  cell.classList.add('revealed');
  const index = parseInt(cell.dataset.index);
  const size = difficulties[difficulty].size;
  const row = Math.floor(index / size);
  const col = index % size;
  
  // Подсчет мин вокруг
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
    cell.classList.add(`cell-${count}`); // Для цветового кодирования
    
    // Добавляем обработчик клика на цифры
    cell.addEventListener('click', () => {
      // Проверяем, достаточно ли флажков вокруг
      let flaggedCount = 0;
      let adjacentCells = [];
      
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const newRow = row + i;
          const newCol = col + j;
          if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
            const adjacentIndex = newRow * size + newCol;
            const adjacentCell = board[adjacentIndex];
            
            if (adjacentCell.classList.contains('flagged')) {
              flaggedCount++;
            } else if (!adjacentCell.classList.contains('revealed')) {
              adjacentCells.push(adjacentCell);
            }
          }
        }
      }
      
      // Если количество флажков соответствует цифре, открываем остальные ячейки
      if (flaggedCount === count) {
        adjacentCells.forEach(adjacentCell => {
          handleCellClick(adjacentCell);
        });
      }
    });
  } else {
    // Если нет мин рядом, открываем соседние ячейки
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

// Обработка клика по ячейке
function handleCellClick(cell) {
  if (gameOver || cell.classList.contains('revealed')) return;
  
  // Если ячейка помечена флажком, не открываем её
  if (cell.classList.contains('flagged')) {
    // Если это двойной клик по цифре, проверяем возможность быстрого открытия
    if (cell.classList.contains('revealed') && cell.textContent) {
      quickReveal(cell);
    }
    return;
  }
  
  // Первый клик никогда не должен быть на мину
  if (!gameStarted) {
    // Если первый клик на мину, перемещаем её
    if (cell.dataset.mine === 'true') {
      cell.dataset.mine = 'false';
      
      // Найдем безопасное место для мины
      for (let i = 0; i < board.length; i++) {
        if (board[i].dataset.mine === 'false' && board[i] !== cell) {
          board[i].dataset.mine = 'true';
          break;
        }
      }
    }
    
    startGame();
  }
  
  if (cell.dataset.mine === 'true') {
    gameOver = true;
    revealAll();
    clearInterval(timer);
    tg.showAlert('💥 Бум! Игра окончена.');
  } else {
    revealCell(cell);
    checkWin();
  }
}

// Быстрое открытие ячеек при правильной установке флажков
function quickReveal(cell) {
  const index = parseInt(cell.dataset.index);
  const size = difficulties[difficulty].size;
  const row = Math.floor(index / size);
  const col = index % size;
  const count = parseInt(cell.textContent);
  
  // Подсчитываем количество флажков вокруг
  let flaggedCount = 0;
  let adjacentCells = [];
  
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const newRow = row + i;
      const newCol = col + j;
      if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
        const adjacentIndex = newRow * size + newCol;
        const adjacentCell = board[adjacentIndex];
        
        if (adjacentCell.classList.contains('flagged')) {
          flaggedCount++;
        } else if (!adjacentCell.classList.contains('revealed')) {
          adjacentCells.push(adjacentCell);
        }
      }
    }
  }
  
  // Если количество флажков соответствует цифре, открываем остальные ячейки
  if (flaggedCount === count) {
    adjacentCells.forEach(adjacentCell => {
      if (adjacentCell.dataset.mine === 'true') {
        gameOver = true;
        revealAll();
        clearInterval(timer);
        tg.showAlert('💥 Бум! Игра окончена.');
      } else {
        revealCell(adjacentCell);
      }
    });
    checkWin();
  }
}

// Функция установки/снятия флажка
function toggleFlag(cell) {
  if (gameOver || cell.classList.contains('revealed')) return;
  
  if (!gameStarted) {
    startGame();
  }
  
  // Проверяем, не превышаем ли лимит флажков
  const flaggedCount = board.filter(cell => cell.classList.contains('flagged')).length;
  const mineCount = difficulties[difficulty].mines;
  
  if (cell.classList.contains('flagged')) {
    cell.classList.remove('flagged');
  } else if (flaggedCount < mineCount) {
    cell.classList.add('flagged');
  }
  
  updateFlagCounter();
}

// Инициализация игры
function initGame() {
  const size = difficulties[difficulty].size;
  const mineCount = difficulties[difficulty].mines;
  
  gameContainer.innerHTML = '';
  board = [];
  gameOver = false;
  gameStarted = false;
  
  // Создаем элементы интерфейса
  const gameHeader = document.createElement('div');
  gameHeader.className = 'game-header';
  
  // Счетчик флажков
  const flagCounter = document.createElement('div');
  flagCounter.id = 'flag-counter';
  flagCounter.textContent = mineCount;
  
  // Таймер
  const timerDisplay = document.createElement('div');
  timerDisplay.id = 'timer';
  timerDisplay.textContent = '00:00';
  
  // Кнопка рестарта
  const restartButton = document.createElement('button');
  restartButton.id = 'restart-button';
  restartButton.textContent = '🔄';
  restartButton.addEventListener('click', () => {
    clearInterval(timer);
    initGame();
  });
  
  // Кнопка назад к выбору сложности
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
  
  // Создаем игровое поле
  const boardElement = document.createElement('div');
  boardElement.id = 'board';
  boardElement.style.gridTemplateColumns = `repeat(${size}, 40px)`;
  gameContainer.appendChild(boardElement);
  
  // Генерируем мины
  const minePositions = new Set();
  while (minePositions.size < mineCount) {
    minePositions.add(Math.floor(Math.random() * size * size));
  }
  
  // Создаем ячейки
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;
    cell.dataset.mine = minePositions.has(i) ? 'true' : 'false';
    
    // Обработка долгого нажатия
    cell.addEventListener('touchstart', (e) => {
      isLongPress = false;
      longPressTimer = setTimeout(() => {
        isLongPress = true;
        toggleFlag(cell);
      }, 500);
    });
    
    cell.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      if (!isLongPress) {
        handleCellClick(cell);
      }
    });
    
    cell.addEventListener('touchmove', (e) => {
      clearTimeout(longPressTimer);
    });
    
    // Левый клик для открытия ячейки
    cell.addEventListener('click', (e) => {
      // Проверяем, не было ли это долгое нажатие на мобильном
      if (!isLongPress) {
        handleCellClick(cell);
      }
    });
    
    // Правый клик для установки флажка
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFlag(cell);
    });
    
    boardElement.appendChild(cell);
    board.push(cell);
  }
}

// Запускаем игру с экрана выбора сложности
showDifficultySelection();