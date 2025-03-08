let roomId = null;
let playerId = null;
let username = null;
let timer = null;
let timeLeft = 10;
let currentRound = 0;
let isRoundActive = false;
let waitingForRestart = false;

function createRoom() {
    username = document.getElementById('username').value.trim();
    if (!username) return alert('Please enter a username');
    
    roomId = Math.random().toString(36).substr(2, 9);
    playerId = 1;
    db.ref(`rooms/${roomId}`).set({
        player1: { name: username, score: 0, choice: null },
        player2: null,
        round: 1,
        roundProcessed: 0,
        playAgainRequest: null
    }).then(() => {
        alert(`Room created! Share this code with your friend: ${roomId}`);
        startGame();
    }).catch(error => {
        console.error('Error creating room:', error);
    });
}

function showJoinRoom() {
    document.getElementById('join-room-input').style.display = 'block';
}

function joinRoom() {
    username = document.getElementById('username').value.trim();
    roomId = document.getElementById('room-code').value.trim();
    if (!username || !roomId) return alert('Please enter username and room code');
    
    db.ref(`rooms/${roomId}`).once('value', snapshot => {
        if (snapshot.exists() && !snapshot.val().player2) {
            playerId = 2;
            db.ref(`rooms/${roomId}/player2`).set({
                name: username,
                score: 0,
                choice: null
            }).then(() => startGame());
        } else {
            alert('Room not found or already full');
        }
    });
}

function startGame() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    listenToRoom();
    setupChoices();
    startTimer();
}

function listenToRoom() {
    db.ref(`rooms/${roomId}`).on('value', snapshot => {
        const data = snapshot.val();
        if (!data) return leaveRoom();
        
        document.getElementById('player1-name').textContent = data.player1.name;
        document.getElementById('player1-score').textContent = data.player1.score || 0;
        document.getElementById('player2-name').textContent = data.player2 ? data.player2.name : 'Waiting...';
        document.getElementById('player2-score').textContent = data.player2 ? (data.player2.score || 0) : 0;

        // Check if round has reset to 1 (indicating a game restart after Play Again)
        if (data.round === 1 && waitingForRestart) {
            waitingForRestart = false;
            document.getElementById('winner-screen').style.display = 'none';
            document.getElementById('game-screen').style.display = 'block';
            document.getElementById('result').textContent = '';
            document.querySelectorAll('.choice').forEach(b => b.disabled = false);
            startTimer();
        }

        if (data.player1.choice && data.player2?.choice && !isRoundActive && data.roundProcessed < data.round) {
            isRoundActive = true;
            stopTimer();
            currentRound = data.round;
            checkRoundWinner(data);
        }

        // Handle Play Again request
        if (data.playAgainRequest) {
            if (data.playAgainRequest !== playerId) {
                if (confirm(`${playerId === 1 ? data.player2.name : data.player1.name} wants to play again. Do you?`)) {
                    db.ref(`rooms/${roomId}`).update({
                        round: 1,
                        'player1/score': 0,
                        'player2/score': 0,
                        'player1/choice': null,
                        'player2/choice': null,
                        playAgainRequest: null,
                        roundProcessed: 0
                    }).then(() => {
                        document.getElementById('winner-screen').style.display = 'none';
                        document.getElementById('game-screen').style.display = 'block';
                        document.getElementById('result').textContent = '';
                        document.querySelectorAll('.choice').forEach(b => b.disabled = false);
                        startTimer();
                    });
                } else {
                    db.ref(`rooms/${roomId}`).update({
                        playAgainRequest: null
                    });
                }
            } else {
                document.getElementById('result').textContent = 'Waiting for opponent to agree...';
                waitingForRestart = true;
            }
        }
    }, error => {
        console.error('Error listening to room:', error);
    });
}

