// ========== DATA BRIDGE ==========
function sanitizeAndBridgeData() {
    if (!window.MockTrialCaseData || !window.MockTrialCaseData.witnesses || !window.WitnessRoles) return;

    const rawWitnesses = window.MockTrialCaseData.witnesses;
    const cleanNames = Object.keys(window.WitnessRoles); // from WitnessPersonas.js (merged into Database.js)
    const patchedWitnesses = {};

    // First, copy entries that already match clean names exactly
    for (const [key, lines] of Object.entries(rawWitnesses)) {
        const trimmedKey = key.replace(/^Affidavit of\s*/i, '').trim();
        let matched = false;

        // Try exact match after trimming common prefixes
        for (const clean of cleanNames) {
            if (trimmedKey === clean || trimmedKey.includes(clean) || clean.includes(trimmedKey)) {
                patchedWitnesses[clean] = lines;
                matched = true;
                break;
            }
        }

        // If no match, try substring search (e.g., "Samuel Greene..." → "Samuel Greene")
        if (!matched) {
            for (const clean of cleanNames) {
                if (trimmedKey.includes(clean) || clean.includes(trimmedKey)) {
                    patchedWitnesses[clean] = lines;
                    matched = true;
                    break;
                }
            }
        }

        // If still no match, keep original key but warn (should not happen)
        if (!matched) {
            console.warn('Unmatched witness key:', key);
            patchedWitnesses[key] = lines;
        }
    }

    // Replace the witnesses object with the cleaned version
    window.MockTrialCaseData.witnesses = patchedWitnesses;
    console.log('Data Bridge: witnesses normalized to', Object.keys(patchedWitnesses));
}

// GLOBAL STATE
const State = {
    currentRoom: 'dashboard',
    witness: { side: null, name: null, mode: null, bank: [], qIndex: 0, timer: 300, interval: null, keywordsCount: 0 },
    lawyer: { side: null, mode: null, name: null, hints: [], usedLines: {}, controlScore: 100 },
    objection: { difficulty: null, script: [], lineIndex: 0, timer: 300, interval: null, activeViolation: null, violationGrace: 0, score: 0, pressureMode: false }
};

const SYNONYMS = {
    "money": ["dollars", "cost", "funds", "financial", "price", "payment", "paid", "compensation"],
    "contract": ["agreement", "deal", "paperwork", "signed", "document"],
    "danger": ["risk", "hazard", "unsafe", "peril", "threat", "warning"],
    "see": ["observe", "witness", "view", "spot", "look"],
    "say": ["state", "tell", "mention", "claim", "assert", "testify"],
    "know": ["aware", "understand", "realize", "recognize"],
    "building": ["tower", "structure", "high-rise", "construction", "project"],
    "fix": ["repair", "retrofit", "correct", "remedy", "change"],
    "wrong": ["incorrect", "false", "error", "mistake", "lie"],
    "right": ["correct", "true", "accurate", "proper"]
};

const THE_WITNESSES = {
    plaintiff: ["Dr. Rowan Hightower", "Reed Alvarez", "Dr. Ellis Chen"],
    defense: ["Cam Martinez", "Whitley Carter", "Ash Forrester"]
};

const RULES_LIST = [
    { id: "802", name: "Hearsay" },
    { id: "403", name: "Prejudicial / Waste of Time" },
    { id: "602", name: "Lack of Personal Knowledge" },
    { id: "404", name: "Improper Character Evidence" },
    { id: "701", name: "Improper Lay Opinion" },
    { id: "401", name: "Relevancy" },
    { id: "611", name: "Leading Question (Direct Only)" },
    { id: "805", name: "Double Hearsay" }
];

// ========== ACTION LOGGING ==========
function logAction(action) {
    const logEl = document.getElementById('last-action');
    if (logEl) {
        logEl.innerText = action;
        logEl.style.opacity = '1';
        // Fade out effect reset
        logEl.classList.remove('animate-pulse');
        void logEl.offsetWidth; // trigger reflow
        logEl.classList.add('animate-pulse');
    }
}

// NAVIGATION
function navigateTo(room) {
    document.querySelectorAll('.section-nav').forEach(s => s.classList.remove('active'));
    document.getElementById(room).classList.add('active');
    State.currentRoom = room;

    // Show/Hide Back Button
    const backNav = document.getElementById('back-nav');
    if (room === 'dashboard') {
        if(backNav) backNav.classList.add('hidden');
        logAction("Ready");
    } else {
        if(backNav) backNav.classList.remove('hidden');
        logAction(`Entered ${room.replace('-', ' ')}`);
    }

    // Stop all timers
    clearInterval(State.witness.interval);
    clearTimeout(State.objection.interval);
}

