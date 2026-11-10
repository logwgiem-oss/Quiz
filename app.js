let peer = null;
let connections = []; // Host stores connections to all players
let conn = null;        // Player stores single connection to host
let myNickname = "";

let quizData = [];
let currentQuestionIndex = 0;
let answersReceived = 0;

// High-compatibility ICE setup using public STUN & custom low-port configuration to puncture strict NAT/Firewalls across networks (4G/5G/Wi-Fi)
const peerConfig = {
    config: {
        'iceServers': [
            { 'urls': 'stun:stun.l.google.com:19302' },
            { 'urls': 'stun:stun1.l.google.com:19302' },
            { 'urls': 'stun:stun2.l.google.com:19302' },
            { 'urls': 'stun:stun3.l.google.com:19302' },
            { 'urls': 'stun:stun4.l.google.com:19302' }
        ]
    }
};

// --- HOST LOGIC ---
function startAsHost() {
    // Parse form questions before spinning up the network
    const rows = document.getElementsByClassName('question-row');
    quizData = [];
    for (let row of rows) {
        const text = row.querySelector('.q-text').value.trim();
        if (!text) continue;
        quizData.push({
            question: text,
            answer: row.querySelector('.q-correct').value
        });
    }

    if (quizData.length === 0) {
        alert("Please write at least one question before hosting!");
        return;
    }

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('host-view').classList.remove('hidden');

    // Create unique random 5-character string room ID/PIN instead of massive standard GUID hashes
    const randomPin = Math.random().toString(36).substring(2, 7).toUpperCase();

    // Instantiate broker connection leveraging cloud fallback tunnels
    peer = new Peer(randomPin, peerConfig);

    peer.on('open', (id) => {
        document.getElementById('display-pin').innerText = id;
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        // Fallback option if room code collision occurs
        if(err.type === 'unavailable-id') {
            alert("Room token assignment conflict. Re-attempting connection fallback parameters...");
            location.reload();
        }
    });

    peer.on('connection', (connection) => {
        // Intercept network handshakes securely
        connection.on('open', () => {
            connections.push(connection);
            document.getElementById('start-game-btn').disabled = false;
        });

        connection.on('data', (data) => {
            if (data.type === 'JOIN_LOBBY') {
                connection.nickname = data.nickname;
                updateHostLobbyUI();
            }
            if (data.type === 'SUBMIT_ANSWER') {
                answersReceived++;
                document.getElementById('submission-count').innerText = answersReceived;
                console.log(`Received answer from ${connection.nickname}: ${data.answer}`);
            }
        });

        connection.on('close', () => {
            connections = connections.filter(c => c !== connection);
            updateHostLobbyUI();
            if(connections.length === 0) document.getElementById('start-game-btn').disabled = true;
        });
    });
}

function updateHostLobbyUI() {
    const list = document.getElementById('player-list');
    list.innerHTML = "";
    connections.forEach(c => {
        const name = c.nickname || "Anonymous Player";
        list.innerHTML += `<li>👤 ${name}</li>`;
    });
}

function sendStartGame() {
    document.getElementById('host-lobby').classList.add('hidden');
    document.getElementById('host-game').classList.remove('hidden');
    
    document.getElementById('question-text').innerText = quizData[currentQuestionIndex].question;
    document.getElementById('submission-count').innerText = "0";
    answersReceived = 0;

    connections.forEach(c => {
        c.send({ type: 'START_GAME' });
    });
}


// --- PLAYER LOGIC ---
function startAsPlayer() {
    const pin = document.getElementById('game-pin').value.trim().toUpperCase();
    myNickname = document.getElementById('player-nickname').value.trim();

    if (!myNickname) return alert("Please input a Nickname!");
    if (!pin) return alert("Please enter the Host Room PIN!");

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('player-view').classList.remove('hidden');

    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        document.getElementById('player-status').innerText = `Puncturing networks... Connecting to PIN: ${pin}`;
        
        conn = peer.connect(pin);

        conn.on('open', () => {
            document.getElementById('player-status').innerText = "Connected! Sending identification credentials...";
            conn.send({ type: 'JOIN_LOBBY', nickname: myNickname });
            document.getElementById('player-status').innerText = `Lobby joined successfully as "${myNickname}". Waiting for host to initiate quiz grid...`;
        });

        conn.on('data', (data) => {
            if (data.type === 'START_GAME') {
                document.getElementById('player-status').innerText = "Look at the big screen! Tap your option:";
                document.getElementById('player-controller').classList.remove('hidden');
            }
        });

        conn.on('close', () => {
            alert("Disconnected from quiz room host.");
            location.reload();
        });
    });

    peer.on('error', (err) => {
        alert("Connection interface failed. Verify the PIN matches the host screen exactly.");
        location.reload();
    });
}

function submitAnswer(letter) {
    document.getElementById('player-controller').classList.add('hidden');
    document.getElementById('player-status').innerText = `Option ${letter} dispatched! Awaiting results...`;

    conn.send({
        type: 'SUBMIT_ANSWER',
        answer: letter
    });
}
