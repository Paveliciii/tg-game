// Wait for DOM content to load before initializing
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const gameContainer = document.getElementById('game-container');
    const gameBoardDiv = document.getElementById('game-board');
    const gameStatusDiv = document.getElementById('game-status');
    const modal = document.getElementById('modal');
    const startBtn = document.getElementById('start-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const helpBtn = document.getElementById('help');
    const closeHelpBtn = document.getElementById('close-help');
    const viewPastGamesBtn = document.getElementById('view-past-games');
    const closeHistoryBtn = document.getElementById('close-history');
    const helpContainer = document.getElementById('help-container');
    const pastGamesContainer = document.getElementById('past-games-container');
    const errorMessageDiv = document.getElementById('error-message');
    const newGameBtn = document.getElementById('new-game');
    const flagModeBtn = document.getElementById('flag-mode');
    const minesCounter = document.getElementById('mines-counter');
    const timerDisplay = document.getElementById('timer');

    // Game state
    let board = [];
    let gameStarted = false;
    let startTime = 0;
    let timer = null;
    let difficulty = 'medium';
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
        width: 10,
        height: 10,
        mineCount: 15,
        mines: [],
        revealed: [],
        flags: [],
        gameBoard: [],
        gameOver: false,
        isFlagMode: false,
        remainingMines: 15
    };

    // Event listeners
    if (startBtn) startBtn.addEventListener('click', startNewGame);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.close());
    if (helpBtn) helpBtn.addEventListener('click', () => helpContainer.style.display = 'block');
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => helpContainer.style.display = 'none');
    if (viewPastGamesBtn) viewPastGamesBtn.addEventListener('click', showPastGames);
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => pastGamesContainer.style.display = 'none');
    if (newGameBtn) newGameBtn.addEventListener('click', showDifficultySelection);
    if (flagModeBtn) flagModeBtn.addEventListener('click', toggleFlagMode);

    // Переключение режима флажков
    function toggleFlagMode() {
        gameState.isFlagMode = !gameState.isFlagMode;
        if (flagModeBtn) {
            flagModeBtn.classList.toggle('active');
        }
    }

    // Начальный экран с выбором сложности
    function showDifficultySelection() {
        if (!gameContainer) return;
        
        gameContainer.innerHTML = '';
        const difficultyDiv = document.createElement('div');
        difficultyDiv.className = 'difficulty-selection';
        
        const title = document.createElement('h2');
        title.textContent = 'Select Difficulty';
        difficultyDiv.appendChild(title);
        
        Object.entries(difficulties).forEach(([diff, settings]) => {
            const button = document.createElement('button');
            button.className = 'difficulty-button';
            button.textContent = `${diff.charAt(0).toUpperCase() + diff.slice(1)} (${settings.size}x${settings.size}, ${settings.mineCount} mines)`;
            button.addEventListener('click', () => {
                difficulty = diff;
                gameState.width = settings.size;
                gameState.height = settings.size;
                gameState.mineCount = settings.mineCount;
                gameState.remainingMines = settings.mineCount;
                initializeGame();
            });
            difficultyDiv.appendChild(button);
        });
        
        gameContainer.appendChild(difficultyDiv);
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
        if (!timerDisplay || !gameStarted || gameState.gameOver) return;
        
        const currentTime = Date.now() - startTime;
        timerDisplay.textContent = formatTime(currentTime);
    }

    // Проверка выхода за пределы поля
    function outBounds(x, y) {
        return x < 0 || y < 0 || x >= gameState.width || y >= gameState.height;
    }

    // Подсчет мин вокруг клетки
    function calcNear(x, y) {
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const newX = x + dx;
                const newY = y + dy;
                if (newX >= 0 && newX < gameState.width && 
                    newY >= 0 && newY < gameState.height && 
                    gameState.mines[newX][newY]) {
                    count++;
                }
            }
        }
        return count;
    }

    // Открытие клетки
    function reveal(x, y) {
        if (x < 1 || x > gameState.width || y < 1 || y > gameState.height) return;
        if (gameState.revealed[x][y] || gameState.flags[x][y]) return;
        
        gameState.revealed[x][y] = true;
        const cellIndex = (x - 1) * gameState.height + (y - 1);
        const cell = gameState.gameBoard[cellIndex];
        cell.classList.add('revealed');
        
        if (typeof gameState.mines[x][y] === 'number' && gameState.mines[x][y] > 0) {
            cell.textContent = gameState.mines[x][y];
            cell.classList.add(`cell-${gameState.mines[x][y]}`);
        } else if (gameState.mines[x][y] === 0) {
            // Recursively reveal adjacent cells for empty cells
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    reveal(x + di, y + dj);
                }
            }
        }
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
    function handleCellClick(x, y) {
        console.log('Clicked cell at', x, y);
        console.log('Click handler called:', x, y, gameState);
        
        if (gameState.gameOver) {
            console.log('Game is over');
            return;
        }
        
        const cellIndex = (x - 1) * gameState.height + (y - 1);
        const cell = gameState.gameBoard[cellIndex];
        
        // Если клетка уже открыта и на ней цифра, пробуем открыть соседние клетки
        if (gameState.revealed[x][y] && cell.textContent) {
            handleChordClick(x, y);
            return;
        }
        
        // Если режим флажков активен
        if (gameState.isFlagMode) {
            handleRightClick(x, y);
            return;
        }
        
        // Нельзя открывать клетки с флажками
        if (gameState.flags[x][y]) {
            console.log('Cell is flagged');
            return;
        }
        
        console.log('Revealing cell:', x, y);
        
        // Если это первый клик - инициализируем игру
        if (!gameStarted) {
            console.log('First click - initializing game');
            gameStarted = true;
            startTime = Date.now();
            if (timer) clearInterval(timer);
            timer = setInterval(updateTimer, 1000);
            
            // Clear and place mines avoiding first click
            for (let i = 1; i <= gameState.width; i++) {
                for (let j = 1; j <= gameState.height; j++) {
                    gameState.mines[i][j] = false;
                }
            }
            placeMines(x, y);
        }
        
        if (gameState.mines[x][y] === true) {
            // Hit a mine
            gameState.gameOver = true;
            revealAll();
            gameStatusDiv.textContent = '💥 Game Over!';
            
            // Use alert instead of popup for game over
            if (tg.platform === 'tdesktop' || tg.platform === 'web') {
                alert('💥 You hit a mine! Game Over!');
            } else {
                tg.showAlert('💥 You hit a mine! Game Over!');
            }
            
            // Show difficulty selection after a short delay
            setTimeout(() => {
                showDifficultySelection();
            }, 1500);
        } else {
            reveal(x, y);
            if (checkWin()) {
                gameState.gameOver = true;
                const endTime = Date.now();
                const gameTime = endTime - startTime;
                
                gameStatusDiv.textContent = '🎉 Victory!';
                
                // Use alert instead of popup for victory
                const message = `🎉 Congratulations! You won!\nTime: ${formatTime(gameTime)}`;
                if (tg.platform === 'tdesktop' || tg.platform === 'web') {
                    alert(message);
                } else {
                    tg.showAlert(message);
                }
                
                // Show difficulty selection after a short delay
                setTimeout(() => {
                    showDifficultySelection();
                }, 1500);
            }
        }
    }

    // Обработка установки флага
    function toggleFlag(x, y) {
        if (revealed[x][y]) return;
        
        const cell = gameState.gameBoard[x * gameState.height + y];
        
        if (gameState.flags[x][y]) {
            gameState.flags[x][y] = false;
            cell.classList.remove('flagged');
            gameState.remainingMines++;
        } else {
            if (gameState.remainingMines > 0) {
                gameState.flags[x][y] = true;
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
        console.log('Инициализация игры');
        
        // Получаем настройки для выбранной сложности
        const settings = difficulties[difficulty];
        
        // Обновляем состояние игры
        gameState.width = settings.size;
        gameState.height = settings.size;
        gameState.mineCount = settings.mineCount;
        gameState.gameOver = false;
        gameState.isFlagMode = false;
        gameState.remainingMines = settings.mineCount;
        
        // Инициализируем массивы
        gameState.mines = Array(settings.size).fill().map(() => Array(settings.size).fill(0));
        gameState.revealed = Array(settings.size).fill().map(() => Array(settings.size).fill(false));
        gameState.flags = Array(settings.size).fill().map(() => Array(settings.size).fill(false));
        gameState.gameBoard = [];
        
        // Обновляем глобальные переменные для обратной совместимости
        gridW = settings.size;
        gridH = settings.size;
        numMines = settings.mineCount;
        mines = gameState.mines;
        revealed = gameState.revealed;
        flags = gameState.flags;
        board = [];
        gameOver = false;
        gameStarted = false;
        
        // Сбрасываем таймер
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        startTime = 0;
        
        // Очищаем контейнер
        gameContainer.innerHTML = '';
        
        // Создаем интерфейс
        createGameInterface();
        
        // Создаем игровое поле
        createGameBoard();
        
        // Обновляем интерфейс
        updateMinesCounter();
        document.getElementById('timer').textContent = '00:00';
        gameStatusDiv.textContent = '';
        
        console.log('Игра инициализирована:', gameState);
    }

    // Создание интерфейса игры
    function createGameInterface() {
        if (!gameContainer) return;
        
        // Reset container
        gameContainer.innerHTML = '';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'game-header';
        
        // Create mines counter
        const minesDisplay = document.createElement('div');
        minesDisplay.id = 'mines-counter';
        minesDisplay.textContent = `Mines: ${gameState.remainingMines}`;
        
        // Create timer
        const timerDisplay = document.createElement('div');
        timerDisplay.id = 'timer';
        timerDisplay.textContent = '00:00';
        
        // Create controls
        const controls = document.createElement('div');
        controls.className = 'controls-container';
        
        // Add buttons
        const flagModeBtn = document.createElement('button');
        flagModeBtn.id = 'flag-mode';
        flagModeBtn.className = 'control-button';
        flagModeBtn.textContent = '🚩';
        flagModeBtn.onclick = toggleFlagMode;
        
        const helpBtn = document.createElement('button');
        helpBtn.id = 'help';
        helpBtn.className = 'control-button';
        helpBtn.textContent = '❓';
        helpBtn.onclick = () => helpContainer.style.display = 'block';
        
        const historyBtn = document.createElement('button');
        historyBtn.id = 'view-past-games';
        historyBtn.className = 'control-button';
        historyBtn.textContent = '📜';
        historyBtn.onclick = showPastGames;
        
        const newGameBtn = document.createElement('button');
        newGameBtn.id = 'new-game';
        newGameBtn.className = 'control-button';
        newGameBtn.textContent = '🔄';
        newGameBtn.onclick = showDifficultySelection;
        
        // Assemble controls
        controls.appendChild(flagModeBtn);
        controls.appendChild(helpBtn);
        controls.appendChild(historyBtn);
        controls.appendChild(newGameBtn);
        
        // Assemble header
        header.appendChild(minesDisplay);
        header.appendChild(timerDisplay);
        header.appendChild(controls);
        
        // Create game board container
        const boardContainer = document.createElement('div');
        boardContainer.id = 'game-board';
        
        // Create status display
        const statusDisplay = document.createElement('div');
        statusDisplay.id = 'game-status';
        
        // Assemble game container
        gameContainer.appendChild(header);
        gameContainer.appendChild(boardContainer);
        gameContainer.appendChild(statusDisplay);
    }

    // Создание игрового поля
    function createGameBoard() {
        console.log('Создание игрового поля');
        
        // Очищаем контейнер
        gameBoardDiv.innerHTML = '';
        
        // Создаем сетку
        const grid = document.createElement('div');
        grid.className = 'grid';
        grid.style.gridTemplateColumns = `repeat(${gridW}, 40px)`;
        
        // Создаем клетки
        for (let x = 0; x < gridW; x++) {
            for (let y = 0; y < gridH; y++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                
                // Добавляем обработчики событий
                cell.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleCellClick(x, y, e);
                });
                
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    toggleFlag(x, y);
                });
                
                // Добавляем обработчики для долгого нажатия на мобильных устройствах
                cell.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    longPressTimer = setTimeout(() => {
                        isLongPress = true;
                        toggleFlag(x, y);
                    }, 500);
                });
                
                cell.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    clearTimeout(longPressTimer);
                    if (!isLongPress) {
                        handleCellClick(x, y, e);
                    }
                    isLongPress = false;
                });
                
                cell.addEventListener('touchmove', (e) => {
                    clearTimeout(longPressTimer);
                    isLongPress = false;
                });
                
                // Сохраняем клетку в массивы
                board.push(cell);
                gameState.gameBoard.push(cell);
                grid.appendChild(cell);
            }
        }
        
        // Добавляем сетку на страницу
        gameBoardDiv.appendChild(grid);
        console.log('Игровое поле создано:', board.length, 'клеток');
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
        for (let i = 1; i <= gameState.width; i++) {
            for (let j = 1; j <= gameState.height; j++) {
                if (gameState.mines[i][j] === true && !gameState.flags[i][j]) {
                    return false;
                }
                if (gameState.mines[i][j] !== true && !gameState.revealed[i][j]) {
                    return false;
                }
            }
        }
        return true;
    }

    // Функция начала новой игры
    function startNewGame() {
        const width = parseInt(document.getElementById('width').value);
        const height = parseInt(document.getElementById('height').value);
        const mines = parseInt(document.getElementById('mines').value);

        if (mines >= width * height) {
            if (errorMessageDiv) {
                errorMessageDiv.textContent = 'Number of mines cannot be greater than or equal to the number of cells';
            }
            return;
        }

        if (width < 5 || height < 5 || width > 16 || height > 16) {
            if (errorMessageDiv) {
                errorMessageDiv.textContent = 'Board size must be between 5x5 and 16x16';
            }
            return;
        }

        gameState.width = width;
        gameState.height = height;
        gameState.mineCount = mines;
        gameState.remainingMines = mines;

        if (modal) modal.close();
        initializeGame();
    }

    // Инициализация игры
    function initializeGame() {
        console.log('Initializing game');
        
        // Reset game state
        gameState.gameOver = false;
        gameState.isFlagMode = false;
        if (flagModeBtn) flagModeBtn.classList.remove('active');
        gameStarted = false;
        
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        
        // Initialize arrays with border padding
        const paddedSize = gameState.width + 2;
        gameState.mines = Array(paddedSize).fill().map(() => Array(paddedSize).fill(0));
        gameState.revealed = Array(paddedSize).fill().map(() => Array(paddedSize).fill(false));
        gameState.flags = Array(paddedSize).fill().map(() => Array(paddedSize).fill(false));
        gameState.gameBoard = [];
        
        // Create interface
        createGameInterface();
        
        // Create board
        createBoard();
        
        // Update display
        updateMinesCounter();
    }

    // Create game board
    function createBoard() {
        gameBoardDiv.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'grid';
        grid.style.gridTemplateColumns = `repeat(${gameState.width}, 40px)`;
        
        for (let i = 1; i <= gameState.width; i++) {
            for (let j = 1; j <= gameState.height; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                
                // Add click handlers
                cell.addEventListener('click', () => handleCellClick(i, j));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleRightClick(i, j);
                });
                
                // Add touch handlers for mobile
                let touchTimeout;
                cell.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    touchTimeout = setTimeout(() => {
                        handleRightClick(i, j);
                    }, 500);
                });
                
                cell.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    if (touchTimeout) {
                        clearTimeout(touchTimeout);
                        handleCellClick(i, j);
                    }
                });
                
                cell.addEventListener('touchmove', () => {
                    if (touchTimeout) {
                        clearTimeout(touchTimeout);
                    }
                });
                
                gameState.gameBoard.push(cell);
                grid.appendChild(cell);
            }
        }
        
        gameBoardDiv.appendChild(grid);
    }

    // Handle right click (flag placement)
    function handleRightClick(x, y) {
        if (gameState.gameOver) return;
        if (gameState.revealed[x][y]) return;
        
        const cellIndex = (x - 1) * gameState.height + (y - 1);
        const cell = gameState.gameBoard[cellIndex];
        
        if (gameState.flags[x][y]) {
            gameState.flags[x][y] = false;
            cell.classList.remove('flagged');
            gameState.remainingMines++;
        } else {
            if (gameState.remainingMines > 0) {
                gameState.flags[x][y] = true;
                cell.classList.add('flagged');
                gameState.remainingMines--;
                
                // Check for win condition
                if (checkWin()) {
                    gameState.gameOver = true;
                    gameStatusDiv.textContent = '🎉 Victory!';
                    revealAll();
                }
            }
        }
        
        updateMinesCounter();
    }

    // Функция обновления счетчика мин
    function updateMinesCounter() {
        if (minesCounter) {
            minesCounter.textContent = `Mines: ${gameState.remainingMines}`;
        }
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
        const pastGamesContainer = document.getElementById('past-games-container');
        const gameList = document.getElementById('game-list');
        
        if (!pastGamesContainer || !gameList) {
            console.error('Required elements not found:', {
                pastGamesContainer: !!pastGamesContainer,
                gameList: !!gameList
            });
            return;
        }
        
        const games = JSON.parse(localStorage.getItem('minesweeper_games') || '[]');
        gameList.innerHTML = '';
        
        if (games.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No games played yet';
            gameList.appendChild(li);
        } else {
            games.forEach(game => {
                const li = document.createElement('li');
                const date = new Date(game.timestamp);
                li.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} - ${game.size} - ${game.mines} мин - ${game.result}`;
                gameList.appendChild(li);
            });
        }
        
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
});