function showStep(room, stepId) {
    const steps = document.querySelectorAll(`#${room} .${room.split('-')[0]}-step`);
    steps.forEach(s => s.classList.add('hidden'));
    document.getElementById(stepId).classList.remove('hidden');
}

// --- WITNESS ROOM LOGIC ---
function initWitnessRoom() {
    navigateTo('witness-room');
    showStep('witness-room', 'wit-flow-1');
    logAction("Witness Room Initialized");
}

function selectWitSide(side) {
    State.witness.side = side;
    const container = document.getElementById('wit-list-cards');
    container.innerHTML = '';
    THE_WITNESSES[side].forEach(name => {
        const card = document.createElement('div');
        card.className = "glass p-8 rounded-2xl card text-center border-gold";
        card.innerHTML = `<div class="text-4xl mb-4">👤</div><h3 class="text-xl font-bold">${name}</h3>`;
        card.onclick = () => selectWitName(name);
        container.appendChild(card);
    });
    showStep('witness-room', 'wit-flow-2');
    logAction(`Selected Side: ${side}`);
}

function selectWitName(name) {
    State.witness.name = name;
    showStep('witness-room', 'wit-flow-3');
    logAction(`Selected Witness: ${name}`);
}

function selectWitMode(mode) {
    State.witness.mode = mode;
    startWitnessSession();
    logAction(`Selected Mode: ${mode}`);
}

function startWitnessSession() {
    clearInterval(State.witness.interval);
    showStep('witness-room', 'wit-chat-room');
    const side = State.witness.side;
    const wit = State.witness.name;
    const mode = State.witness.mode;

    // Populate Session Meta
    document.getElementById('wit-chat-meta').innerText = `${wit} | ${mode} Examination`;

    // Get Question Bank
    const rawBank = window.MockQuestionsDB[side][wit][mode];
    // Shuffle non-intro questions
    const introQ = rawBank[0];
    const others = rawBank.slice(1).sort(() => Math.random() - 0.5);
    State.witness.bank = [introQ, ...others];
    State.witness.qIndex = 0;
    State.witness.timer = 400; // 5 mins +

    // Initial UI Clear
    document.getElementById('wit-chat-feed').innerHTML = '';

    // Start Timer
    State.witness.interval = setInterval(() => {
        State.witness.timer--;
        const min = Math.floor(State.witness.timer / 60);
        const sec = State.witness.timer % 60;
        document.getElementById('wit-timer').innerText = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        if (State.witness.timer <= 0) {
            endWitnessSession("Time Expired.");
        }
    }, 1000);

    // Trigger First Question
    askWitnessNext();
}

function askWitnessNext() {
    if (State.witness.qIndex >= State.witness.bank.length) {
        endWitnessSession("The Examination is over.");
        return;
    }

    // 1. Get the question ready
    const qObj = State.witness.bank[State.witness.qIndex];

    // 2. Wait 1.5 seconds (1500 milliseconds) before showing it
    setTimeout(() => {
        appendMessage('bot', qObj.q, 'wit-chat-feed');
    }, 1500); 
}

function handleWitSend() {
    const input = document.getElementById('wit-user-msg');
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text, 'wit-chat-feed');
    input.value = '';
    logAction("Witness Testimony Submitted");

    // Check Keywords
    const qObj = State.witness.bank[State.witness.qIndex];
    const lowerText = text.toLowerCase();
    let matches = 0;
    qObj.keywords.forEach(k => {
        if (lowerText.includes(k.toLowerCase())) matches++;
    });

    if (matches < 1 && State.witness.qIndex > 0) {
        setTimeout(() => {
            appendMessage('bot', "Counsel: Counsel is not satisfied. Please be more specific with your answer.", 'wit-chat-feed');
        }, 800);
        return;
    }

    // Move to next question
    State.witness.qIndex++;
    setTimeout(() => {
        if (State.witness.qIndex === 10) {
            appendMessage('bot', "Counsel: Witness, let's turn our attention to the exhibits...", 'wit-chat-feed');
        }
        askWitnessNext();
    }, 1200);
}

