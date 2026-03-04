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
    logAction("Accessed Review Room");

    // Load mastery badge
    _rv_updateMasteryBadge();

    // Default to strategy tab
    switchReviewTab('strategy', document.querySelector('.rv-tab'));

    // Pre-load rules list (for when user navigates to rules tab)
    _rv_renderRulesList();
}
function filterRules() {
    const query = document.getElementById('rules-search').value.toLowerCase();
    const list = document.getElementById('rules-list');
    if (!list) return;
    const rules = window.MockTrialRulesData || [];
    list.innerHTML = '';
    rules.forEach(rule => {
        if (rule.rule.toLowerCase().includes(query) ||
            rule.name.toLowerCase().includes(query) ||
            rule.desc.toLowerCase().includes(query) ||
            (rule.tip && rule.tip.toLowerCase().includes(query)) ||
            (rule.pitfall && rule.pitfall.toLowerCase().includes(query))) {
            const div = document.createElement('div');
            div.className = "glass p-5 rounded-xl border border-white/5 hover:border-gold transition-colors";
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2 flex-wrap gap-1">
                    <h3 style="font-family:'Playfair Display',serif; font-size:1.1rem; font-weight:700; color:var(--gold);">Rule ${rule.rule}</h3>
                    <span style="font-size:0.6rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-muted); background:rgba(255,255,255,0.07); padding:3px 8px; border-radius:50px;">${rule.name}</span>
                </div>
                <p style="font-size:0.78rem; color:#cbd5e1; margin-bottom:10px; font-style:italic; line-height:1.6;">"${rule.desc}"</p>
                ${rule.tip ? `<div style="font-size:0.72rem; margin-bottom:6px;"><span style="color:#4ade80; font-weight:700;">PRO-TIP: </span><span style="color:#94a3b8;">${rule.tip}</span></div>` : ''}
                ${rule.pitfall ? `<div style="font-size:0.72rem;"><span style="color:#fca5a5; font-weight:700;">PITFALL: </span><span style="color:#94a3b8;">${rule.pitfall}</span></div>` : ''}
            `;
            list.appendChild(div);
        }
    });
}

async function handleLawSend() {
    const input = document.getElementById('law-user-msg');
    const q = input.value.trim();
    if (!q) return;

    // Display user message immediately
    appendMessage('user', q, 'law-chat-feed');
    input.value = '';

    // 1. EINSTEIN SEARCH FUSION: Scanning the 81-page array
    const witnessName = State.lawyer.name;
    const allPages = window.FullCaseContext || [];
    const keywords = q.toLowerCase().split(' ').filter(w => w.length > 3);
    
    // We score every line in the 81 pages based on relevance
    let scoredLines = allPages.map(line => {
        let score = 0;
        const lowerLine = line.toLowerCase();
        
        // Bonus for matching the current witness name
        if (lowerLine.includes(witnessName.toLowerCase())) score += 10;
        
        // Points for keyword matches
        keywords.forEach(word => {
            if (lowerLine.includes(word)) score += 5;
        });
        
        return { text: line, score: score };
    });

    // Pick the top 8 most relevant "Fact Chunks"
    const relevantFacts = scoredLines
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(item => item.text)
        .join("\n");

    // 2. SEND TO CLOUDFLARE
    const workerUrl = "https://gemini-bridge.sarveshmasalkar2.workers.dev/"; 

    try {
        const response = await fetch(workerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                prompt: q,
                context: relevantFacts, // The "Cheat Sheet"
                witnessName: witnessName
            })
        });

        const result = await response.json();
        
        if (result.response) {
            appendMessage('bot', result.response, 'law-chat-feed');
        } else {
            appendMessage('bot', "The witness remains silent.", 'law-chat-feed');
        }
    } catch (error) {
        console.error("Search Fusion Error:", error);
        appendMessage('bot', "The witness is unresponsive.", 'law-chat-feed');
    }

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
    clearTimeout(State.objection.interval);
    document.body.style.overflow = 'hidden'; // Lock Scroll
    
    const overlay = document.getElementById('objection-overlay');
    overlay.style.display = 'flex';
    
    const options = document.getElementById('objection-options');
    options.innerHTML = '';
    
    // THE FIX: Use window.MockTrialRulesData to generate buttons
    const rules = window.MockTrialRulesData || [];
    rules.forEach(rule => {
        const btn = document.createElement('button');
        btn.className = "objection-rule-btn";
        btn.innerHTML = `<span>Rule ${rule.rule}</span><span>${rule.name}</span>`;
        
        // FAST TOUCH LOGIC: Responds instantly to finger taps
        const trigger = (e) => {
            e.preventDefault();
            submitObjection(rule.rule);
        };
        btn.addEventListener('touchend', trigger);
        btn.addEventListener('click', trigger);
        
        options.appendChild(btn);
    });
}

function submitObjection(ruleId) {
    // 1. Get the current line from the script to see if it's a violation
    const currentLine = State.objection.script[State.objection.lineIndex];
    const isCorrect = currentLine.isViolation && String(currentLine.ruleNum) === String(ruleId);
    
    const overlay = document.getElementById('objection-overlay');
    document.body.style.overflow = 'auto'; // Unlock Scroll
    overlay.style.display = 'none';

    // 2. Create the Feedback Banner
    const feedback = document.createElement('div');
    feedback.className = "judge-feedback-banner";
    feedback.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; text-align: center; font-family: 'Playfair Display', serif;
        background: ${isCorrect ? 'rgba(21, 128, 61, 0.95)' : 'rgba(153, 27, 27, 0.95)'};
    `;

    // 3. Logic for "Why it is incorrect"
    let detailText = "";
    if (isCorrect) {
        detailText = `Correct! ${currentLine.reason || ""}`;
    } else if (currentLine.isViolation) {
        detailText = `Incorrect. You selected Rule ${ruleId}, but this was actually ${currentLine.ruleName} (Rule ${currentLine.ruleNum}).`;
    } else {
        detailText = `Incorrect. This statement was actually admissible (No Violation).`;
    }

    feedback.innerHTML = `
        <h1 style="font-size: 4rem; margin-bottom: 1rem;">${isCorrect ? "SUSTAINED" : "OVERRULED"}</h1>
        <p style="font-size: 1.5rem; max-width: 80%;">${detailText}</p>
    `;
    
    document.body.appendChild(feedback);

    // Save stats
    App.saveObjectionResult(isCorrect);

    // 4. Resume the simulation after a short delay
    setTimeout(() => {
        feedback.remove();
        playNextLine(); 
    }, 2500);
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


const ReviewState = {
        activeTab: 'strategy',
        activeTechnique: 'looping',
        listenSim: {
                active: false,
                lineIndex: 0,
                utterance: null,
                score: 0,
                total: 0
        },
        runaway: {
                scenarioIndex: 0,
                score: 0,
                total: 0,
                active: false
        },
        factLab: {
                neutralized: new Set()
        },
        drill: {
                score: 0,
                streak: 0,
                total: 0,
                timerInterval: null,
                timerRemaining: 8,
                answered: false,
                currentScenarioIdx: -1
        },
        rulesMode: 'browse'
};

// ── Content Data ───────────────────────────────────────────────────────
const REVIEW_DATA = {

    techniques: {
        looping: {
            name: "Looping",
            definition: "Take the witness's own words verbatim from their last answer and embed them directly in your next question. This locks them to their testimony, prevents backtracking, and forces the jury to hear the key phrase twice.",
            when: "Use on direct when a witness gives a strong, favorable answer you want the jury to anchor on. Use on cross to pin a witness to a damaging admission before moving to the next step.",
            example: {
                witness: "Dr. Rowan Hightower",
                type: "Direct Examination — Plaintiff",
                dialog: [
                    { role: "Q", text: "Dr. Hightower, what did your structural analysis reveal about the connections used in the East Superior Tower?" },
                    { role: "A", text: "My analysis revealed that the bolted shear connections — substituted for the original welded moment connections — significantly reduced the building's lateral stiffness under quartering wind loads.", highlight: null },
                    { role: "Q", text: "<mark>Those bolted shear connections, substituted for the original welded moment connections</mark> — what standard of care governed the original design at that joint?", highlight: "bolted shear connections, substituted for the original welded moment connections", note: "[LOOP: attorney repeats exact witness language]" },
                    { role: "A", text: "The original Apex specifications in Exhibit 4 required welded moment connections at every critical joint in the elevated column framework.", highlight: null },
                    { role: "Q", text: "<mark>Those critical joints in the elevated column framework</mark> — if they had been welded as originally specified, would the quartering wind vulnerability still exist?", highlight: "critical joints in the elevated column framework", note: "[LOOP: second loop, compounds the anchoring]" }
                ]
            },
            tip: "Never paraphrase. 'The bolted connections you mentioned' is not a loop — it's a trap door. The witness's exact words, nothing more."
        },
        headlining: {
            name: "Headlining",
            definition: "Signal to the jury exactly what topic is coming before you ask the question. Creates structural clarity, builds anticipation, and ensures the jury's attention is primed for the key testimony.",
            when: "Use at the opening of every major topic transition in direct examination. Especially effective when moving from background to the substance of a witness's testimony.",
            example: {
                witness: "Reed Alvarez",
                type: "Direct Examination — Plaintiff",
                dialog: [
                    { role: "Q", text: "Mr. Alvarez, I want to start with your professional background. Can you briefly walk the court through your career before becoming HOA President?" },
                    { role: "A", text: "Of course. I'm a retired attorney. I earned my Juris Doctor from the University of Miami School of Law and practiced civil litigation for over 30 years." },
                    { role: "Q", text: "<mark>Now, Mr. Alvarez — I want to leave your background entirely and bring you to a specific moment in March of 2016: the moment you first learned that the East Superior Tower had what engineers would later call a latent structural hazard.</mark> Tell us what happened.", highlight: "Now, Mr. Alvarez — I want to leave your background entirely and bring you to a specific moment in March of 2016: the moment you first learned that the East Superior Tower had what engineers would later call a latent structural hazard.", note: "[HEADLINE: signals topic, creates anticipation, focuses the jury]" },
                    { role: "A", text: "In March of 2016, I received the whistleblower memo — Exhibit 1. It was from a concerned engineer at Apex. My blood boiled when I read it." }
                ]
            },
            tip: "A headline summarizes the topic, it does not reveal the answer. Think chapter title, not plot spoiler. 'I want to turn to the retrofit vote' — not 'I want to turn to the 51-49 vote that proved residents were divided.'"
        },
        scenesetting: {
            name: "Scene Setting",
            definition: "Transport the jury to the exact moment in time when a critical event occurred. Establish the physical environment, the sensory details, and the surrounding context before introducing the key fact.",
            when: "Use before any testimony about a pivotal event, discovery, or confrontation. Gives non-technical testimony credibility and makes the jury feel present.",
            example: {
                witness: "Whitley Carter",
                type: "Direct Examination — Defense",
                dialog: [
                    { role: "Q", text: "<mark>Mr. Carter — take us back to the summer of 2014. You're standing at 109 Summit Hill Drive. The East Superior Tower construction site. What does it look like?</mark>", highlight: "Mr. Carter — take us back to the summer of 2014. You're standing at 109 Summit Hill Drive. The East Superior Tower construction site. What does it look like?", note: "[SCENE SET: sensory prompt, transports the jury to the location]" },
                    { role: "A", text: "It was a massive site. A 30-story steel skeleton rising against the skyline. Cranes, workers, the smell of fresh concrete. Organized. Everything appeared to be in order." },
                    { role: "Q", text: "And in that environment — that organized, active construction site — what was your specific job that day?" },
                    { role: "A", text: "I was the assigned city inspector. My responsibility was to verify the structural steel framework complied with the International Building Code." },
                    { role: "Q", text: "Walk us through what you physically observed during that structural steel inspection.", note: "[Scene now set: every answer carries the weight of a person who was THERE]" }
                ]
            },
            tip: "Ask sensory questions: 'What does it look like? Who is present? What is happening around you?' The jury's imagination is your most powerful tool."
        },
        volunteering: {
            name: "Volunteering Weaknesses",
            definition: "Proactively raise the opposing side's best attack point during your own direct examination, before opposing counsel can deploy it on cross. Defuse the bomb yourself.",
            when: "Use when you know opposing counsel has ammunition that could damage your witness's credibility on cross. Taking the hit first on your terms dramatically reduces its impact.",
            example: {
                witness: "Dr. Ellis Chen",
                type: "Direct Examination — Plaintiff",
                dialog: [
                    { role: "Q", text: "<mark>Dr. Chen — before we get to your independent findings, I want to address something directly. The wind analysis underlying your opinion was initially performed by a Ph.D. student you were supervising — not by you personally. Is that correct?</mark>", highlight: "I want to address something directly. The wind analysis underlying your opinion was initially performed by a Ph.D. student you were supervising — not by you personally.", note: "[VOLUNTEER: raise the weakness yourself, on your timeline, in a controlled context]" },
                    { role: "A", text: "That is correct. The original computational model was developed as part of a doctoral dissertation I was advising at Columbia." },
                    { role: "Q", text: "And at the time those findings were presented to the HOA, that research had not yet completed formal peer review. Also correct?" },
                    { role: "A", text: "Yes. It was in pre-publication stage at the time." },
                    { role: "Q", text: "Given those facts — a student model, not yet peer-reviewed — what did you personally do before presenting these findings to Mr. Alvarez and the HOA Board?", note: "[Now the jury hears the strength, not just the weakness]" },
                    { role: "A", text: "I ran independent wind tunnel tests using my own lab's equipment, confirmed the student's findings point-by-point, and only then presented the results. I would never present speculative research to a homeowners association." }
                ]
            },
            tip: "Your tone must be confident, not apologetic. The message is: 'We know about this. It does not change the conclusion. Here is exactly why.'"
        },
        threecs: {
            name: "Three C's of Impeachment",
            definition: "Commit → Credit → Confront. First lock the witness firmly to their prior inconsistent statement. Then establish their authority as someone who would have known the truth. Then produce the contradiction.",
            when: "Use on cross-examination whenever a witness's trial testimony contradicts their prior affidavit, deposition, or written statement. This is your primary impeachment weapon.",
            example: {
                witness: "Cam Martinez",
                type: "Cross-Examination — Defense Witness",
                dialog: [
                    { role: "Q", text: "<mark>[COMMIT]</mark> Mr. Martinez — you testified on direct that Metro Builders constructed this building according to the approved plans. Without deviation. Those were your words.", highlight: "COMMIT", note: "[Step 1: Lock them to the prior statement. Precise, calm, no editorializing.]" },
                    { role: "A", text: "That is correct." },
                    { role: "Q", text: "And in your own affidavit — your sworn, written statement — you stated that Metro fulfilled its contractual obligations 'fully and without defect.' Those are your words?" },
                    { role: "A", text: "Yes." },
                    { role: "Q", text: "<mark>[CREDIT]</mark> You were the lead project manager on this tower. You oversaw every phase of construction. No one knows what Metro Builders did on this project better than you?", highlight: "CREDIT", note: "[Step 2: Elevate their authority. They can't later claim they 'didn't know.']" },
                    { role: "A", text: "That is fair to say, yes." },
                    { role: "Q", text: "<mark>[CONFRONT]</mark> Then I am going to ask you to look at this document — the change order, signed by a Metro Builders representative — authorizing the substitution of bolted shear connections for the welded moment connections that appear in the original approved plans. Do you see that?", highlight: "CONFRONT", note: "[Step 3: Produce the contradiction. Say nothing. Let the document speak.]" },
                    { role: "A", text: "That — that change was approved by Apex Engineering." },
                    { role: "Q", text: "It was proposed by Metro Builders. Signed by Metro Builders. That is a fact, yes?" }
                ]
            },
            tip: "Never show the document until the witness is completely locked in. The contradiction only lands if they have no escape route. Do not rush Step 1."
        },
        chapter: {
            name: "Chapter Method",
            definition: "Divide your cross-examination into clearly titled, thematic chapters. Each chapter is a standalone argument. Announce each chapter with a headline. The jury follows you like a book, not a brawl.",
            when: "Use for any cross-examination covering multiple attack points. Particularly effective against expert witnesses where credibility, methodology, and conclusions are all in play.",
            example: {
                witness: "Ash Forrester",
                type: "Cross-Examination — Defense Expert",
                dialog: [
                    { role: "Q", text: "<mark>Dr. Forrester — Chapter One: Your Relationship With Apex.</mark> Your firm has consulted for Apex Engineering on prior projects at least five times in the past fifteen years?", highlight: "Chapter One: Your Relationship With Apex.", note: "[Announce the chapter. The jury knows exactly where you are going.]" },
                    { role: "A", text: "We have collaborated on several projects over the years, yes." },
                    { role: "Q", text: "And on each of those engagements, Apex Engineering paid your firm for your services?" },
                    { role: "A", text: "That is how consulting works." },
                    { role: "Q", text: "<mark>Chapter Two: The Engineering Record.</mark> You agree that welded moment connections provide greater resistance to lateral loads than bolted shear connections?", highlight: "Chapter Two: The Engineering Record.", note: "[New chapter. Clean break. The jury resets their attention.]" },
                    { role: "A", text: "In general terms, yes — welded moment connections offer higher lateral stiffness." },
                    { role: "Q", text: "And the original Apex design specifications called for welded moment connections at the critical elevated column joints?" },
                    { role: "A", text: "Yes, that was the original specification before the change order." },
                    { role: "Q", text: "<mark>Chapter Three: The Unnecessary Fix.</mark> You testified that the $22.6 million retrofit was unnecessary. But that retrofit has already been performed. And the building, as retrofitted, is structurally superior to the as-built original — correct?", highlight: "Chapter Three: The Unnecessary Fix.", note: "[Final chapter — the closing argument argument built into cross.]" },
                    { role: "A", text: "The retrofitted structure is more conservative, yes." },
                    { role: "Q", text: "So the only real question is whether it needed fixing before the retrofit. And on that question, two licensed engineers with no financial relationship to either party disagree with your conclusion?" }
                ]
            },
            tip: "Each chapter should end on a concession. Do not move to the next chapter until you have the concession you need. Never leave a chapter open-ended."
        }
    },

    runawayScenarios: [
        {
            q: "Mr. Alvarez — when, specifically, did you first receive the whistleblower memo?",
            evasion: "Well, you know, there were a lot of communications going back and forth at that time, and really what I want to say is that this building had always made me nervous ever since day one and I had been monitoring things for years before this memo ever arrived...",
            choices: [
                { text: "Interrupt and ask a completely different question", action: "abandon", correct: false, explanation: "Never abandon mid-answer. You lose control of the examination and signal to opposing counsel — and the jury — that you are rattled." },
                { text: "Repeat the exact question word-for-word, calmly", action: "repeat", correct: true, explanation: "Correct. Deadpan, unhurried: 'Mr. Alvarez — when, specifically, did you first receive the whistleblower memo?' The jury hears the evasion twice. That is the point." },
                { text: "Say: 'Please just answer yes or no'", action: "restrict", correct: false, explanation: "This can backfire — the judge may sustain an objection or allow the witness to explain. Repeat the question first. Control through repetition, not restriction." }
            ]
        },
        {
            q: "Mr. Martinez — Metro Builders proposed the substitution from welded to bolted connections. Yes or no?",
            evasion: "I think what's really important to understand here is the collaborative nature of the engineering process. Apex ultimately reviewed and approved the change, so to characterize it as being 'proposed by Metro' without any context is really quite unfair to the process that actually took place...",
            choices: [
                { text: "Say 'Let me rephrase that question for you'", action: "rephrase", correct: false, explanation: "Rephrasing signals the witness's evasion worked. Never rephrase in response to a deliberate non-answer. That is a concession." },
                { text: "Repeat the exact question word-for-word, calmly", action: "repeat", correct: true, explanation: "Correct. 'Mr. Martinez — Metro Builders proposed the substitution from welded to bolted connections. Yes or no?' The jury sees the evasion in full light." },
                { text: "Move on to a new question about the change order", action: "abandon", correct: false, explanation: "This lets the witness completely off the hook on your strongest point. Never move on from a question you haven't gotten an answer to." }
            ]
        },
        {
            q: "Dr. Forrester — your firm received payment from the defense to prepare your expert report?",
            evasion: "Expert witnesses are always compensated for their time and expertise, that is simply how the judicial system functions, and I want to be absolutely clear that my opinions are entirely my own and are in no way influenced by any compensation arrangement whatsoever, and I resent any implication to the contrary...",
            choices: [
                { text: "Apologize and move on to the next topic", action: "abandon", correct: false, explanation: "Never apologize for a proper question. Apologizing tells the jury you were out of line — you were not." },
                { text: "Repeat the exact question word-for-word, calmly", action: "repeat", correct: true, explanation: "Correct. 'Dr. Forrester — your firm received payment from the defense to prepare your expert report?' The lengthy, defensive non-answer IS the point. The jury sees it." },
                { text: "Argue: 'That sounds like bias to me, Doctor'", action: "argue", correct: false, explanation: "Never argue with the witness. They will out-talk you, and the jury dislikes attorneys who bicker. Ask the question. Let the jury draw the inference." }
            ]
        }
    ],

    badFacts: [
        {
            fact: "The East Superior Tower passed city inspection and received a Certificate of Occupancy in 2014.",
            context: "Whitley Carter signed off on the structural steel framework — including the bolted connections — and issued the Certificate of Occupancy upon project completion.",
            neutralizer: "Code compliance is the floor, not the ceiling. A Certificate of Occupancy confirms the building met minimum standards — it does not certify it was optimally designed. The inspection was conducted without knowledge of the quartering wind vulnerability because no dynamic wind load analysis was required by code at the time. Minimum compliance with a code that did not require this specific analysis cannot immunize Apex's design decision.",
            plaintiff_counter: "For plaintiff: The CO was issued without the full picture. Whitley Carter was not provided the change order documentation. The approved plans Carter inspected were already the compromised plans. Compliance with deficient plans is not exoneration.",
            exhibit_link: "Exhibit 7 — Final Inspection Report & Certificate of Occupancy"
        },
        {
            fact: "The HOA retrofit vote was only 51% to 49% — nearly half of all unit owners voted against it.",
            context: "Reed Alvarez acknowledges the narrow margin. The defense will use this to suggest an overreaction or that the structural concern was not universally accepted.",
            neutralizer: "The 49% who voted against the retrofit were voting against the financial burden — not against the engineering science. Every expert who reviewed the structural data supported the finding. No opposing expert testified the building was safe as built. The narrow vote reflects the $22.6M cost, not scientific disagreement.",
            plaintiff_counter: "For plaintiff: A majority of people living in a structurally vulnerable building voted to fix it, even knowing the cost. That is not overreaction. That is informed decision-making under extraordinary circumstances.",
            exhibit_link: "Exhibit 8 — Emergency HOA Meeting Minutes, March 14, 2016"
        },
        {
            fact: "The emergency retrofit cost $22.6 million — a sum borne by unit owners.",
            context: "The defense may argue this cost demonstrates the plaintiff's theory is economically motivated, or that the HOA overreacted and created costs unnecessarily.",
            neutralizer: "The $22.6M is not evidence against the plaintiff — it is the measure of the defendants' harm. The greater the cost to correct the deficiency, the more serious the deficiency. Apex's decision to substitute weaker connections created a problem requiring $22.6M to correct. Every dollar of that cost originates from Apex's engineering decision.",
            plaintiff_counter: "For plaintiff: Every one of those 22.6 million dollars came from the pockets of homeowners who had no part in the engineering decision. This is not the HOA's debt. It is the cost Apex imposed on innocent people.",
            exhibit_link: "Exhibit 10 — Structural Retrofit Invoice"
        },
        {
            fact: "Dr. Chen's wind analysis originated with a Ph.D. student's dissertation — unpublished and not peer-reviewed at the time of disclosure.",
            context: "The defense will characterize the foundational science behind the plaintiff's case as unverified graduate student work, not established research.",
            neutralizer: "The student model was the alarm. Three independent credentialed experts confirmed the fire. Dr. Chen ran independent wind tunnel tests using university-grade equipment and confirmed the findings personally. Dr. Hightower — a dual-doctorate licensed PE with 25+ years of experience — independently verified the resonance effect. The study's preliminary status did not prevent expert verification.",
            plaintiff_counter: "For plaintiff: If the science was speculative, why did Apex's own engineer Samuel Greene write the whistleblower memo at all? Their internal warning preceded any outside research. The graduate model confirmed what Apex already knew and concealed.",
            exhibit_link: "Exhibit 2 — Executive Summary (Dr. Chen); Exhibit 4 — Dr. Hightower's Report"
        },
        {
            fact: "Cam Martinez testified that Metro Builders 'fulfilled its contractual obligations fully and without defect.'",
            context: "The defense position is that Metro simply executed what Apex approved — a contractor following engineer-approved plans bears no independent responsibility.",
            neutralizer: "Metro did not simply follow plans — Metro proposed the substitution. The change from welded to bolted connections was initiated by Metro Builders and executed under a change order Metro signed. Metro cannot simultaneously claim credit for cost savings from a substitution they proposed and disclaim responsibility for its structural consequences.",
            plaintiff_counter: "For plaintiff: Use the Three C's here. Commit Martinez to 'no deviation.' Credit him as lead project manager. Confront him with the signed change order. The contradiction is in his own documents.",
            exhibit_link: "Change order documentation, construction records"
        }
    ],

    battleDrills: [
        {
            scenario: "\"You heard the contractor tell the inspector that the building had structural problems, right?\"",
            speaker: "Attorney to Witness",
            correct: "802",
            distractors: ["602", "403", "701"],
            explanation: "Hearsay (Rule 802). The contractor's statement is out-of-court, offered to prove the building had structural problems — i.e., offered for its truth.",
            tip: "Ask: out-of-court statement + offered for its truth? Yes → Rule 802."
        },
        {
            scenario: "\"In my opinion as a homeowner, the bolted connections were definitely structurally deficient.\"",
            speaker: "Reed Alvarez — Witness",
            correct: "701",
            distractors: ["802", "403", "611"],
            explanation: "Improper Lay Opinion (Rule 701). Alvarez is a retired attorney and HOA president. Assessing whether structural connections are 'deficient' requires specialized engineering expertise — not everyday experience.",
            tip: "Can a reasonable person form this opinion from everyday experience alone? No technical expertise required → probably fine. Specialized knowledge needed → Rule 701."
        },
        {
            scenario: "\"Metro Builders has always cut corners on every project they've built. That's just who they are.\"",
            speaker: "Plaintiff's Lawyer",
            correct: "404",
            distractors: ["802", "403", "602"],
            explanation: "Improper Character Evidence (Rule 404). This uses prior conduct (past corner-cutting) to prove propensity — they did it before, they did it here. Textbook Rule 404 violation.",
            tip: "Is it arguing 'they did it before, so they did it again'? Propensity reasoning = Rule 404."
        },
        {
            scenario: "\"So you agree the building was structurally compromised, don't you?\" [asked on direct examination]",
            speaker: "Plaintiff's Lawyer to Dr. Hightower — Direct Exam",
            correct: "611",
            distractors: ["701", "403", "802"],
            explanation: "Leading Question on Direct (Rule 611). The question suggests the desired answer ('you agree... don't you?') and is asked during direct examination of the lawyer's own witness.",
            tip: "Does it contain the answer? Is this direct exam of your own witness? Both yes → Rule 611."
        },
        {
            scenario: "\"Apex Engineering is a corrupt organization that has destroyed this community and deserves to lose everything they own.\"",
            speaker: "Plaintiff's Lawyer",
            correct: "403",
            distractors: ["404", "802", "611"],
            explanation: "Rule 403 — Prejudicial. The statement inflames the jury's emotions ('corrupt... destroy... lose everything') with no additional probative value beyond what admissible evidence already provides.",
            tip: "Does this add facts OR just stoke emotion? Pure inflammatory language with minimal factual addition = Rule 403 analysis."
        },
        {
            scenario: "\"I never reviewed the original drawings myself, but I know for a fact the engineers ignored the safety warnings.\"",
            speaker: "Reed Alvarez — Witness",
            correct: "602",
            distractors: ["802", "701", "404"],
            explanation: "Lack of Personal Knowledge (Rule 602). Alvarez asserts knowledge ('I know for a fact') that he admits he has no direct basis for ('never reviewed the original drawings'). Classic Rule 602.",
            tip: "Listen for: 'I believe,' 'I assume,' 'everyone knows,' 'I heard.' No direct experience → Rule 602."
        },
        {
            scenario: "\"My neighbor told me that her contractor friend overheard the city inspector say he was pressured to approve the building.\"",
            speaker: "Witness",
            correct: "805",
            distractors: ["802", "602", "613"],
            explanation: "Double Hearsay (Rule 805). Two out-of-court links: the inspector said it (Layer 1), the contractor overheard it (Layer 2), the neighbor repeated it (Layer 3). Every link in the chain needs an exception.",
            tip: "Count the chain: Who said it to whom? Two or more out-of-court links = Double Hearsay = Rule 805."
        },
        {
            scenario: "\"Dr. Chen is an absolute genius who has never been wrong about anything in her entire career.\"",
            speaker: "Witness — before Dr. Chen's credibility has been attacked at all",
            correct: "608",
            distractors: ["702", "403", "701"],
            explanation: "Improper Bolstering (Rule 608). You may support a witness's credibility only after it has been attacked. Pre-emptively vouching for a witness before any attack = impermissible bolstering.",
            tip: "Has credibility been attacked yet? No → bolstering = Rule 608. Yes → supporting credibility is proper."
        },
        {
            scenario: "\"Isn't it true that you've been sued for engineering malpractice before, Dr. Hightower?\"",
            speaker: "Defense Lawyer to Dr. Hightower — Cross-Exam",
            correct: "404",
            distractors: ["608", "609", "403"],
            explanation: "Improper Character Evidence (Rule 404). Prior civil lawsuits are being offered to suggest Hightower is prone to engineering errors — propensity reasoning. Rule 609 covers criminal convictions only, not civil suits.",
            tip: "Prior civil lawsuits ≠ criminal convictions. Rule 609 is criminal convictions only. Using past suits to show propensity for negligence = Rule 404."
        },
        {
            scenario: "\"The wind tunnel data proves beyond any doubt that this building will definitely collapse in the very next storm.\"",
            speaker: "Plaintiff's Lawyer — closing argument on evidence",
            correct: "403",
            distractors: ["702", "701", "611"],
            explanation: "Rule 403. While expert structural opinions are admissible, the absolute certitude ('proves beyond any doubt... definitely collapse in the very next storm') overstates the evidence and is calculated to inflame rather than inform.",
            tip: "Does this statement go beyond what the actual evidence supports AND is designed to inflame emotion? Rule 403 weighing analysis."
        }
    ],

    listenSegment: [
        { speaker: "Q", text: "Mr. Alvarez — I want to turn to a specific moment. Let me take you back to March 2016. You're in your home at East Superior Tower. Your phone rings. Tell us what happened.", technique: null, label: null },
        { speaker: "A", text: "It was a call from Dr. Chen — a professor at Columbia. She told me a graduate student had identified a potential structural problem with the building.", technique: null, label: null },
        { speaker: "Q", text: "A potential structural problem with the building — what did you do the moment you heard those words?", technique: "looping", label: "LOOPING" },
        { speaker: "A", text: "Honestly, my blood ran cold. Within an hour, I had called Apex Engineering and demanded a meeting. Within a week, I had retained Dr. Hightower.", technique: null, label: null },
        { speaker: "Q", text: "Now — leaving that initial reaction — I want to turn to the HOA vote itself. When you brought this to your fellow unit owners, what did you tell them?", technique: "headlining", label: "HEADLINING" },
        { speaker: "A", text: "I told them the truth. Two independent engineers believed the building had a structural vulnerability that needed to be fixed. I said: this is our building. Our homes. We need to fix it.", technique: null, label: null },
        { speaker: "Q", text: "Mr. Alvarez — before we go further, I want to address something the defense will surely raise. The vote was 51 to 49. Nearly half of your neighbors voted no. You knew that would come up today, correct?", technique: "volunteering", label: "VOLUNTEERING WEAKNESS" },
        { speaker: "A", text: "Yes. And I will tell you exactly what that vote means: the 49 percent were voting against the cost — not against the engineering. Not a single expert who reviewed the data said the building was safe.", technique: null, label: null },
        { speaker: "Q", text: "The cost. The $22.6 million. That cost — where did that money come from?", technique: "looping", label: "LOOPING" },
        { speaker: "A", text: "It came from the pockets of every homeowner in that building. Ordinary people. People who had nothing to do with the engineering decision. That is the most infuriating part of all of this.", technique: null, label: null }
    ]

};

// ── MAIN INIT ──────────────────────────────────────────────────────────
function initRulesVault() {
        navigateTo('rules-vault');
        logAction("Accessed Review Room");

        // Load mastery badge
        _rv_updateMasteryBadge();

        // Default to strategy tab
        switchReviewTab('strategy', document.querySelector('.rv-tab'));

        // Pre-load rules list (for when user navigates to rules tab)
        _rv_renderRulesList();
}

// ── Tab Navigation ─────────────────────────────────────────────────────
function switchReviewTab(tab, el) {
        // Update tab buttons
        document.querySelectorAll('.rv-tab').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        else {
                const allTabs = document.querySelectorAll('.rv-tab');
                const idx = ['strategy','toolkit','factlab','rules'].indexOf(tab);
                if (allTabs[idx]) allTabs[idx].classList.add('active');
        }

        // Update panes
        document.querySelectorAll('.rv-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById('rv-' + tab);
        if (pane) pane.classList.add('active');

        ReviewState.activeTab = tab;

        // Tab-specific init
        if (tab === 'toolkit') _rv_initToolkit();
        if (tab === 'factlab') _rv_initFactLab();
        if (tab === 'rules') _rv_initRulesTab();

        // Track visit
        _rv_trackTabVisit(tab);
}

// ── Strategy Tab ───────────────────────────────────────────────────────
function toggleAuraCard(el) {
        el.classList.toggle('open');
}

// ── Toolkit Tab ────────────────────────────────────────────────────────
function _rv_initToolkit() {
        loadTechnique('looping', document.querySelector('.rv-tech-btn'));
        _rv_initRunaway();
}

function loadTechnique(key, el) {
        // Update button states
        document.querySelectorAll('.rv-tech-btn').forEach(b => b.classList.remove('active'));
        if (el) el.classList.add('active');

        ReviewState.activeTechnique = key;
        const tech = REVIEW_DATA.techniques[key];
        if (!tech) return;

        const panel = document.getElementById('rv-tech-panel');
        if (!panel) return;

        // Build dialog HTML
        let dialogHTML = '';
        tech.example.dialog.forEach(line => {
                const isQ = line.role === 'Q';
                let textContent = line.text;

                // Highlight loop/headline markers
                if (line.highlight) {
                        const safeHL = line.highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        textContent = textContent.replace(new RegExp(safeHL, 'i'), `<span class="rv-loop-highlight">${line.highlight}</span>`);
                }
                // Strip <mark> tags if present and replace with highlight span
                textContent = textContent.replace(/<mark>(.*?)<\/mark>/g, '<span class="rv-loop-highlight">$1</span>');

                dialogHTML += `
                    <div class="rv-dialog-line ${isQ ? 'rv-dialog-q' : 'rv-dialog-a'}">
                        <span class="rv-dialog-role">${line.role}</span>
                        <div>
                            <span>${textContent}</span>
                            ${line.note ? `<div class="rv-technique-note">${line.note}</div>` : ''}
                        </div>
                    </div>`;
        });

        panel.innerHTML = `
            <div class="flex justify-between items-start mb-3 flex-wrap gap-2">
                <h3 style="font-family:'Playfair Display',serif; font-size:1.3rem; font-weight:700; color:var(--gold);">${tech.name}</h3>
                <span style="font-size:0.65rem; font-weight:600; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-muted); background:rgba(255,255,255,0.07); padding:3px 10px; border-radius:50px;">${tech.example.type}</span>
            </div>
            <div class="rv-tech-definition">${tech.definition}</div>
            <p class="rv-tech-when"><strong style="color:var(--text-main);">When to use:</strong> ${tech.when}</p>
            <div class="rv-tech-example-header">Case Example — ${tech.example.witness}</div>
            <div class="rv-tech-dialog">${dialogHTML}</div>
            <div class="rv-tech-tip">${tech.tip}</div>
        `;
}

// ── Listen to Strategy ─────────────────────────────────────────────────
function startListenSim() {
        if (!window.speechSynthesis) {
                document.getElementById('rv-listen-display').textContent = 'Speech synthesis not available in this browser. Try Chrome or Edge.';
                return;
        }
        window.speechSynthesis.cancel();
        ReviewState.listenSim.active = true;
        ReviewState.listenSim.lineIndex = 0;
        ReviewState.listenSim.score = 0;
        ReviewState.listenSim.total = 0;

        document.getElementById('rv-listen-start-btn').style.display = 'none';
        document.getElementById('rv-listen-stop-btn').style.display = '';
        document.getElementById('rv-listen-feedback').textContent = '';
        document.getElementById('rv-listen-score').textContent = '';
        document.getElementById('rv-listen-display').innerHTML = '<span style="color:var(--gold)">Listening...</span>';

        _rv_playListenLine();
}

function _rv_playListenLine() {
        const seg = REVIEW_DATA.listenSegment;
        if (!ReviewState.listenSim.active || ReviewState.listenSim.lineIndex >= seg.length) {
                _rv_endListenSim();
                return;
        }
        const line = seg[ReviewState.listenSim.lineIndex];
        const display = document.getElementById('rv-listen-display');

        // Highlight active line
        const techniqueTag = line.technique ? `<span style="background:rgba(212,175,55,0.25);border-radius:4px;padding:1px 6px;font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-left:8px;">${line.label}</span>` : '';
        display.innerHTML = `<span style="color:var(--text-muted);font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">${line.speaker}:</span> <span style="font-style:italic;">${line.text}</span>${techniqueTag}`;

        if ('speechSynthesis' in window) {
                const utt = new SpeechSynthesisUtterance(`${line.speaker === 'Q' ? 'Counsel' : 'Witness'}: ${line.text}`);
                utt.rate = 0.92;
                utt.pitch = line.speaker === 'Q' ? 1.0 : 0.88;
                utt.lang = 'en-US';
                ReviewState.listenSim.utterance = utt;
                utt.onend = () => {
                        ReviewState.listenSim.lineIndex++;
                        setTimeout(_rv_playListenLine, 400);
                };
                window.speechSynthesis.speak(utt);
        } else {
                // Fallback: auto-advance without audio
                setTimeout(() => {
                        ReviewState.listenSim.lineIndex++;
                        _rv_playListenLine();
                }, 3000);
        }
}

function stopListenSim() {
        ReviewState.listenSim.active = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        document.getElementById('rv-listen-start-btn').style.display = '';
        document.getElementById('rv-listen-stop-btn').style.display = 'none';
        document.getElementById('rv-listen-display').textContent = 'Stopped. Press Play to restart.';
}

function _rv_endListenSim() {
        ReviewState.listenSim.active = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        document.getElementById('rv-listen-start-btn').style.display = '';
        document.getElementById('rv-listen-stop-btn').style.display = 'none';
        const s = ReviewState.listenSim;
        document.getElementById('rv-listen-score').textContent = `Final Score: ${s.score}/${s.total} technique tags`;
        document.getElementById('rv-listen-display').textContent = 'Segment complete.';
}

function tagListenTechnique(tag) {
        if (!ReviewState.listenSim.active) return;

        const seg = REVIEW_DATA.listenSegment;
        const currentIdx = Math.max(0, ReviewState.listenSim.lineIndex - 1);
        const line = seg[currentIdx] || {};
        const expectedTags = { looping: 'looping', headlining: 'headlining', scene: 'scenesetting', weakness: 'volunteering', threecs: 'threecs', chapter: 'chapter' };
        const expected = line.technique;
        const tagMap = expectedTags[tag];

        ReviewState.listenSim.total++;
        const btn = event.currentTarget;

        if (expected && tagMap === expected) {
                ReviewState.listenSim.score++;
                btn.classList.add('correct-flash');
                document.getElementById('rv-listen-feedback').textContent = `Correct! ${line.label} detected.`;
                document.getElementById('rv-listen-feedback').style.color = '#4ade80';
        } else if (!expected) {
                btn.classList.add('wrong-flash');
                document.getElementById('rv-listen-feedback').textContent = 'No technique at this exact moment — keep listening.';
                document.getElementById('rv-listen-feedback').style.color = '#fca5a5';
        } else {
                btn.classList.add('wrong-flash');
                document.getElementById('rv-listen-feedback').textContent = `That was actually ${line.label}. Tap the correct button.`;
                document.getElementById('rv-listen-feedback').style.color = '#fca5a5';
        }

        setTimeout(() => { btn.classList.remove('correct-flash', 'wrong-flash'); }, 600);
        document.getElementById('rv-listen-score').textContent = `Score: ${ReviewState.listenSim.score}/${ReviewState.listenSim.total}`;
}

// ── Runaway Witness ────────────────────────────────────────────────────
function _rv_initRunaway() {
        const panel = document.getElementById('rv-runaway-choices');
        if (panel) panel.innerHTML = '';
        document.getElementById('rv-runaway-q').textContent = 'Press Start to begin a scenario.';
        const wEl = document.getElementById('rv-runaway-witness');
        if (wEl) { wEl.textContent = ''; wEl.classList.add('hidden'); }
        document.getElementById('rv-runaway-feedback').classList.add('hidden');
        ReviewState.runaway.score = 0;
        ReviewState.runaway.total = 0;
        ReviewState.runaway.scenarioIndex = 0;
        _rv_updateRunawayScore();
}

function startRunawaySim() {
        const scenarios = REVIEW_DATA.runawayScenarios;
        const idx = ReviewState.runaway.scenarioIndex % scenarios.length;
        const scenario = scenarios[idx];
        ReviewState.runaway.active = true;

        document.getElementById('rv-runaway-q').textContent = scenario.q;
        const wEl = document.getElementById('rv-runaway-witness');
        wEl.textContent = `Witness: "${scenario.evasion}"`;
        wEl.classList.remove('hidden');

        const feedback = document.getElementById('rv-runaway-feedback');
        feedback.classList.add('hidden');
        feedback.className = 'rv-runaway-feedback hidden';

        const choicesEl = document.getElementById('rv-runaway-choices');
        choicesEl.innerHTML = '';
        scenario.choices.forEach((choice, i) => {
                const btn = document.createElement('button');
                btn.className = 'rv-runaway-choice';
                btn.textContent = choice.text;
                btn.addEventListener('click', () => _rv_handleRunawayChoice(choice, btn));
                btn.addEventListener('touchend', (e) => { e.preventDefault(); _rv_handleRunawayChoice(choice, btn); });
                choicesEl.appendChild(btn);
        });

        document.getElementById('rv-runaway-start').textContent = 'Next Scenario';
}

function _rv_handleRunawayChoice(choice, btn) {
        if (!ReviewState.runaway.active) return;
        ReviewState.runaway.active = false;
        ReviewState.runaway.total++;

        // Disable all buttons
        document.querySelectorAll('.rv-runaway-choice').forEach(b => {
                b.classList.add(b === btn ? (choice.correct ? 'correct' : 'wrong') : 'wrong');
                b.disabled = true;
        });
        // Show correct
        document.querySelectorAll('.rv-runaway-choice').forEach((b, i) => {
                if (REVIEW_DATA.runawayScenarios[ReviewState.runaway.scenarioIndex % REVIEW_DATA.runawayScenarios.length].choices[i].correct) {
                        b.classList.remove('wrong');
                        b.classList.add('correct');
                }
        });

        if (choice.correct) ReviewState.runaway.score++;

        const feedback = document.getElementById('rv-runaway-feedback');
        feedback.className = `rv-runaway-feedback ${choice.correct ? 'correct' : 'wrong'}`;
        feedback.textContent = choice.explanation;
        feedback.classList.remove('hidden');

        ReviewState.runaway.scenarioIndex++;
        _rv_updateRunawayScore();

        // Save to stats
        _rv_saveReviewStat('runaway', choice.correct);
}

function _rv_updateRunawayScore() {
        const el = document.getElementById('rv-runaway-score');
        if (el) el.textContent = `${ReviewState.runaway.score}/${ReviewState.runaway.total}`;
}

// ── Fact Lab ───────────────────────────────────────────────────────────
function _rv_initFactLab() {
        // Load saved progress
        const saved = _rv_loadStat('factLabNeutralized');
        if (saved && Array.isArray(saved)) {
                ReviewState.factLab.neutralized = new Set(saved);
        }

        const list = document.getElementById('rv-fact-list');
        if (!list) return;
        list.innerHTML = '';

        REVIEW_DATA.badFacts.forEach((fact, idx) => {
                const isNeutralized = ReviewState.factLab.neutralized.has(idx);
                const item = document.createElement('div');
                item.className = `rv-fact-item${isNeutralized ? ' neutralized' : ''}`;
                item.id = `rv-fact-${idx}`;
                item.innerHTML = `
                    <div class="rv-fact-header">
                        <span class="rv-fact-num">FACT ${idx + 1}</span>
                        <div style="flex:1;">
                            <div class="rv-bad-fact-text">${fact.fact}</div>
                            <div class="rv-fact-context">${fact.context}</div>
                        </div>
                        <button class="rv-neutralize-btn" onclick="neutralizeFact(${idx})" style="touch-action:manipulation; -webkit-tap-highlight-color:transparent;" ${isNeutralized ? 'disabled' : ''}>
                            ${isNeutralized ? 'Neutralized' : 'Neutralize'}
                        </button>
                    </div>
                    <div class="rv-neutralizer-panel">
                        <div class="rv-neutralizer-label">Counter-Narrative</div>
                        <div class="rv-neutralizer-text">${fact.neutralizer}</div>
                        <div class="rv-plaintiff-counter"><strong>For Plaintiff:</strong> ${fact.plaintiff_counter}</div>
                        <div class="rv-exhibit-link">${fact.exhibit_link}</div>
                    </div>
                `;
                list.appendChild(item);
        });

        _rv_updateFactLabProgress();
}

function neutralizeFact(idx) {
        ReviewState.factLab.neutralized.add(idx);
        const item = document.getElementById(`rv-fact-${idx}`);
        if (item) {
                item.classList.add('neutralized');
                const btn = item.querySelector('.rv-neutralize-btn');
                if (btn) { btn.textContent = 'Neutralized'; btn.disabled = true; }
        }
        // Persist
        _rv_saveStat('factLabNeutralized', Array.from(ReviewState.factLab.neutralized));
        _rv_updateFactLabProgress();
        _rv_updateMasteryBadge();
        _rv_saveReviewStat('factlab', true);
}

function resetFactLab() {
        ReviewState.factLab.neutralized.clear();
        _rv_saveStat('factLabNeutralized', []);
        _rv_initFactLab();
        document.getElementById('rv-fl-complete').classList.add('hidden');
}

function _rv_updateFactLabProgress() {
        const total = REVIEW_DATA.badFacts.length;
        const done = ReviewState.factLab.neutralized.size;
        const pct = Math.round((done / total) * 100);
        const fill = document.getElementById('rv-fl-progress-fill');
        if (fill) fill.style.width = pct + '%';
        const txt = document.getElementById('rv-fl-progress-text');
        if (txt) txt.textContent = `${done}/${total} Neutralized`;

        if (done === total) {
                const complete = document.getElementById('rv-fl-complete');
                if (complete) complete.classList.remove('hidden');
        }
}

// ── Rules Tab ──────────────────────────────────────────────────────────
function _rv_initRulesTab() {
        switchRulesMode(ReviewState.rulesMode || 'browse');
}

function switchRulesMode(mode) {
        ReviewState.rulesMode = mode;
        const browseBtn = document.getElementById('rv-mode-browse');
        const drillBtn = document.getElementById('rv-mode-drill');
        const browseEl = document.getElementById('rv-browse-mode');
        const drillEl = document.getElementById('rv-drill-mode');

        if (mode === 'browse') {
                browseBtn.classList.add('active');
                drillBtn.classList.remove('active');
                browseEl.classList.remove('hidden');
                drillEl.classList.add('hidden');
                _rv_renderRulesList();
        } else {
                browseBtn.classList.remove('active');
                drillBtn.classList.add('active');
                browseEl.classList.add('hidden');
                drillEl.classList.remove('hidden');
                _rv_initDrillDisplay();
        }
}

function _rv_renderRulesList() {
        const list = document.getElementById('rules-list');
        if (!list) return;
        const rules = window.MockTrialRulesData || [];
        list.innerHTML = '';
        rules.forEach(rule => {
                const div = document.createElement('div');
                div.className = "glass p-5 rounded-xl border border-white/5 hover:border-gold transition-colors";
                div.innerHTML = `
                        <div class="flex justify-between items-start mb-2 flex-wrap gap-1">
                                <h3 style="font-family:'Playfair Display',serif; font-size:1.1rem; font-weight:700; color:var(--gold);">Rule ${rule.rule}</h3>
                                <span style="font-size:0.6rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-muted); background:rgba(255,255,255,0.07); padding:3px 8px; border-radius:50px;">${rule.name}</span>
                        </div>
                        <p style="font-size:0.78rem; color:#cbd5e1; margin-bottom:10px; font-style:italic; line-height:1.6;">"${rule.desc}"</p>
                        ${rule.tip ? `<div style="font-size:0.72rem; margin-bottom:6px;"><span style="color:#4ade80; font-weight:700;">PRO-TIP: </span><span style="color:#94a3b8;">${rule.tip}</span></div>` : ''}
                        ${rule.pitfall ? `<div style="font-size:0.72rem;"><span style="color:#fca5a5; font-weight:700;">PITFALL: </span><span style="color:#94a3b8;">${rule.pitfall}</span></div>` : ''}
                `;
                list.appendChild(div);
        });
}

// ── Existing filterRules — enhanced ───────────────────────────────────
function filterRules() {
        const query = document.getElementById('rules-search').value.toLowerCase();
        const list = document.getElementById('rules-list');
        if (!list) return;
        const rules = window.MockTrialRulesData || [];
        list.innerHTML = '';
        rules.forEach(rule => {
                if (rule.rule.toLowerCase().includes(query) ||
                        rule.name.toLowerCase().includes(query) ||
                        rule.desc.toLowerCase().includes(query) ||
                        (rule.tip && rule.tip.toLowerCase().includes(query)) ||
                        (rule.pitfall && rule.pitfall.toLowerCase().includes(query))) {
                        const div = document.createElement('div');
                        div.className = "glass p-5 rounded-xl border border-white/5 hover:border-gold transition-colors";
                        div.innerHTML = `
                                <div class="flex justify-between items-start mb-2 flex-wrap gap-1">
                                        <h3 style="font-family:'Playfair Display',serif; font-size:1.1rem; font-weight:700; color:var(--gold);">Rule ${rule.rule}</h3>
                                        <span style="font-size:0.6rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-muted); background:rgba(255,255,255,0.07); padding:3px 8px; border-radius:50px;">${rule.name}</span>
                                </div>
                                <p style="font-size:0.78rem; color:#cbd5e1; margin-bottom:10px; font-style:italic; line-height:1.6;">"${rule.desc}"</p>
                                ${rule.tip ? `<div style="font-size:0.72rem; margin-bottom:6px;"><span style="color:#4ade80; font-weight:700;">PRO-TIP: </span><span style="color:#94a3b8;">${rule.tip}</span></div>` : ''}
                                ${rule.pitfall ? `<div style="font-size:0.72rem;"><span style="color:#fca5a5; font-weight:700;">PITFALL: </span><span style="color:#94a3b8;">${rule.pitfall}</span></div>` : ''}
                        `;
                        list.appendChild(div);
                }
        });
}

// ── Battle Drills ──────────────────────────────────────────────────────
function _rv_initDrillDisplay() {
        const saved = _rv_loadStat('drillStats') || { score: 0, streak: 0, total: 0 };
        ReviewState.drill.score = saved.score;
        ReviewState.drill.streak = saved.streak;
        ReviewState.drill.total = saved.total;
        _rv_updateDrillDisplay();
        document.getElementById('drill-options').innerHTML = '';
        document.getElementById('drill-feedback').classList.add('hidden');
        document.getElementById('drill-timer-bar-wrap').classList.add('hidden');
}

function startBattleDrill() {
        clearInterval(ReviewState.drill.timerInterval);
        ReviewState.drill.answered = false;

        // Pick a random scenario (avoid repeating)
        const drills = REVIEW_DATA.battleDrills;
        let idx;
        do { idx = Math.floor(Math.random() * drills.length); }
        while (idx === ReviewState.drill.currentScenarioIdx && drills.length > 1);
        ReviewState.drill.currentScenarioIdx = idx;

        const drill = drills[idx];

        document.getElementById('drill-scenario').textContent = drill.scenario;
        document.getElementById('drill-speaker').textContent = drill.speaker;
        document.getElementById('drill-feedback').classList.add('hidden');

        // Build options: correct + 3 distractors, shuffled
        const allRules = window.MockTrialRulesData || [];
        const correctRule = allRules.find(r => r.rule === drill.correct);
        const distractorRules = drill.distractors.map(id => allRules.find(r => r.rule === id)).filter(Boolean);
        const options = [
                { rule: correctRule, isCorrect: true },
                ...distractorRules.map(r => ({ rule: r, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        const optionsEl = document.getElementById('drill-options');
        optionsEl.innerHTML = '';
        options.forEach(opt => {
                if (!opt.rule) return;
                const btn = document.createElement('button');
                btn.className = 'rv-drill-option';
                btn.innerHTML = `<span style="color:var(--gold); font-weight:700; font-family:monospace; font-size:0.72rem;">Rule ${opt.rule.rule}</span><br><span style="font-size:0.78rem;">${opt.rule.name}</span>`;

                const handler = (e) => {
                        if (e.cancelable) e.preventDefault();
                        _rv_handleDrillAnswer(opt.isCorrect, drill, btn, optionsEl);
                };
                btn.addEventListener('click', handler);
                btn.addEventListener('touchend', handler);
                optionsEl.appendChild(btn);
        });

        // Start timer
        ReviewState.drill.timerRemaining = 8;
        const timerWrap = document.getElementById('drill-timer-bar-wrap');
        const timerBar = document.getElementById('drill-timer-bar');
        const timerText = document.getElementById('drill-timer-text');
        timerWrap.classList.remove('hidden');
        timerBar.style.width = '100%';
        timerBar.style.background = 'var(--gold)';

        ReviewState.drill.timerInterval = setInterval(() => {
                ReviewState.drill.timerRemaining -= 0.1;
                const pct = Math.max(0, (ReviewState.drill.timerRemaining / 8) * 100);
                timerBar.style.width = pct + '%';
                timerText.textContent = Math.ceil(ReviewState.drill.timerRemaining) + 's';
                if (ReviewState.drill.timerRemaining <= 2) timerBar.style.background = '#ef4444';
                if (ReviewState.drill.timerRemaining <= 0 && !ReviewState.drill.answered) {
                        clearInterval(ReviewState.drill.timerInterval);
                        _rv_handleDrillAnswer(false, drill, null, optionsEl, true);
                }
        }, 100);
}

function _rv_handleDrillAnswer(isCorrect, drill, clickedBtn, optionsEl, timedOut = false) {
        if (ReviewState.drill.answered) return;
        ReviewState.drill.answered = true;
        clearInterval(ReviewState.drill.timerInterval);

        // Visual feedback on buttons
        const allBtns = optionsEl.querySelectorAll('.rv-drill-option');
        allBtns.forEach(b => {
                b.classList.add('disabled');
                b.style.pointerEvents = 'none';
        });
        if (clickedBtn) {
                clickedBtn.classList.remove('disabled');
                clickedBtn.classList.add(isCorrect ? 'correct' : 'wrong');
        }
        // Always reveal correct
        const allRules = window.MockTrialRulesData || [];
        allBtns.forEach(b => {
                const ruleText = b.querySelector('span:first-child').textContent;
                if (ruleText.includes(drill.correct)) {
                        b.classList.remove('disabled', 'wrong');
                        b.classList.add('correct');
                }
        });

        // Update score
        ReviewState.drill.total++;
        if (isCorrect) {
                ReviewState.drill.score += 10;
                ReviewState.drill.streak++;
        } else {
                ReviewState.drill.score = Math.max(0, ReviewState.drill.score - 3);
                ReviewState.drill.streak = 0;
        }
        _rv_updateDrillDisplay();

        // Show feedback
        const fb = document.getElementById('drill-feedback');
        const fbTitle = document.getElementById('drill-feedback-title');
        const fbBody = document.getElementById('drill-feedback-body');
        fb.classList.remove('hidden');
        fb.style.border = `1px solid ${isCorrect ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`;
        fb.style.background = isCorrect ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)';
        fbTitle.textContent = timedOut ? 'Time Expired' : (isCorrect ? 'Correct' : 'Overruled');
        fbTitle.style.color = isCorrect ? '#4ade80' : '#f87171';
        fbBody.innerHTML = `${drill.explanation}<br><br><span style="color:var(--gold); font-weight:600;">Tip: </span><span style="color:#94a3b8;">${drill.tip}</span>`;

        // Persist stats
        _rv_saveStat('drillStats', {
                score: ReviewState.drill.score,
                streak: ReviewState.drill.streak,
                total: ReviewState.drill.total
        });
        _rv_saveReviewStat('drill', isCorrect);
        _rv_updateMasteryBadge();
}

function resetBattleDrill() {
        clearInterval(ReviewState.drill.timerInterval);
        ReviewState.drill.score = 0;
        ReviewState.drill.streak = 0;
        ReviewState.drill.total = 0;
        ReviewState.drill.answered = false;
        _rv_saveStat('drillStats', { score: 0, streak: 0, total: 0 });
        _rv_updateDrillDisplay();
        document.getElementById('drill-options').innerHTML = '';
        document.getElementById('drill-feedback').classList.add('hidden');
        document.getElementById('drill-timer-bar-wrap').classList.add('hidden');
        document.getElementById('drill-scenario').textContent = 'Press "New Question" to begin Battle Drills.';
        document.getElementById('drill-speaker').textContent = '';
        _rv_updateMasteryBadge();
}

function _rv_updateDrillDisplay() {
        const scoreEl = document.getElementById('drill-score-display');
        const streakEl = document.getElementById('drill-streak-display');
        const totalEl = document.getElementById('drill-total-display');
        if (scoreEl) scoreEl.textContent = ReviewState.drill.score;
        if (streakEl) streakEl.textContent = ReviewState.drill.streak;
        if (totalEl) totalEl.textContent = ReviewState.drill.total;
}

// ── Mastery Badge ──────────────────────────────────────────────────────
function _rv_updateMasteryBadge() {
        const stats = JSON.parse(localStorage.getItem('quantum_legal_stats') || '{}');
        const drillTotal = (stats.drillTotal || 0);
        const drillCorrect = (stats.drillCorrect || 0);
        const factsDone = (stats.factLabDone || 0);
        const factsTotal = REVIEW_DATA.badFacts.length;
        const runawayCorrect = (stats.runawayCorrect || 0);
        const runawayTotal = (stats.runawayTotal || 0);

        // Composite mastery: weighted average
        let score = 0, total = 0;
        if (drillTotal > 0) { score += (drillCorrect / drillTotal) * 50; total += 50; }
        if (factsTotal > 0) { score += (factsDone / factsTotal) * 30; total += 30; }
        if (runawayTotal > 0) { score += (runawayCorrect / runawayTotal) * 20; total += 20; }

        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        const el = document.getElementById('rv-mastery-score');
        if (el) el.textContent = pct + '%';
}

// ── Persistence Helpers ────────────────────────────────────────────────
function _rv_saveReviewStat(type, correct) {
        const stats = JSON.parse(localStorage.getItem('quantum_legal_stats') || '{}');
        if (type === 'drill') {
                stats.drillTotal = (stats.drillTotal || 0) + 1;
                if (correct) stats.drillCorrect = (stats.drillCorrect || 0) + 1;
        } else if (type === 'factlab') {
                stats.factLabDone = ReviewState.factLab.neutralized.size;
        } else if (type === 'runaway') {
                stats.runawayTotal = (stats.runawayTotal || 0) + 1;
                if (correct) stats.runawayCorrect = (stats.runawayCorrect || 0) + 1;
        }
        localStorage.setItem('quantum_legal_stats', JSON.stringify(stats));
}

function _rv_saveStat(key, value) {
        try { localStorage.setItem('rv_' + key, JSON.stringify(value)); } catch(e) {}
}

function _rv_loadStat(key) {
        try { const v = localStorage.getItem('rv_' + key); return v ? JSON.parse(v) : null; } catch(e) { return null; }
}

function _rv_trackTabVisit(tab) {
        const stats = JSON.parse(localStorage.getItem('quantum_legal_stats') || '{}');
        if (!stats.reviewTabs) stats.reviewTabs = {};
        stats.reviewTabs[tab] = (stats.reviewTabs[tab] || 0) + 1;
        localStorage.setItem('quantum_legal_stats', JSON.stringify(stats));
}