function setupChoices() {
    document.querySelectorAll('.choice').forEach(btn => {
        btn.addEventListener('click', () => {
            const choice = btn.dataset.choice;
            db.ref(`rooms/${roomId}/player${playerId}/choice`).set(choice);
            document.querySelectorAll('.choice').forEach(b => b.disabled = true);
        });
    });
}

function startTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    timeLeft = 10;
    document.getElementById('timer').textContent = timeLeft;
    console.log('Timer started');
    timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = timeLeft;
        if (timeLeft <= 0) {
            stopTimer();
            console.log('Timer hit 0, checking winner');
            db.ref(`rooms/${roomId}`).once('value', snapshot => {
                const data = snapshot.val();
                if (data && data.roundProcessed < data.round) {
                    checkRoundWinner(data);
                } else {
                    console.log('No valid round to process:', data);
                }
            });
        }
    }, 1000);
}

function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
        timeLeft = 10;
        document.getElementById('timer').textContent = timeLeft;
        console.log('Timer stopped');
    }
}

function checkRoundWinner(data) {
    if (!data || !data.player1 || !data.player2) {
        console.error('Invalid game data:', data);
        stopTimer();
        document.getElementById('result').textContent = 'Game data corrupted. Please leave and rejoin.';
        isRoundActive = false;
        return;
    }

    if (data.roundProcessed >= data.round) {
        isRoundActive = false;
        return;
    }

    const p1Choice = data.player1.choice;
    const p2Choice = data.player2.choice;
    let result = '';
    let updates = {};

    if (p1Choice === p2Choice) {
        result = "It's a tie!";
    } else if (
        (p1Choice === 'rock' && p2Choice === 'scissors') ||
        (p1Choice === 'paper' && p2Choice === 'rock') ||
        (p1Choice === 'scissors' && p2Choice === 'paper')
    ) {
        result = `${data.player1.name} wins this round!`;
        updates[`/rooms/${roomId}/player1/score`] = (data.player1.score || 0) + 1;
    } else {
        result = `${data.player2.name} wins this round!`;
        updates[`/rooms/${roomId}/player2/score`] = (data.player2.score || 0) + 1;
    }

    updates[`/rooms/${roomId}/roundProcessed`] = data.round;

    db.ref().update(updates).then(() => {
        document.getElementById('result').textContent = result;
        checkGameWinner(data);
    }).catch(error => {
        console.error('Error updating round:', error);
    }).finally(() => {
        isRoundActive = false;
    });
}

function checkGameWinner(data) {
    const round = data.round || 1;
    if (round >= 3) {
        let winner;
        if (data.player1.score > data.player2.score) {
            winner = data.player1.name;
        } else if (data.player2.score > data.player1.score) {
            winner = data.player2.name;
        } else {
            winner = "It's a tie!";
        }
        showWinner(winner);
    } else {
        setTimeout(() => {
            db.ref(`rooms/${roomId}`).update({
                round: round + 1,
                'player1/choice': null,
                'player2/choice': null
            }).then(() => {
                document.getElementById('result').textContent = '';
                document.querySelectorAll('.choice').forEach(b => b.disabled = false);
                startTimer();
            });
        }, 2000);
    }
}

function showWinner(winner) {
    stopTimer();
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'block';
    document.getElementById('winner-text').textContent = winner === "It's a tie!" ? "It's a tie!" : `${winner} Wins!`;
    
    // Confetti animation with fallback
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#ff0000', '#00ff00', '#0000ff']
        });
    } else {
        console.log("Confetti library not loaded. Falling back to manual load.");
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js";
        script.onload = () => {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#ff0000', '#00ff00', '#0000ff']
            });
        };
        document.head.appendChild(script);
    }
}

function playAgain() {
    stopTimer();
    db.ref(`rooms/${roomId}`).update({
        playAgainRequest: playerId
    });
}

function leaveRoom() {
    stopTimer();
    db.ref(`rooms/${roomId}`).off();
    if (roomId) {
        db.ref(`rooms/${roomId}`).remove();
    }
    location.reload();
}