function endWitnessSession(reason) {
    // 1. Stop the clock
    clearInterval(State.witness.interval);
    
    // 2. Find the chat box
    const feed = document.getElementById('wit-chat-feed');
    
    // 3. Create the report card
    const reportHTML = `
        <div style="border: 2px solid #d4af37; padding: 20px; margin-top: 20px; background: rgba(0,0,0,0.5); border-radius: 15px;">
            <h3 style="color: #d4af37; text-align: center;">COURTROOM PERFORMANCE REPORT</h3>
            <p><strong>Result:</strong> ${reason}</p>
            <p><strong>Questions Answered:</strong> ${State.witness.qIndex}</p>
            <hr style="border-color: rgba(255,255,255,0.1)">
            <p style="font-style: italic; color: #ccc;">Feedback: You handled the pressure well. Work on using more technical legal terms in your next session.</p>
            <button onclick="navigateTo('dashboard')" style="background: #d4af37; color: black; width: 100%; padding: 10px; margin-top: 10px; border-radius: 5px; font-weight: bold;">RETURN TO MAIN MENU</button>
        </div>
    `;
    
    // 4. Put the report on the screen
    feed.innerHTML += reportHTML;
    feed.scrollTop = feed.scrollHeight;
}

// --- LAWYER ROOM LOGIC ---
function initLawyerRoom() {
    navigateTo('lawyer-room');
    showStep('lawyer-room', 'law-flow-1');
    logAction("Lawyer Room Initialized");
}

function selectLawSide(side) {
    State.lawyer.side = side;
    showStep('lawyer-room', 'law-flow-2');
    logAction(`Selected Side: ${side}`);
}

function selectLawMode(mode) {
    State.lawyer.mode = mode;

    // Choose witnesses
    let targetSide = (mode === 'cross') ? (State.lawyer.side === 'plaintiff' ? 'defense' : 'plaintiff') : State.lawyer.side;
    const container = document.getElementById('law-list-cards');
    container.innerHTML = '';
    THE_WITNESSES[targetSide].forEach(name => {
        const card = document.createElement('div');
        card.className = "glass p-8 rounded-2xl card text-center border-gold";
        card.innerHTML = `<div class="text-4xl mb-4">👤</div><h3 class="text-xl font-bold">${name}</h3>`;
        card.onclick = () => startLawyerInquiry(name);
        container.appendChild(card);
    });
    showStep('lawyer-room', 'law-flow-3');
    logAction(`Selected Mode: ${mode}`);
}

function startLawyerInquiry(name) {
    State.lawyer.name = name;
    showStep('lawyer-room', 'law-chat-room');
    document.getElementById('law-hint-bar').classList.remove('hidden');
    document.getElementById('law-chat-meta').innerText = `EXAMINING: ${name}`;
    document.getElementById('law-chat-feed').innerHTML = '';
    logAction(`Selected Witness: ${name}`);

    // Hints
    State.lawyer.hints = [
        "Ask about the exact timeline of the construction memo.",
        "Inquire about the qualifications relative to wind loading.",
        "Press the witness on the difference between bolts and welds.",
        "Explore the financial motivations mentioned in page 4."
    ];
    cycleHint();
    State.lawyer.controlScore = 100; // Reset control score

    appendMessage('bot', `The witness, ${name}, has taken the stand. The floor is yours, Counselor.`, 'law-chat-feed');
}

