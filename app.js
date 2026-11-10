let peer = null;
let connections = []; 
let conn = null;        
let quizData = [];
let currentQuestionIndex = 0;
let answersReceived = 0;

const peerConfig = {
    config: {
        'iceServers': [
            { 'urls': 'stun:stun.l.google.com:19302' },
            {
                'urls': 'turn:openrelay.metered.ca:443',
                'username': 'openrelayproject',
                'credential': 'openrelayproject'
            },
            {
                'urls': 'turn:openrelay.metered.ca:80',
                'username': 'openrelayproject',
                'credential': 'openrelayproject'
            }
        ]
    }
};

function addQuestionRow() {
    const list = document.getElementById('questions-list');
    const rowCount = list.getElementsByClassName('question-row').length + 1;
    
    const row = document.createElement('div');
    row.className = 'question-row';
    row.innerHTML = `
        <div class="row-header">
            <h4>Question ${rowCount}</h4>
            <button type="button" class="btn-remove" onclick="removeRow(this)">Delete</button>
        </div>
        <div class="form-group">
            <label>Question Prompt</label>
            <input type="text" class="q-text form-input" placeholder="e.g., What is the capital of England?" required>
        </div>
        <div class="options-grid">
            <div>
                <label>Option A (Red Triangle ▲)</label>
                <input type="text" class="opt-a form-input" placeholder="Answer A" required>
            </div>
            <div>
                <label>Option B (Blue Diamond ◆)</label>
                <input type="text" class="opt-b form-input" placeholder="Answer B" required>
            </div>
            <div>
                <label>Option C (Yellow Circle ●)</label>
                <input type="text" class="opt-c form-input" placeholder="Answer C" required>
            </div>
            <div>
                <label>Option D (Green Square ■)</label>
                <input type="text" class="opt-d form-input" placeholder="Answer D" required>
            </div>
        </div>
        <div class="form-group" style="margin-top: 10px;">
            <label>Correct Choice</label>
            <select class="q-correct form-input" style="width: auto;">
                <option value="A">Option A (Red)</option>
                <option value="B">Option B (Blue)</option>
                <option value="C">Option C (Yellow)</option>
                <option value="D">Option D (Green)</option>
            </select>
        </div>
    `;
    list.appendChild(row);
    renumberQuestions();
}

function removeRow(button) {
    button.closest('.question-row').remove();
    renumberQuestions();
}

function renumberQuestions() {
    const headings = document.querySelectorAll('#questions-list .question-row h4');
    headings.forEach((h, index) => {
        h.innerText = `Question ${index + 1}`;
    });
}

function parseQuestionsFromForm() {
    quizData = [];
    const rows = document.getElementsByClassName('question-row');
    for (let row of rows) {
        const text = row.querySelector('.q-text').value.trim();
        const correct = row.querySelector('.q-correct').value;
        if (text) {
            quizData.push({ question: text, answer: correct });
        }
    }
}

// --- HOST LOGIC ---
function startAsHost() {
    parseQuestionsFromForm();
    if (quizData.length === 0) {
        alert("Please create at least one question before hosting.");
        return;
    }

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('host-view').classList.remove('hidden');

    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        document.getElementById('display-pin').innerText = id;
    });

    peer.on('connection', (connection) => {
        connections.push(connection);
        
        connection.on('data', (data) => {
            handlePlayerData(data, connection);
        });

        connection.on('open', () => {
            updateHostLobbyUI();
            document.getElementById('start-game-btn').disabled = false;
        });
    });
}

function updateHostLobbyUI() {
    const list = document.getElementById('player-list');
    list.innerHTML = "";
    connections.forEach(c => {
        list.innerHTML += `<li>👤 Player (${c.peer.substring(0,4)})</li>`;
    });
}

function sendStartGame() {
    document.getElementById('host-lobby').classList.add('hidden');
    document.getElementById('host-game').classList.remove('hidden');
    
    document.getElementById('question-text').innerText = quizData[currentQuestionIndex].question;

    connections.forEach(c => {
        c.send({ type: 'START_GAME' });
    });
}

function handlePlayerData(data, connection) {
    if (data.type === 'SUBMIT_ANSWER') {
        answersReceived++;
        document.getElementById('submission-count').innerText = answersReceived;
        console.log(`Player choice: ${data.answer}`);
    }
}

// --- PLAYER LOGIC ---
function startAsPlayer() {
    const pin = document.getElementById('game-pin').value.trim();
    if (!pin) return alert("Please enter a valid Game PIN");

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('player-view').classList.remove('hidden');

    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        document.getElementById('player-status').innerText = "Connecting directly to host...";
        conn = peer.connect(pin);

        conn.on('open', () => {
            document.getElementById('player-status').innerText = "Connected! Waiting for host to start match...";
        });

        conn.on('data', (data) => {
            if (data.type === 'START_GAME') {
                document.getElementById('player-status').innerText = "Tap the matching answer on your screen!";
                document.getElementById('player-controller').classList.remove('hidden');
            }
        });
    });
}

function submitAnswer(letter) {
    document.getElementById('player-controller').classList.add('hidden');
    document.getElementById('player-status').innerText = "Answer locked in! Waiting for other peers...";

    conn.send({
        type: 'SUBMIT_ANSWER',
        answer: letter
    });
}