function initRulesVault() {
    navigateTo('rules-vault');
    logAction("Accessed Knowledge Vault");
    const list = document.getElementById('rules-list');
    list.innerHTML = '';

    const rules = window.MockTrialRulesData || [];
    rules.forEach(rule => {
        const div = document.createElement('div');
        div.className = "glass p-6 rounded-xl border border-white/5 hover:border-gold transition-colors";
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-xl font-bold gold-text">Rule ${rule.rule}</h3>
                <span class="text-xs text-muted uppercase tracking-widest">${rule.name}</span>
            </div>
            <p class="text-sm text-gray-300 mb-4 italic">"${rule.desc}"</p>
            ${rule.tip ? `<div class="mb-2 text-xs"><span class="text-green-400 font-bold">PRO-TIP:</span> <span class="text-gray-400">${rule.tip}</span></div>` : ''}
            ${rule.pitfall ? `<div class="text-xs"><span class="text-red-400 font-bold">PITFALL:</span> <span class="text-gray-400">${rule.pitfall}</span></div>` : ''}
        `;
        list.appendChild(div);
    });
}

function filterRules() {
    const query = document.getElementById('rules-search').value.toLowerCase();
    const list = document.getElementById('rules-list');
    const cards = list.getElementsByTagName('div'); // This gets all divs, need to be careful

    // Better to re-render or toggle visibility of direct children
    const rules = window.MockTrialRulesData || [];
    list.innerHTML = '';
    
    rules.forEach(rule => {
        if (rule.rule.toLowerCase().includes(query) || 
            rule.name.toLowerCase().includes(query) || 
            rule.desc.toLowerCase().includes(query) ||
            (rule.tip && rule.tip.toLowerCase().includes(query)) ||
            (rule.pitfall && rule.pitfall.toLowerCase().includes(query))) {
            
            const div = document.createElement('div');
            div.className = "glass p-6 rounded-xl border border-white/5 hover:border-gold transition-colors animate-fadeIn";
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold gold-text">Rule ${rule.rule}</h3>
                    <span class="text-xs text-muted uppercase tracking-widest">${rule.name}</span>
                </div>
                <p class="text-sm text-gray-300 mb-4 italic">"${rule.desc}"</p>
                ${rule.tip ? `<div class="mb-2 text-xs"><span class="text-green-400 font-bold">PRO-TIP:</span> <span class="text-gray-400">${rule.tip}</span></div>` : ''}
                ${rule.pitfall ? `<div class="text-xs"><span class="text-red-400 font-bold">PITFALL:</span> <span class="text-gray-400">${rule.pitfall}</span></div>` : ''}
            `;
            list.appendChild(div);
        }
    });
}

// ========== UPDATED GEMINI BRIDGE ENGINE ==========
async function handleLawSend() {
    const input = document.getElementById('law-user-msg');
    const q = input.value.trim();
    if (!q) return;

    // 1. Display your question in the chat
    appendMessage('user', q, 'law-chat-feed');
    input.value = '';
    logAction("Question Sent to Witness...");

    // 2. Show a "Thinking..." message
    const typingId = "typing-" + Date.now();
    appendMessage('bot', "Witness is thinking...", 'law-chat-feed', typingId);

    // 3. YOUR WORKER URL (From your screenshot)
    const workerUrl = "https://gemini-bridge.sarveshmasalkar2.workers.dev/"; 

    try {
        const response = await fetch(workerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                prompt: `You are the witness ${State.lawyer.name}. Answer this lawyer's question briefly based on your affidavit: ${q}` 
            })
        });

        const result = await response.json();
        
        // Remove the "Thinking..." message
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        // 4. Parse Google's messy data format
        const rawData = result.data;
        const match = rawData.match(/\["([^"]+)"\]/);
        
        if (match && match[1]) {
            const cleanAnswer = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            appendMessage('bot', cleanAnswer, 'law-chat-feed');
        } else {
            appendMessage('bot', "The witness remains silent. (Check your Worker logs)", 'law-chat-feed');
        }

    } catch (error) {
        console.error("Bridge Error:", error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        appendMessage('bot', "The witness is unresponsive. Check your internet or Cloudflare variables.", 'law-chat-feed');
    }

    // Scroll to bottom
    const feed = document.getElementById('law-chat-feed');
    feed.scrollTop = feed.scrollHeight;
}
function cycleHint() {
    const h = State.lawyer.hints[Math.floor(Math.random() * State.lawyer.hints.length)];
    document.getElementById('law-hint-text').innerText = h;
}

// --- OBJECTION ROOM LOGIC ---
function initObjectionRoom() {
    navigateTo('objection-room');
    showStep('objection-room', 'obj-flow-1');
    logAction("Objection Room Initialized");
}

async function startObjectionSim(diff) {
    State.objection.difficulty = diff;
    State.objection.pressureMode = document.getElementById('pressure-mode-toggle')?.checked || false;
    
    logAction(`Started Obj Sim: ${diff} (Pressure: ${State.objection.pressureMode})`);
    showStep('objection-room', 'obj-countdown');

    const timerEl = document.getElementById('countdown-text');
    for (let i = 3; i > 0; i--) {
        timerEl.innerText = i;
        await new Promise(r => setTimeout(r, 1000));
    }

    showStep('objection-room', 'obj-sim-room');

    // Randomly slice 5 mins (roughly 50 lines) from 1-hour script (600 lines)
    // Ensure MockScriptsDB exists
    const fullScript = (window.MockScriptsDB && window.MockScriptsDB[diff]) ? window.MockScriptsDB[diff] : [];
    if (fullScript.length === 0) {
        console.error("No script found for difficulty:", diff);
        return;
    }

    const startIdx = Math.floor(Math.random() * Math.max(0, fullScript.length - 50));
    // Always prepend name question per requirement if possible
    const segment = fullScript.slice(startIdx, startIdx + 50);
    
    State.objection.script = segment;
    State.objection.lineIndex = 0;
    // Slower default speed (was 3000, maybe make it 4000 or 5000)
    State.objection.timer = 5000; 

    document.getElementById('obj-sim-display').innerHTML = '';
    
    playNextLine();
}

function playNextLine() {
    if (State.objection.lineIndex >= State.objection.script.length) {
        return;
    }

    const line = State.objection.script[State.objection.lineIndex];
    const div = document.createElement('div');
    div.className = "mb-4 animate-fadeIn border-l-2 border-white/5 pl-4";
    div.innerHTML = `<span class="gold-text font-bold uppercase text-xs tracking-widest">${line.speaker}:</span> <span class="text-white">${line.text}</span>`;

    const area = document.getElementById('obj-sim-display');
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;

    // Grace window: keep activeViolation alive for 2 lines after violation
    if (line.isViolation) {
        State.objection.activeViolation = line;
        State.objection.violationGrace = 2;
    } else {
        if (State.objection.violationGrace > 0) {
            State.objection.violationGrace--;
        } else {
            State.objection.activeViolation = null;
        }
    }

    State.objection.lineIndex++;
    const perc = (State.objection.lineIndex / State.objection.script.length) * 100;
    const progBar = document.getElementById('obj-progress');
    if(progBar) progBar.style.width = `${perc}%`;

    // Calculate next delay
    let delay = State.objection.timer;
    if (State.objection.pressureMode) {
        // Make pressure mode start faster or accelerate more noticeably
        // If default is 5000, maybe start pressure at 3000 and accelerate
        if (State.objection.lineIndex === 1) delay = 3000; 
        delay = Math.max(800, delay * 0.90); // Speed up by 10% each line
        State.objection.timer = delay;
    }

    State.objection.interval = setTimeout(playNextLine, delay);
}

function handleObjectionClick() {
    // Pause
    clearTimeout(State.objection.interval);
    logAction("OBJECTION CLICKED");

    const overlay = document.getElementById('objection-overlay');
    const options = document.getElementById('objection-options');
    options.innerHTML = '';

    // Ensure MockTrialRulesData exists
    const rules = window.MockTrialRulesData || [];
    rules.forEach(rule => {
        const btn = document.createElement('button');
        btn.className = "btn-outline py-3 px-4 rounded text-left text-sm flex justify-between hover:bg-white/5 transition-colors";
        btn.innerHTML = `<span class="font-mono text-gold-400">Rule ${rule.rule}</span><span class="text-gray-300">${rule.name}</span>`;
        btn.onclick = () => submitObjection(rule.rule);
        options.appendChild(btn);
    });

    overlay.style.display = 'flex';
}

function submitObjection(ruleId) {
    const overlay = document.getElementById('objection-overlay');
    overlay.style.display = 'none';
    logAction(`Submitted Objection: Rule ${ruleId}`);

    const violation = State.objection.activeViolation;
    let isSuccess = false;
    let title = "OVERRULED";
    let msg = "There was no legal grounds for an objection here.";

    if (violation) {
        if (String(violation.ruleNum) === String(ruleId)) { // Use ruleNum from script
            isSuccess = true;
            title = "SUSTAINED";
            msg = violation.reason || "Correct objection.";
        } else {
            msg = `Actually, the violation was Rule ${violation.ruleNum}: ${violation.ruleName || ''}.`;
        }
    }

    showSimFeedback(isSuccess, title, msg);
    
    // Save result
    saveObjectionResult(isSuccess);

    // Resume
    State.objection.interval = setTimeout(playNextLine, 3000);
}

function showSimFeedback(isSuccess, title, msg) {
    const div = document.createElement('div');
    div.className = `p-6 rounded-xl border-2 mb-4 ${isSuccess ? 'border-green-500 bg-green-950/20' : 'border-red-500 bg-red-950/20'}`;
    div.innerHTML = `<h3 class="text-xl font-bold ${isSuccess ? 'text-green-500' : 'text-red-500'}">${title}</h3><p class="text-xs text-muted">${msg}</p>`;
    document.getElementById('obj-sim-display').appendChild(div);
    document.getElementById('obj-sim-display').scrollTop = document.getElementById('obj-sim-display').scrollHeight;
}

function closeObjectionMenu() {
    document.getElementById('objection-overlay').style.display = 'none';
}

// UTILITIES
function appendMessage(sender, text, feedId) {
    const feed = document.getElementById(feedId);
    const div = document.createElement('div');
    const isBot = sender === 'bot';
    div.className = `p-4 rounded-xl max-w-[80%] ${isBot ? 'bg-court-panel mr-auto border-l-2 border-gold' : 'bg-slate-700 ml-auto border-r-2 border-blue-400'}`;
    div.innerHTML = `<p class="text-xs font-bold uppercase gold-text mb-1">${isBot ? 'Computer' : 'You'}</p><p class="text-sm">${text}</p>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
}

// Force-fix the witness mapping to ensure Reed Alvarez is searchable
const fixWitnessMapping = () => {
    const rawData = window.MockTrialCaseData.witnesses;
    const reedKey = Object.keys(rawData).find(k => k.includes("Reed Alvarez"));
    if (reedKey) {
        window.MockTrialCaseData.witnesses["Reed Alvarez"] = rawData[reedKey];
    }
};

// INIT
window.addEventListener('load', () => {
    fixWitnessMapping();
    App.init();
});

const App = {
    init: function () {
        console.log("Quantum Engine Ready.");
        sanitizeAndBridgeData();    // <-- ADD THIS LINE
        this.patchDatabase();
        this.loadStats();
    },

    patchDatabase: function () {
        // Fix for collapsed witness data in MockTrialCaseData
        if (!window.MockTrialCaseData || !window.MockTrialCaseData.witnesses) return;

        const originalWitnesses = window.MockTrialCaseData.witnesses;
        const patched = {};

        Object.keys(originalWitnesses).forEach(key => {
            let currentWit = key;
            if (currentWit.toLowerCase().includes("affidavit of")) {
                currentWit = currentWit.replace(/affidavit of/i, '').split(',')[0].trim();
            }

            patched[currentWit] = [];

            originalWitnesses[key].forEach(line => {
                const witMatch = line.match(/Affidavit of\s*([^,]+)/i) ||
                    line.match(/Plaintiff – ([^,]+)/i) ||
                    line.match(/Defense – ([^,]+)/i);

                if (witMatch && line.length < 100) {
                    currentWit = witMatch[1].trim();
                    patched[currentWit] = patched[currentWit] || [];
                } else {
                    if (currentWit) patched[currentWit].push(line);
                }
            });
        });

        window.MockTrialCaseData.witnesses = patched;
        console.log("Database Patched. Witnesses found:", Object.keys(patched));
    },

    loadStats: function () {
        const stats = JSON.parse(localStorage.getItem('quantum_legal_stats') || '{"accuracy": 0, "objections": 0, "total": 0}');
        document.getElementById('stat-accuracy').innerText = stats.total > 0 ? Math.round((stats.objections / stats.total) * 100) + '%' : '0%';

        const acc = stats.total > 0 ? (stats.objections / stats.total) : 0;
        let rank = "Novice";
        if (acc > 0.4) rank = "Clerk";
        if (acc > 0.7) rank = "Associate";
        if (acc > 0.9) rank = "Partner";
        document.getElementById('stat-rank').innerText = rank;
    },

    saveObjectionResult: function (isCorrect) {
        const stats = JSON.parse(localStorage.getItem('quantum_legal_stats') || '{"accuracy": 0, "objections": 0, "total": 0}');
        stats.total++;
        if (isCorrect) stats.objections++;
        localStorage.setItem('quantum_legal_stats', JSON.stringify(stats));
        this.loadStats();
    }
};

function restartRoom() {
    if (State.currentRoom === 'dashboard') {
        localStorage.removeItem('quantum_legal_stats');
        App.loadStats();
        alert("Stats Reset.");
    } else {
        navigateTo('dashboard');
    }
}

// Wrap submitObjection to save stats
const originalSubmitObjection = submitObjection;
submitObjection = function (ruleId) {
    const violation = State.objection.activeViolation;
    const isCorrect = !!(violation && violation.ruleNum === ruleId);
    App.saveObjectionResult(isCorrect);
    originalSubmitObjection(ruleId);
};
