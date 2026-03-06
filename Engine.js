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
    logAction("Review Room Opened");

    // Build rule cards in the browse panel
    _rv_renderRulesList('');

    // Build all dynamic modules
    buildTechniqueCards();
    buildFactLab();
    initBattleDrills();
    updateMasteryScoreDisplay();

    // Restore last tab
    const lastTab = _rv_getMastery('lastTab', 'strategy');
    switchReviewTab(lastTab);
}

function filterRules() {
    const input = document.getElementById('rules-search');
    const query = input ? input.value.toLowerCase() : '';
    _rv_renderRulesList(query);
}

function _rv_renderRulesList(query) {
    const list = document.getElementById('rules-list');
    if (!list) return;
    list.innerHTML = '';
    const rules = window.MockTrialRulesData || [];
    rules.forEach(rule => {
        if (query && !rule.rule.toLowerCase().includes(query) &&
            !rule.name.toLowerCase().includes(query) &&
            !rule.desc.toLowerCase().includes(query) &&
            !(rule.tip && rule.tip.toLowerCase().includes(query)) &&
            !(rule.pitfall && rule.pitfall.toLowerCase().includes(query))) return;

        const div = document.createElement('div');
        div.className = "glass p-5 rounded-xl border border-white/5 hover:border-gold transition-colors";
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2 gap-2">
                <h3 class="text-lg font-bold gold-text leading-none">Rule ${rule.rule}</h3>
                <span class="text-[10px] text-muted uppercase tracking-widest text-right">${rule.name}</span>
            </div>
            <p class="text-xs text-gray-300 mb-3 italic leading-relaxed">"${rule.desc}"</p>
            ${rule.tip ? `<div class="mb-1 text-xs"><span class="text-green-400 font-bold">PRO-TIP: </span><span class="text-gray-400">${rule.tip}</span></div>` : ''}
            ${rule.pitfall ? `<div class="text-xs"><span class="text-red-400 font-bold">PITFALL: </span><span class="text-gray-400">${rule.pitfall}</span></div>` : ''}
        `;
        list.appendChild(div);
    });
    if (list.children.length === 0) {
        list.innerHTML = `<div class="text-xs text-muted p-4 col-span-full">No rules match "${query}"</div>`;
    }
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
    showObjStep('obj-flow-1');
    loadObjMasteryBar();
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

// ═══════════════════════════════════════════════════════════════════════════
//  REVIEW ROOM — MASTERY HUB
//  All functions below are exclusively for the #rules-vault section.
//  No other rooms are touched.
// ═══════════════════════════════════════════════════════════════════════════

// ── MASTERY PERSISTENCE ──────────────────────────────────────────────────────
function _rv_saveMastery(key, value) {
    const p = JSON.parse(localStorage.getItem('rv_mastery') || '{}');
    p[key] = value;
    localStorage.setItem('rv_mastery', JSON.stringify(p));
    updateMasteryScoreDisplay();
}

function _rv_getMastery(key, fallback) {
    const p = JSON.parse(localStorage.getItem('rv_mastery') || '{}');
    return p[key] !== undefined ? p[key] : fallback;
}

function updateMasteryScoreDisplay() {
    const p = JSON.parse(localStorage.getItem('rv_mastery') || '{}');
    const drillCorrect  = p.drillCorrect   || 0;
    const drillTotal    = Math.max(p.drillTotal || 1, 1);
    const factsRevealed = p.factsRevealed  || 0;
    const factsTotal    = Math.max(RV_BAD_FACTS.length, 1);
    const techViewed    = p.techViewed     || 0;
    const techTotal     = Math.max(RV_TECHNIQUES.length, 1);

    const pct = Math.min(Math.round(
        (drillCorrect / drillTotal)    * 40 +
        (factsRevealed / factsTotal)   * 30 +
        (techViewed    / techTotal)    * 30
    ), 100);

    const el = document.getElementById('rv-mastery-score');
    if (el) el.textContent = pct + '%';
}

// ── DATA: TECHNIQUE CARDS ────────────────────────────────────────────────────
const RV_TECHNIQUES = [
    {
        id: 'looping', name: 'Looping', color: '#38bdf8', label: 'DIRECT',
        definition: "Take the witness's own answer and fold it back into your next question, locking them into their testimony and building an unbroken chain of admissions.",
        witness: 'Dr. Rowan Hightower', role: 'Plaintiff Expert — Structural Engineer',
        example: [
            { speaker: 'Counsel', text: 'Dr. Hightower, you testified that the "elevated column" design was the critical structural feature of this building, correct?' },
            { speaker: 'Witness', text: 'That is correct. The elevated columns distribute lateral load down to the foundation.' },
            { speaker: 'Counsel', text: 'And those elevated columns — the critical structural feature — were dependent on welded connections for their integrity, weren\'t they?' },
            { speaker: 'Witness', text: 'Yes. Welded moment connections were specified precisely because of the elevated column design\'s unique lateral load requirements.' },
            { speaker: 'Counsel', text: 'So the welded connections that the elevated columns depended on — those are the very connections that Apex replaced with bolted shear connections?' },
        ],
        tip: "Each question opens with the witness's last key phrase. You loop their words back at them. This makes contradiction impossible without the jury seeing it immediately. Reference: Affidavit of Dr. Rowan Hightower [p. ___]."
    },
    {
        id: 'headlining', name: 'Headlining', color: '#a78bfa', label: 'DIRECT',
        definition: 'Signal a topic transition like a newspaper headline before you enter it — so the jury mentally prepares to receive the information and follows your narrative structure.',
        witness: 'Reed Alvarez', role: 'Plaintiff Witness — HOA President',
        example: [
            { speaker: 'Counsel', text: 'Mr. Alvarez, I want to turn now to the moment everything changed. In March of 2016, you received a document that you described as making your blood boil. Tell the jury what that was.' },
            { speaker: 'Witness', text: 'The whistleblower memo — Exhibit 1. A concerned engineer from inside Apex confirming that the company had knowingly substituted inferior connections.' },
            { speaker: 'Counsel', text: "Let's focus now on what you did with that information the moment you had it in your hands. You called Apex directly, correct?" },
        ],
        tip: '"I want to turn now to..." · "Let\'s focus on..." · "I want to direct your attention to..." — these are your headline phrases. They create anticipation and let the jury follow your chapter structure. Reference: Affidavit of Reed Alvarez [p. ___].'
    },
    {
        id: 'scene-setting', name: 'Scene Setting', color: '#34d399', label: 'DIRECT',
        definition: 'Have the witness paint a physical picture of the environment before describing what happened. This activates the jury\'s imagination and makes testimony concrete and vivid.',
        witness: 'Whitley Carter', role: 'Defense Witness — Retired City Inspector',
        example: [
            { speaker: 'Counsel', text: 'Ms. Carter, describe what the East Superior Tower construction site looked like when you arrived to conduct your structural inspection.' },
            { speaker: 'Witness', text: 'It was a massive 30-story steel skeleton — workers throughout, scaffolding on every level. The framework was fully erected and all connections were visible.' },
            { speaker: 'Counsel', text: 'What documents did you have with you that day?' },
            { speaker: 'Witness', text: 'The approved structural drawings, the connection specifications, and my inspection checklist.' },
            { speaker: 'Counsel', text: 'Standing there, with those drawings in hand, looking directly at those connections — what did your inspection find?' },
        ],
        tip: 'The physical setup — documents in hand, standing at the site — gives the jury a movie. Then when you ask the key question, the answer lands inside a fully-realized scene. Reference: Affidavit of Whitley Carter [p. ___].'
    },
    {
        id: 'volunteering', name: 'Volunteering Weaknesses', color: '#fbbf24', label: 'DIRECT',
        definition: "Bring out a weakness in your own witness BEFORE opposing counsel does. This inoculates the jury and frames the weakness entirely on your terms, stripping opposing counsel of their attack.",
        witness: 'Dr. Ellis Chen', role: 'Plaintiff Expert — Engineering Professor',
        example: [
            { speaker: 'Counsel', text: 'Dr. Chen, the defense will suggest that because you are an academic professor and not a practicing structural engineer, your opinion should be discounted. Is that a fair characterization of your background?' },
            { speaker: 'Witness', text: 'It is accurate that I hold a tenured research chair at Columbia rather than practice commercially. My work is research-focused — wind tunnel testing, CFD modeling, aerodynamic analysis of tall structures.' },
            { speaker: 'Counsel', text: 'And the initial quartering wind model was developed by a Ph.D. student under your supervision — not by you personally, correct?' },
            { speaker: 'Witness', text: 'The student built the initial model. I independently supervised, validated, and verified the entire methodology before any conclusions were drawn.' },
            { speaker: 'Counsel', text: "So let's talk about what that verification process actually looks like inside a Columbia University wind tunnel lab..." },
        ],
        tip: "When opposing counsel later tries to attack Dr. Chen's credentials, the jury has already heard it and already heard the response. The attack lands flat. This converts a liability into a credibility moment. Reference: Affidavit of Dr. Ellis Chen [p. ___]."
    },
    {
        id: 'three-cs', name: "Three C's of Impeachment", color: '#f87171', label: 'CROSS',
        definition: "Commit the witness to their current testimony. Credit the prior statement as voluntary and sworn. Confront them with the specific contradiction. The order is rigid — never reverse it.",
        witness: 'Cam Martinez', role: 'Defense Witness — Project Manager, Metro Builders',
        example: [
            { speaker: 'Counsel', text: '[COMMIT] Mr. Martinez, you testified today that Metro Builders "followed the approved engineering plans and specifications without deviation" — that is your sworn testimony today, correct?' },
            { speaker: 'Witness', text: 'That is correct.' },
            { speaker: 'Counsel', text: '[CREDIT] Sir, you gave a sworn deposition in this case on [p. ___ of your deposition], under oath, with your attorney present, knowing you were required to tell the truth, correct?' },
            { speaker: 'Witness', text: 'Yes.' },
            { speaker: 'Counsel', text: '[CONFRONT] In that deposition, you stated — and I am reading directly — "the decision to move to bolted connections was a field call made by our team to address timeline pressures." Those are your words under oath?' },
        ],
        tip: 'The page number placeholder is intentional — you must cite the exact page and line number in actual court. Commit first, Credit second, Confront third — reversing the order gives the witness time to explain away the contradiction before the jury hears it. Reference: Affidavit of Cam Martinez [p. ___].'
    },
    {
        id: 'chapter-method', name: 'Chapter Method', color: '#fb923c', label: 'CROSS',
        definition: 'Organize your cross into distinct chapters — clear topical segments each with a headline, controlled questions, and a planted conclusion that serves your theory of the case.',
        witness: 'Dr. Ash Forrester', role: 'Defense Expert — Structural Engineer',
        example: [
            { speaker: 'Counsel', text: '[CHAPTER 1: BIAS] Dr. Forrester, you have worked directly with Apex Engineering on numerous projects over the past 15 years, correct?' },
            { speaker: 'Witness', text: 'That is correct.' },
            { speaker: 'Counsel', text: 'And you were retained and compensated by the defense in this specific case to offer your opinion?' },
            { speaker: 'Witness', text: 'Yes, I was retained as a consulting expert.' },
            { speaker: 'Counsel', text: '[CHAPTER 2: PROPENSITY FOR FAILURE] Welded moment connections provide greater lateral load resistance than bolted shear connections under quartering wind scenarios — that is a basic structural engineering principle?' },
            { speaker: 'Witness', text: 'Under certain loading conditions, yes.' },
            { speaker: 'Counsel', text: "[CHAPTER 3: UNNECESSARY FIXES] Doctor, the HOA spent $22.6 million on structural retrofits that you called unnecessary and 'driven by optics.' If the building was truly safe, why would a licensed professional engineer order a $22.6 million structural retrofit?" },
        ],
        tip: "Each chapter label lives only in your outline — the jury never sees it. Each chapter ends on a point you want planted in their minds. Never let the witness give a speech. Short declarative questions only. Reference: Affidavit of Dr. Ash Forrester [p. ___]."
    }
];

// ── DATA: RUNAWAY WITNESS ────────────────────────────────────────────────────
const RV_RUNAWAY_SCENARIOS = [
    {
        question: "Mr. Martinez, Metro Builders proposed the substitution from welded to bolted connections — didn't it?",
        evasions: [
            "Well, it's more complicated than that. The entire project team was involved in numerous discussions about the design, and Apex Engineering was ultimately responsible for all structural decisions. We simply executed what was approved by the engineers of record.",
            "I wouldn't characterize it as a proposal. It was a collaborative process between our field team and Apex that unfolded over several months of project review.",
            "I have already addressed this. Metro Builders followed the approved plans."
        ],
        techniqueLabel: 'Ask → Repeat → Repeat (Assert Control)',
        finalLine: "Mr. Martinez, the question requires a yes or no: did Metro Builders propose the substitution from welded to bolted connections?"
    },
    {
        question: "Dr. Forrester, welded moment connections provide greater lateral load resistance than bolted shear connections — correct?",
        evasions: [
            "That depends on many factors — specific loading conditions, connection geometry, bolt grade, whether we're discussing static or dynamic loads, and the overall structural system. In some configurations—",
            "Both connection types can be engineered to meet code requirements if properly specified. The comparison requires significant qualification—",
            "I would need to qualify that answer considerably. The engineering literature on connection performance is quite nuanced."
        ],
        techniqueLabel: 'Ask → Repeat → Repeat (Demand the Admission)',
        finalLine: "Doctor — under quartering wind loading conditions like those identified in this case — yes or no?"
    }
];

// ── DATA: BAD FACTS ──────────────────────────────────────────────────────────
const RV_BAD_FACTS = [
    {
        id: 'bf1', label: 'Defense Fact',
        bad: "The East Superior Residential Tower is still standing today. It has not collapsed.",
        neutralize: "Structural danger does not require collapse to constitute negligence. A gun with a defective safety is dangerous even before it fires. The $22.6M retrofit itself is the professional confirmation that the danger was real — engineers don't spend $22.6 million on 'optics.'"
    },
    {
        id: 'bf2', label: 'Defense Fact',
        bad: "City Inspector Whitley Carter reviewed the construction and issued a Certificate of Occupancy.",
        neutralize: "Carter's inspection was a code-compliance check — not a quartering wind analysis. She admitted she was never provided with the change order documentation showing the bolt substitution. The code is a floor, not a ceiling, and it cannot certify against risks it was never designed to evaluate."
    },
    {
        id: 'bf3', label: 'Weak Plaintiff Fact',
        bad: "The HOA vote to proceed with retrofits passed by only 51% to 49%. Nearly half of residents disagreed.",
        neutralize: "The vote threshold is irrelevant to liability. Engineers do not require majority votes on safety determinations. Dr. Hightower's professional opinion of danger was not 51/49 — it was unambiguous. A split board vote cannot override a PE's sworn finding."
    },
    {
        id: 'bf4', label: 'Weak Plaintiff Fact',
        bad: "Dr. Chen's wind analysis was built on a graduate student's unpublished, non-peer-reviewed paper.",
        neutralize: "Dr. Chen supervised and independently verified the entire methodology using Columbia University's wind tunnel facilities. Dr. Rowan Hightower — an independent PE with no connection to Chen — arrived at the same conclusions independently. Two separate experts, two separate paths, one finding."
    },
    {
        id: 'bf5', label: 'Defense Attack on Plaintiff',
        bad: "The Whistleblower Memo (Exhibit 1) comes from Samuel Greene, a disgruntled former Apex employee.",
        neutralize: "The memo's factual content — that Apex approved a bolt substitution with knowledge of the wind implications — was independently verified by two separate expert engineers who had no contact with Greene whatsoever. The messenger's motivation does not alter the accuracy of the message."
    },
    {
        id: 'bf6', label: 'Defense Fact',
        bad: "Metro Builders had a written, Apex-approved change order authorizing the substitution to bolted connections.",
        neutralize: "A change order transfers paperwork, not liability. If Apex approved an unsafe substitution, Apex is liable for approving it. If Metro proposed it to reduce costs and timeline, Metro is liable for proposing it. Having a signed document authorizing a negligent decision does not erase the negligence."
    },
    {
        id: 'bf7', label: 'Defense Attack on Plaintiff',
        bad: "Dr. Rowan Hightower is being compensated as a paid expert witness for the plaintiff.",
        neutralize: "Expert compensation is universal, disclosed, and permitted. The defense's own expert, Dr. Ash Forrester, is also compensated — and has a 15-year working relationship with defendant Apex Engineering. Both experts are paid; only one has a pre-existing financial relationship with a defendant in this case."
    },
    {
        id: 'bf8', label: 'Defense Fact',
        bad: "Bolted shear connections are used throughout the high-rise construction industry and met applicable building codes.",
        neutralize: "Meeting minimum code does not satisfy the professional standard of care when the engineer knows those connections are specifically inadequate for this building's unique aerodynamic conditions. Critically, Apex's own original design specified welded connections — meaning Apex itself knew bolted was the inferior choice for this structure before they approved the substitution."
    }
];

// ── DATA: BATTLE DRILLS ──────────────────────────────────────────────────────
const RV_BATTLE_DRILLS = [
    {
        scenario: 'On direct examination, counsel asks Reed Alvarez:\n"Mr. Alvarez, it was expensive to live in this dangerous building, wasn\'t it?"',
        correctRule: '611',
        explanation: "Counsel is suggesting the answer on direct examination ('it was expensive'). Leading questions are permitted on cross, but not direct — unless developing the witness or the witness is hostile.",
        distractors: ['802', '403', '602']
    },
    {
        scenario: 'A witness testifies:\n"I heard from my neighbor, who heard from one of the contractors, that the city inspector was paid off."',
        correctRule: '805',
        explanation: "Double Hearsay. The neighbor's statement is hearsay (layer 1). The contractor's embedded statement is a second layer of hearsay. Each layer independently needs an exception under Rule 805.",
        distractors: ['802', '602', '404']
    },
    {
        scenario: 'A HOA resident testifies on direct:\n"In my opinion as a homeowner, the steel framework was structurally defective."',
        correctRule: '701',
        explanation: "A lay witness cannot offer technical structural engineering opinions. 'Structurally defective' requires specialized knowledge under Rule 702 — only a qualified expert may make that determination.",
        distractors: ['611', '403', '602']
    },
    {
        scenario: 'Counsel states in closing argument:\n"Apex Engineering are corrupt criminals who have destroyed this community and deserve to lose everything."',
        correctRule: '403',
        explanation: "This inflammatory language has minimal probative value and is substantially outweighed by the danger of unfair prejudice. 'Corrupt criminals' without supporting evidence is the textbook Rule 403 violation.",
        distractors: ['404', '802', '701']
    },
    {
        scenario: 'Defense counsel asks Dr. Hightower on cross:\n"Doctor, isn\'t it true you were previously accused of negligence in another case?"',
        correctRule: '404',
        explanation: "Prior bad act evidence offered to show propensity — because Dr. Hightower was negligent before, he must be wrong now. That is precisely the inference Rule 404(b) prohibits. MIMIC exceptions do not apply here.",
        distractors: ['608', '609', '403']
    },
    {
        scenario: 'Cam Martinez testifies:\n"I didn\'t see the change order myself, but everyone at Metro knows it was rushed through under pressure from Apex."',
        correctRule: '602',
        explanation: "'Everyone knows' is not personal knowledge — it is speculation and rumor. The witness must testify only to matters they personally perceived. 'Everyone knows' equals no personal knowledge.",
        distractors: ['802', '701', '404']
    },
    {
        scenario: 'On direct examination of Dr. Ash Forrester:\n"Dr. Chen is a genius who never makes engineering mistakes — you would agree with that, wouldn\'t you?"',
        correctRule: '608',
        explanation: "This bolsters Dr. Chen's credibility as a witness before it has been attacked by opposing counsel. Rule 608 permits credibility support only in response to a prior attack — you cannot preemptively bolster.",
        distractors: ['701', '702', '403']
    },
    {
        scenario: 'Whitley Carter testifies:\n"The project manager told me the change order was fully approved by Apex, so I signed off on the final inspection."',
        correctRule: '802',
        explanation: "Carter is repeating an out-of-court statement made by the project manager, offered to prove the truth of that statement — that the change order was in fact approved by Apex. Classic hearsay.",
        distractors: ['602', '701', '805']
    },
    {
        scenario: 'Defense counsel cross-examines Dr. Hightower:\n"Doctor, isn\'t Apex just a company whose culture is to always put profit before people?"',
        correctRule: '404',
        explanation: "Asking about Apex's 'culture' of prioritizing profit is character evidence offered to show they acted in conformity with that character in this specific case — the exact prohibited inference under Rule 404(a).",
        distractors: ['403', '611', '602']
    },
    {
        scenario: 'Reed Alvarez testifies:\n"My sister called me and said she read on a blog that the building was structurally dangerous, and that\'s what prompted me to contact Dr. Chen."',
        correctRule: '802',
        explanation: "Alvarez is repeating what his sister said (hearsay, layer 1) who was repeating what she read on a blog (hearsay, layer 2). If offered to prove the building was dangerous, this is 805 Double Hearsay. If offered only to explain why Alvarez acted, it may be non-hearsay — context matters.",
        distractors: ['805', '602', '404']
    }
];

// ── DATA: AUDIO SEGMENTS ─────────────────────────────────────────────────────
const RV_AUDIO_SEGMENTS = [
    {
        lines: [
            { speaker: 'Counsel', text: "Dr. Hightower, I want to turn now to the connection substitution — that is the central issue in this case, isn't it?" },
            { speaker: 'Witness', text: 'Yes. The substitution from welded moment connections to bolted shear connections is the key structural change at issue.' },
            { speaker: 'Counsel', text: 'The welded moment connections — those are the connections that the original Apex design specified for the elevated columns, correct?' },
            { speaker: 'Witness', text: 'That is correct. Welded connections were specified because of the elevated column design\'s unique lateral load requirements.' },
            { speaker: 'Counsel', text: "And those unique lateral load requirements — those are exactly what make this building vulnerable under quartering wind conditions?" },
        ],
        technique: 'Looping',
        hint: "Every question opens with the witness's last key phrase. 'The welded moment connections...' → 'Those unique lateral load requirements...' — each answer becomes the next question."
    },
    {
        lines: [
            { speaker: 'Counsel', text: "Mr. Alvarez, I want to turn now to the moment everything changed. You received a document that you described as making your blood boil. Tell the jury what that was." },
            { speaker: 'Witness', text: "It was the whistleblower memo — Exhibit 1. An Apex engineer confirming they had knowingly approved inferior connections." },
            { speaker: 'Counsel', text: "Let's focus now on what you did in the immediate hours after you read that memo. You called Apex directly, correct?" },
        ],
        technique: 'Headlining',
        hint: '"I want to turn now to..." and "Let\'s focus now on..." are the headline signals. They give the jury a chapter title before each topic, helping them follow your narrative map.'
    },
    {
        lines: [
            { speaker: 'Counsel', text: 'Ms. Carter, take us back to the day of your structural inspection. Describe what the East Superior Tower construction site looked like when you arrived.' },
            { speaker: 'Witness', text: 'A massive 30-story steel skeleton — fully erected, workers and scaffolding throughout. Every connection was accessible.' },
            { speaker: 'Counsel', text: 'What documents did you have with you that day?' },
            { speaker: 'Witness', text: 'The approved structural drawings, connection specifications, and my inspection checklist.' },
            { speaker: 'Counsel', text: 'Standing there — with those approved drawings in your hands, looking directly at those connections — what did your inspection find?' },
        ],
        technique: 'Scene Setting',
        hint: "Counsel builds the physical scene first — the location, the documents, the witness's position — THEN asks the key question. The answer lands inside a vivid, concrete picture the jury can see."
    }
];

// ── STATE ────────────────────────────────────────────────────────────────────
let _rvAudioState  = { segIdx: 0, lineIdx: 0, detected: false, score: 0, total: 0 };
let _rvDrillState  = { idx: 0, score: 0, total: 0, answered: false, order: [] };
let _rvRunawayState = { scenarioIdx: 0, evasionIdx: 0 };

// ── TAB NAVIGATION ───────────────────────────────────────────────────────────
function switchReviewTab(tab) {
    document.querySelectorAll('.rv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.rv-panel').forEach(p => p.classList.remove('active'));

    const tabEl   = document.querySelector(`.rv-tab[onclick="switchReviewTab('${tab}')"]`);
    const panelEl = document.getElementById(`rv-panel-${tab}`);

    if (tabEl)   tabEl.classList.add('active');
    if (panelEl) panelEl.classList.add('active');

    _rv_saveMastery('lastTab', tab);
}

// ── STRATEGY DECK ────────────────────────────────────────────────────────────
function toggleStrategyCard(el) {
    el.classList.toggle('expanded');
    const arrow = el.querySelector('.gold-text.text-base');
    if (arrow) arrow.textContent = el.classList.contains('expanded') ? '▾' : '▸';
}

// Listen to Strategy
function startListenToStrategy() {
    _rvAudioState = { segIdx: 0, lineIdx: 0, detected: false, score: 0, total: 0 };

    const btn  = document.getElementById('rv-audio-btn');
    const feed = document.getElementById('rv-audio-feed');
    const det  = document.getElementById('rv-audio-detect');
    const scoreEl = document.getElementById('rv-audio-score');

    if (btn)     { btn.textContent = 'PLAYING...'; btn.disabled = true; }
    if (feed)    { feed.innerHTML = ''; feed.classList.remove('hidden'); }
    if (det)     det.classList.add('hidden');
    if (scoreEl) scoreEl.classList.add('hidden');

    _rv_playAudioLine();
}

function _rv_playAudioLine() {
    const seg = RV_AUDIO_SEGMENTS[_rvAudioState.segIdx];
    if (!seg) { _rv_endAudio(); return; }

    if (_rvAudioState.lineIdx >= seg.lines.length) {
        _rv_showAudioDetect(seg);
        return;
    }

    const line = seg.lines[_rvAudioState.lineIdx];
    const feed = document.getElementById('rv-audio-feed');
    if (!feed) return;

    const div = document.createElement('div');
    div.className = 'audio-line';
    const speakerClass = line.speaker === 'Counsel' ? 'gold-text' : 'text-blue-400';
    div.innerHTML = `<span class="font-bold text-[10px] uppercase tracking-wider ${speakerClass}">${line.speaker}: </span><span class="text-white/80">${line.text}</span>`;
    feed.appendChild(div);

    setTimeout(() => div.classList.add('lit'), 60);
    setTimeout(() => div.classList.remove('lit'), 2100);

    _rvAudioState.lineIdx++;
    setTimeout(_rv_playAudioLine, 2400);
}

function _rv_showAudioDetect(seg) {
    const det  = document.getElementById('rv-audio-detect');
    const btns = document.getElementById('rv-audio-btns');
    const fb   = document.getElementById('rv-audio-feedback');

    if (!det || !btns) return;

    det.classList.remove('hidden');
    if (fb) fb.classList.add('hidden');
    btns.innerHTML = '';

    // Build shuffled options (all 6 technique names)
    const choices = RV_TECHNIQUES.map(t => t.name).sort(() => Math.random() - 0.5);
    // Ensure correct answer is present (it always is since we use all 6)
    choices.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'strategy-detect-btn';
        btn.textContent = name.toUpperCase();
        const fire = (e) => { e.preventDefault(); _rv_checkAudio(name, seg, btn, btns); };
        btn.addEventListener('click', fire);
        btn.addEventListener('touchend', fire);
        btns.appendChild(btn);
    });
}

function _rv_checkAudio(chosen, seg, clickedBtn, btnsEl) {
    if (_rvAudioState.detected) return;
    _rvAudioState.detected = true;
    _rvAudioState.total++;

    const correct = chosen === seg.technique;
    if (correct) _rvAudioState.score++;

    clickedBtn.classList.add(correct ? 'detected' : 'miss');
    if (!correct) {
        btnsEl.querySelectorAll('.strategy-detect-btn').forEach(b => {
            if (b.textContent === seg.technique.toUpperCase()) b.classList.add('detected');
        });
    }

    const fb = document.getElementById('rv-audio-feedback');
    if (fb) {
        fb.classList.remove('hidden');
        fb.className = `mt-3 text-xs p-3 rounded-lg leading-relaxed ${correct ? 'bg-green-950/30 border border-green-500/20' : 'bg-red-950/30 border border-red-500/20'}`;
        fb.innerHTML = `<span class="font-bold ${correct ? 'text-green-400' : 'text-red-400'}">${correct ? 'Correct.' : 'Technique was: ' + seg.technique}</span> ${seg.hint}`;
    }

    setTimeout(() => {
        _rvAudioState.segIdx++;
        _rvAudioState.lineIdx = 0;
        _rvAudioState.detected = false;
        const det = document.getElementById('rv-audio-detect');
        if (det) det.classList.add('hidden');
        if (_rvAudioState.segIdx >= RV_AUDIO_SEGMENTS.length) {
            _rv_endAudio();
        } else {
            _rv_playAudioLine();
        }
    }, 2800);
}

function _rv_endAudio() {
    const btn = document.getElementById('rv-audio-btn');
    if (btn) { btn.textContent = 'REPLAY'; btn.disabled = false; btn.onclick = startListenToStrategy; }
    const scoreEl = document.getElementById('rv-audio-score');
    if (scoreEl) {
        scoreEl.classList.remove('hidden');
        scoreEl.textContent = `Session: ${_rvAudioState.score} / ${_rvAudioState.total} techniques identified correctly`;
    }
}

// ── TECHNIQUE CARDS ──────────────────────────────────────────────────────────
function buildTechniqueCards() {
    const container = document.getElementById('rv-technique-cards');
    if (!container) return;
    container.innerHTML = '';

    RV_TECHNIQUES.forEach((tech, i) => {
        const exHTML = tech.example.map(line => {
            const sc = line.speaker === 'Counsel' ? 'gold-text' : 'text-blue-400';
            const bc = line.speaker === 'Counsel' ? 'border-gold/50' : 'border-blue-400/30';
            return `<div class="mb-2 pl-3 border-l-2 ${bc}">
                <span class="text-[10px] font-bold uppercase tracking-wider ${sc}">${line.speaker}: </span>
                <span class="text-xs text-white/80">${line.text}</span>
            </div>`;
        }).join('');

        const div = document.createElement('div');
        div.className = 'technique-card';
        div.innerHTML = `
            <div class="technique-header" onclick="toggleTechnique(this,${i})">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${tech.color}"></div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-bold">${tech.name}</span>
                            <span class="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded font-bold flex-shrink-0"
                                  style="background:${tech.color}1a; color:${tech.color}; border:1px solid ${tech.color}44;">${tech.label}</span>
                        </div>
                        <div class="text-[10px] text-muted truncate">${tech.witness} — ${tech.role}</div>
                    </div>
                </div>
                <div class="text-muted text-sm flex-shrink-0 ml-2">▸</div>
            </div>
            <div class="technique-body" id="tech-body-${i}">
                <p class="text-xs text-muted leading-relaxed mb-4">${tech.definition}</p>
                <div class="text-[10px] uppercase tracking-widest text-muted mb-2 font-bold">Case Example — ${tech.witness}</div>
                <div class="bg-black/25 rounded-lg p-3 mb-4">${exHTML}</div>
                <div class="text-[10px] bg-black/25 rounded-lg px-3 py-2.5 border-l-2 border-gold/40">
                    <span class="gold-text font-bold">COACH TIP: </span>
                    <span class="text-muted">${tech.tip}</span>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleTechnique(headerEl, idx) {
    const body  = document.getElementById(`tech-body-${idx}`);
    const arrow = headerEl.querySelector('.text-muted.text-sm');
    if (!body) return;

    const isOpen = body.classList.contains('open');

    // Close all
    document.querySelectorAll('.technique-body').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.technique-header .text-muted.text-sm').forEach(a => { if (a) a.textContent = '▸'; });

    if (!isOpen) {
        body.classList.add('open');
        if (arrow) arrow.textContent = '▾';

        // Mastery tracking
        const viewedSet = JSON.parse(_rv_getMastery('techViewedSet', '[]'));
        if (!viewedSet.includes(idx)) {
            viewedSet.push(idx);
            _rv_saveMastery('techViewedSet', JSON.stringify(viewedSet));
            _rv_saveMastery('techViewed', viewedSet.length);
        }
    }
}

// ── RUNAWAY WITNESS ──────────────────────────────────────────────────────────
function startRunawayWitness() {
    _rvRunawayState = { scenarioIdx: 0, evasionIdx: 0 };
    _rv_renderRunaway();
}

function _rv_renderRunaway() {
    const container = document.getElementById('rv-rw-container');
    if (!container) return;

    const scenario = RV_RUNAWAY_SCENARIOS[_rvRunawayState.scenarioIdx];
    if (!scenario) {
        container.innerHTML = `
            <div class="glass rounded-xl p-5 border border-green-500/25">
                <div class="text-green-400 font-bold text-sm mb-2">All Scenarios Complete</div>
                <div class="text-xs text-muted leading-relaxed mb-4">
                    The Ask → Repeat → Repeat technique works because it forces the witness to either answer or visibly evade. After two repeats, the judge sees the evasion. You then assert the point directly. The jury has now heard the damaging question three times.
                </div>
                <button onclick="startRunawayWitness()" class="btn-outline px-5 py-3 rounded-lg text-xs font-bold w-full" style="touch-action:manipulation;">RESTART</button>
            </div>`;
        return;
    }

    const evasion = scenario.evasions[_rvRunawayState.evasionIdx];
    const isResolved = (_rvRunawayState.evasionIdx >= scenario.evasions.length);

    if (isResolved) {
        const hasNext = _rvRunawayState.scenarioIdx + 1 < RV_RUNAWAY_SCENARIOS.length;
        container.innerHTML = `
            <div class="glass rounded-xl p-5">
                <div class="text-[10px] uppercase tracking-widest text-green-400 font-bold mb-3">Witness Controlled</div>
                <div class="bg-black/25 rounded-lg p-3 mb-4 border-l-2 border-green-500">
                    <div class="text-[10px] gold-text font-bold uppercase mb-1">Counsel (Final Assert):</div>
                    <div class="text-xs text-white/90 italic">"${scenario.finalLine}"</div>
                </div>
                <div class="text-[10px] bg-black/20 rounded-lg px-3 py-2.5 text-muted leading-relaxed mb-4">
                    <span class="text-white font-bold">Technique: </span>${scenario.techniqueLabel}<br>
                    After two repeats without an answer, the jury has now heard your damaging question three times. The evasion itself is the testimony.
                </div>
                ${hasNext
                    ? `<button onclick="nextRunawayScenario()" class="btn-primary px-5 py-3 rounded-lg text-sm font-bold w-full" style="touch-action:manipulation;">NEXT SCENARIO →</button>`
                    : `<button onclick="startRunawayWitness()" class="btn-outline px-5 py-3 rounded-lg text-sm font-bold w-full" style="touch-action:manipulation;">RESTART</button>`}
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="glass rounded-xl p-5">
            <div class="text-[10px] uppercase tracking-widest text-muted font-bold mb-3">
                Scenario ${_rvRunawayState.scenarioIdx + 1} of ${RV_RUNAWAY_SCENARIOS.length}
                &nbsp;·&nbsp; Evasion ${_rvRunawayState.evasionIdx + 1} of ${scenario.evasions.length}
            </div>
            <div class="bg-black/25 rounded-lg p-3 mb-4 border-l-2 border-gold">
                <div class="text-[10px] gold-text font-bold uppercase mb-1">Your Question:</div>
                <div class="text-xs text-white/90">${scenario.question}</div>
            </div>
            <div class="bg-black/25 rounded-lg p-3 mb-5 border-l-2 border-red-400/50">
                <div class="text-[10px] text-red-400 font-bold uppercase mb-1">Witness Response:</div>
                <div class="text-xs text-white/80 italic">"${evasion}"</div>
            </div>
            <div class="text-[10px] text-muted uppercase tracking-widest mb-3 font-bold">How do you respond?</div>
            <div class="space-y-2" id="rw-btn-group">
                <button onclick="handleRunawayChoice('repeat')" class="rw-choice-btn" style="touch-action:manipulation;">
                    <span class="font-bold text-white">Repeat the question</span><span class="text-muted"> — ask the exact same question again, firmly.</span>
                </button>
                <button onclick="handleRunawayChoice('rephrase')" class="rw-choice-btn" style="touch-action:manipulation;">
                    <span class="font-bold text-white">Rephrase</span><span class="text-muted"> — reword it to give the witness more room to answer.</span>
                </button>
                <button onclick="handleRunawayChoice('move-on')" class="rw-choice-btn" style="touch-action:manipulation;">
                    <span class="font-bold text-white">Move on</span><span class="text-muted"> — accept their answer and go to your next topic.</span>
                </button>
            </div>
        </div>`;
}

function handleRunawayChoice(choice) {
    const isCorrect = choice === 'repeat';
    const group = document.getElementById('rw-btn-group');
    if (group) {
        group.querySelectorAll('.rw-choice-btn').forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.45';
            b.style.cursor = 'default';
        });
    }

    const fb = document.createElement('div');
    fb.className = `mt-3 p-3 rounded-lg text-xs leading-relaxed ${isCorrect ? 'bg-green-950/35 border border-green-500/25' : 'bg-red-950/35 border border-red-500/25'}`;
    if (isCorrect) {
        fb.innerHTML = `<span class="font-bold text-green-400">Correct.</span> Repeating the question signals to the judge and jury that the witness is deliberately evading. Hold your ground — do not reward evasion.`;
    } else if (choice === 'rephrase') {
        fb.innerHTML = `<span class="font-bold text-red-400">Risky.</span> Rephrasing rewards the evasion and hands the witness a new exit. The original question was clear — stick with it.`;
    } else {
        fb.innerHTML = `<span class="font-bold text-red-400">Wrong.</span> Moving on lets the witness win. You abandon a key point and signal to the jury that their answer was acceptable. Never leave a key question unanswered.`;
    }

    const container = document.getElementById('rv-rw-container');
    const glass = container ? container.querySelector('.glass') : null;
    if (glass) glass.appendChild(fb);

    setTimeout(() => {
        const nextBtn = document.createElement('button');
        nextBtn.style.touchAction = 'manipulation';
        nextBtn.className = 'mt-3 btn-primary px-5 py-3 rounded-lg text-xs font-bold w-full';
        const scenario = RV_RUNAWAY_SCENARIOS[_rvRunawayState.scenarioIdx];
        if (isCorrect && _rvRunawayState.evasionIdx + 1 < scenario.evasions.length) {
            nextBtn.textContent = 'WITNESS EVADES AGAIN →';
            nextBtn.onclick = () => { _rvRunawayState.evasionIdx++; _rv_renderRunaway(); };
        } else {
            nextBtn.textContent = 'SEE RESOLUTION →';
            nextBtn.onclick = () => { _rvRunawayState.evasionIdx = scenario.evasions.length; _rv_renderRunaway(); };
        }
        if (glass) glass.appendChild(nextBtn);
    }, 350);
}

function nextRunawayScenario() {
    _rvRunawayState.scenarioIdx++;
    _rvRunawayState.evasionIdx = 0;
    _rv_renderRunaway();
}

// ── FACT LAB ─────────────────────────────────────────────────────────────────
function buildFactLab() {
    const container = document.getElementById('rv-factlab-rows');
    if (!container) return;
    container.innerHTML = '';

    const revealed = JSON.parse(_rv_getMastery('factsRevealedSet', '[]'));

    RV_BAD_FACTS.forEach(fact => {
        const isRevealed = revealed.includes(fact.id);
        const row = document.createElement('div');
        row.className = 'fact-row';

        const neutralHtml = isRevealed
            ? `<div><div class="text-[10px] uppercase tracking-widest text-green-400 font-bold mb-1">Neutralization</div>${fact.neutralize}</div>`
            : '<span>Tap to reveal →</span>';

        row.innerHTML = `
            <div class="fact-cell fact-bad">
                <div class="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-1">${fact.label}</div>
                <div class="text-white/90">${fact.bad}</div>
            </div>
            <div class="fact-cell fact-neutral-cell ${isRevealed ? 'revealed' : ''}"
                 id="fact-neutral-${fact.id}">
                ${neutralHtml}
            </div>`;
        container.appendChild(row);

        // Wire touch + click
        if (!isRevealed) {
            const cell = row.querySelector(`#fact-neutral-${fact.id}`);
            const fire = (e) => { e.preventDefault(); neutralizeFact(fact.id); };
            cell.addEventListener('click', fire);
            cell.addEventListener('touchend', fire);
        }
    });

    _rv_updateFactCounter();
}

function neutralizeFact(id) {
    const el = document.getElementById(`fact-neutral-${id}`);
    if (!el || el.classList.contains('revealed')) return;

    const fact = RV_BAD_FACTS.find(f => f.id === id);
    if (!fact) return;

    el.classList.add('revealed');
    el.style.cursor = 'default';
    el.innerHTML = `<div><div class="text-[10px] uppercase tracking-widest text-green-400 font-bold mb-1">Neutralization</div>${fact.neutralize}</div>`;

    const revealed = JSON.parse(_rv_getMastery('factsRevealedSet', '[]'));
    if (!revealed.includes(id)) {
        revealed.push(id);
        _rv_saveMastery('factsRevealedSet', JSON.stringify(revealed));
        _rv_saveMastery('factsRevealed', revealed.length);
    }
    _rv_updateFactCounter();
}

function resetFactLab() {
    _rv_saveMastery('factsRevealedSet', '[]');
    _rv_saveMastery('factsRevealed', 0);
    buildFactLab();
}

function _rv_updateFactCounter() {
    const revealed = JSON.parse(_rv_getMastery('factsRevealedSet', '[]'));
    const el = document.getElementById('rv-factlab-revealed');
    const tot = document.getElementById('rv-factlab-total');
    if (el)  el.textContent  = revealed.length;
    if (tot) tot.textContent = RV_BAD_FACTS.length;
}

// ── BATTLE DRILLS ────────────────────────────────────────────────────────────
function initBattleDrills() {
    _rvDrillState.order    = [...Array(RV_BATTLE_DRILLS.length).keys()].sort(() => Math.random() - 0.5);
    _rvDrillState.idx      = 0;
    _rvDrillState.answered = false;
    _rvDrillState.score    = _rv_getMastery('drillCorrect', 0);
    _rvDrillState.total    = _rv_getMastery('drillTotal',   0);
}

function switchDrillMode() {
    const browse  = document.getElementById('rv-rules-browse');
    const drill   = document.getElementById('rv-battle-drill');
    const toggle  = document.getElementById('rv-drill-toggle');
    if (!browse || !drill || !toggle) return;

    const isDrill = !drill.classList.contains('hidden');
    if (isDrill) {
        drill.classList.add('hidden');
        browse.classList.remove('hidden');
        toggle.textContent = 'Battle Drills';
        toggle.classList.remove('btn-primary');
        toggle.classList.add('btn-outline');
    } else {
        browse.classList.add('hidden');
        drill.classList.remove('hidden');
        toggle.textContent = 'Browse Rules';
        toggle.classList.remove('btn-outline');
        toggle.classList.add('btn-primary');
        _rv_loadDrillCard();
    }
}

function _rv_loadDrillCard() {
    const ordIdx = _rvDrillState.idx % _rvDrillState.order.length;
    const drill  = RV_BATTLE_DRILLS[_rvDrillState.order[ordIdx]];

    // Scenario text
    const scenEl = document.getElementById('rv-drill-scenario');
    if (scenEl) scenEl.textContent = drill.scenario;

    // Reset flip
    const card = document.getElementById('rv-drill-card');
    if (card) card.classList.remove('flipped');

    // Options
    const optsEl = document.getElementById('rv-drill-options');
    if (optsEl) {
        const choices = [drill.correctRule, ...drill.distractors].sort(() => Math.random() - 0.5);
        const rulesData = window.MockTrialRulesData || [];
        optsEl.innerHTML = '';
        choices.forEach(ruleId => {
            const info = rulesData.find(r => r.rule === ruleId) || { name: 'Unknown' };
            const btn = document.createElement('button');
            btn.className = 'drill-option-btn';
            btn.dataset.rule = ruleId;
            btn.innerHTML = `<span class="gold-text font-mono font-bold">Rule ${ruleId}</span> — ${info.name}`;
            const fire = (e) => { e.preventDefault(); answerBattleDrill(ruleId, btn); };
            btn.addEventListener('click', fire);
            btn.addEventListener('touchend', fire);
            optsEl.appendChild(btn);
        });
    }

    // Reset UI
    const fb   = document.getElementById('rv-drill-feedback');
    const next = document.getElementById('rv-drill-next');
    if (fb)   { fb.classList.add('hidden'); }
    if (next) { next.classList.add('hidden'); }

    _rvDrillState.answered = false;
    _rv_updateDrillDisplay();
}

function flipDrillCard() {
    const card = document.getElementById('rv-drill-card');
    if (card) card.classList.toggle('flipped');
}

function answerBattleDrill(ruleId, clickedBtn) {
    if (_rvDrillState.answered) return;
    _rvDrillState.answered = true;

    const ordIdx = _rvDrillState.idx % _rvDrillState.order.length;
    const drill  = RV_BATTLE_DRILLS[_rvDrillState.order[ordIdx]];
    const correct = ruleId === drill.correctRule;

    if (correct) _rvDrillState.score++;
    _rvDrillState.total++;

    // Disable + color all buttons
    const optsEl = document.getElementById('rv-drill-options');
    if (optsEl) {
        optsEl.querySelectorAll('.drill-option-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.rule === drill.correctRule) btn.classList.add('correct');
            else if (btn === clickedBtn && !correct)    btn.classList.add('wrong');
        });
    }

    // Populate and flip card
    const card = document.getElementById('rv-drill-card');
    if (card) {
        const rulesData = window.MockTrialRulesData || [];
        const info = rulesData.find(r => r.rule === drill.correctRule) || {};
        const rn = document.getElementById('rv-drill-rule-num');
        const rnam = document.getElementById('rv-drill-rule-name');
        const rw = document.getElementById('rv-drill-rule-why');
        if (rn)   rn.textContent  = `Rule ${drill.correctRule}`;
        if (rnam) rnam.textContent = info.name || '';
        if (rw)   rw.textContent  = drill.explanation;
        card.classList.add('flipped');
    }

    // Feedback
    const fb = document.getElementById('rv-drill-feedback');
    if (fb) {
        fb.classList.remove('hidden');
        fb.className = `p-3 rounded-lg mb-4 text-xs leading-relaxed ${correct ? 'bg-green-950/35 border border-green-500/25 text-green-200' : 'bg-red-950/35 border border-red-500/25 text-red-200'}`;
        fb.innerHTML = `<span class="font-bold">${correct ? 'Correct.' : `Incorrect — Rule ${drill.correctRule}.`}</span> ${drill.explanation}`;
    }

    // Show next
    const next = document.getElementById('rv-drill-next');
    if (next) next.classList.remove('hidden');

    // Persist
    _rv_saveMastery('drillCorrect', _rvDrillState.score);
    _rv_saveMastery('drillTotal',   _rvDrillState.total);

    _rv_updateDrillDisplay();
}

function nextBattleDrill() {
    _rvDrillState.idx++;
    if (_rvDrillState.idx >= _rvDrillState.order.length) {
        _rvDrillState.order = [...Array(RV_BATTLE_DRILLS.length).keys()].sort(() => Math.random() - 0.5);
        _rvDrillState.idx   = 0;
    }
    _rv_loadDrillCard();
}

function _rv_updateDrillDisplay() {
    const sc   = document.getElementById('rv-drill-score');
    const prog = document.getElementById('rv-drill-progress');
    const tot  = document.getElementById('rv-drill-total');
    if (sc)   sc.textContent   = `${_rvDrillState.score} / ${_rvDrillState.total}`;
    if (prog) prog.textContent = (_rvDrillState.idx % _rvDrillState.order.length) + 1;
    if (tot)  tot.textContent  = _rvDrillState.order.length;
}
// ── STEP NAVIGATION ──────────────────────────────────────────────────────
function showObjStep(stepId) {
    document.querySelectorAll('#objection-room .obj-step').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const target = document.getElementById(stepId);
    if (!target) return;
    target.classList.add('active');
    // The live sim room uses flex
    target.style.display = (stepId === 'obj-sim-room') ? 'flex' : 'block';
}

// ── MASTERY PERSISTENCE (Objection Room specific) ─────────────────────────
const ObjMastery = {
    get: (k, fallback) => {
        try { const d = JSON.parse(localStorage.getItem('obj_mastery2') || '{}'); return d[k] !== undefined ? d[k] : fallback; } catch(e) { return fallback; }
    },
    set: (k, v) => {
        try { const d = JSON.parse(localStorage.getItem('obj_mastery2') || '{}'); d[k] = v; localStorage.setItem('obj_mastery2', JSON.stringify(d)); } catch(e) {}
    }
};

function loadObjMasteryBar() {
    const streak    = ObjMastery.get('streak', 0);
    const allTime   = ObjMastery.get('allTimeCorrect', 0);
    const mastered  = ObjMastery.get('masteredRules', []);
    const fillEl    = document.getElementById('obj-mastery-fill');
    const labelEl   = document.getElementById('obj-mastery-label');
    const streakEl  = document.getElementById('obj-streak');
    const allEl     = document.getElementById('obj-alltime');

    const totalRules = OBJ_RULE_FAMILIES.reduce((acc, fam) => acc + fam.rules.length, 0);
    const pct = Math.min(100, Math.round((mastered.length / totalRules) * 100));

    if (fillEl)   fillEl.style.width = pct + '%';
    if (labelEl)  labelEl.textContent = `${mastered.length} / ${totalRules} Rules Mastered`;
    if (streakEl) streakEl.textContent = streak;
    if (allEl)    allEl.textContent = allTime;
}

function recordObjResult(isCorrect, ruleId) {
    const streak    = ObjMastery.get('streak', 0);
    const allTime   = ObjMastery.get('allTimeCorrect', 0);
    let mastered    = ObjMastery.get('masteredRules', []);
    const newStreak = isCorrect ? streak + 1 : 0;

    if (isCorrect) {
        ObjMastery.set('allTimeCorrect', allTime + 1);
        // Mark rule mastered after 3 correct answers of this rule
        const key = 'correct_' + ruleId;
        const cnt = ObjMastery.get(key, 0) + 1;
        ObjMastery.set(key, cnt);
        if (cnt >= 3 && !mastered.includes(ruleId)) {
            mastered.push(ruleId);
            ObjMastery.set('masteredRules', mastered);
        }
    }
    ObjMastery.set('streak', newStreak);
    loadObjMasteryBar();
    updateSimMasteryBar(newStreak);
}

function updateSimMasteryBar(streak) {
    const fillEl  = document.getElementById('obj-sim-mastery-fill');
    const labelEl = document.getElementById('obj-sim-mastery-label');
    const simStreakEl = document.getElementById('obj-sim-streak');
    const pct = Math.min(100, (streak / 10) * 100);
    if (fillEl)     fillEl.style.width = pct + '%';
    if (labelEl)    labelEl.textContent = `${streak} / 10`;
    if (simStreakEl) simStreakEl.textContent = streak;
}

// ═══════════════════════════════════════════════════════════════════════
//  RULE DATA — All MCCE Rules in 4 Families w/ Jargon Crusher
// ═══════════════════════════════════════════════════════════════════════
const OBJ_RULE_FAMILIES = [
    {
        id: 'form',
        label: 'THE FORM',
        color: '#38bdf8',
        badgeStyle: 'background:rgba(56,189,248,0.15); color:#38bdf8;',
        rules: [
            {
                rule: '611(a)',
                name: 'Argumentative',
                jargon: '"You\'re fighting, not asking questions."',
                full: 'A question that is really a speech or argument, not a genuine request for information. The attorney is debating or badgering the witness rather than eliciting testimony.',
                example: 'In East Superior: "So you\'re telling this jury that you just IGNORED a memo that said the building could COLLAPSE?!"',
                exceptions: [],
                tip: 'The test: is it a question or a fight? If you couldn\'t answer it yes/no, it\'s argumentative.'
            },
            {
                rule: '611(b)',
                name: 'Leading Question (Direct Only)',
                jargon: '"You\'re putting words in their mouth."',
                full: 'A leading question suggests the desired answer. On DIRECT examination of your own witness, you may not lead. On CROSS you are allowed — and expected — to lead.',
                example: 'In East Superior (improper on direct): "Mr. Alvarez, you were scared when you read the memo, weren\'t you?"',
                exceptions: ['Allowed on Cross-Examination', 'Allowed for Hostile Witnesses (Rule 611(c))', 'Allowed for Preliminary Matters', 'Allowed for Witnesses with Difficulty (child, etc.)'],
                tip: 'DIRECT = no leading. CROSS = leading is your weapon. Know which examination you\'re in.'
            },
            {
                rule: '611(c)',
                name: 'Compound Question',
                jargon: '"That\'s two questions crammed into one."',
                full: 'A compound question asks two or more separate questions at once, making it impossible for the witness to give a clear single answer.',
                example: 'In East Superior: "Dr. Hightower, did you review the plans AND conduct wind tunnel tests AND visit the site?"',
                exceptions: [],
                tip: 'One witness answer = one question. If the word "and" joins two separate questions, it\'s compound.'
            },
            {
                rule: '611(d)',
                name: 'Assumes Facts Not in Evidence',
                jargon: '"That never happened yet — you made it up."',
                full: 'The question embeds a factual premise that has not yet been established through testimony or exhibits.',
                example: 'In East Superior: "Mr. Martinez, why did you ignore the safety memo?" — assumes he received and read it.',
                exceptions: ['Prior admissions by the party', 'Facts stipulated by both sides'],
                tip: 'Before you challenge a witness on a fact, that fact must have been testified to or admitted into evidence.'
            },
            {
                rule: '611(e)',
                name: 'Narrative / Non-Responsive',
                jargon: '"Just answer what was asked — nothing more."',
                full: 'A question that invites a rambling story (narrative) rather than specific factual answers. OR an answer that goes beyond what was asked.',
                example: 'In East Superior: "Tell me everything that happened with the East Superior Tower from 2012 to today." — pure narrative.',
                exceptions: [],
                tip: 'Narrative = question too broad. Non-responsive = answer goes outside the question. Both are objectable.'
            },
            {
                rule: '611(f)',
                name: 'Asked and Answered',
                jargon: '"We already heard this — move on."',
                full: 'The question has already been asked and answered in the same examination. Repetition wastes time and appears to bully the witness.',
                example: 'In East Superior: Asking Dr. Forrester for the third time whether the building met code.',
                exceptions: ['Allowed on Cross when impeaching (Rule 613)', 'Allowed to re-establish a key fact for the jury'],
                tip: 'Use this on opposing counsel, not yourself. Never repeat your own questions — the jury heard it.'
            },
            {
                rule: '611(g)',
                name: 'Misquotes the Witness / Misstates',
                jargon: '"That\'s not what they said — don\'t twist it."',
                full: 'Counsel paraphrases or quotes the witness inaccurately in a follow-up question, distorting the prior testimony.',
                example: 'In East Superior: "You said the building was DEFINITELY going to collapse" — when witness said it "could" collapse.',
                exceptions: [],
                tip: 'Use exact words. "You testified..." then quote verbatim. Never paraphrase when you can quote directly.'
            }
        ]
    },
    {
        id: 'witness',
        label: 'THE WITNESS',
        color: '#a78bfa',
        badgeStyle: 'background:rgba(167,139,250,0.15); color:#a78bfa;',
        rules: [
            {
                rule: '602',
                name: 'Lack of Personal Knowledge',
                jargon: '"They weren\'t there — they can\'t know that."',
                full: 'A witness may only testify to matters they personally perceived through their own senses — seeing, hearing, touching. Guessing or inferring what others did or knew is not personal knowledge.',
                example: 'In East Superior: Cam Martinez testifying "Everyone at Apex knew the welds were the right call" — he wasn\'t at Apex\'s internal meetings.',
                exceptions: ['Expert witnesses under Rule 702 may rely on facts not personally observed', 'Statements a witness heard directly (not their inference) may still be offered'],
                tip: 'Ask yourself: could this witness have physically perceived this themselves? If not, 602.'
            },
            {
                rule: '701',
                name: 'Improper Lay Opinion',
                jargon: '"Regular people can\'t guess at expert stuff."',
                full: 'A lay (non-expert) witness may give opinion testimony only if it is rationally based on their own perception, helpful to understanding testimony, and not requiring specialized knowledge. Technical engineering conclusions are off-limits for lay witnesses.',
                example: 'In East Superior: Reed Alvarez opining "The structural system was defective under quartering wind loads" — requires engineering expertise.',
                exceptions: ['Lay opinions on speed, age, sobriety, handwriting (common observations)', 'Anything a normal person could reasonably perceive'],
                tip: 'Lay witness: what you personally saw, heard, smelled. NOT conclusions that require a degree.'
            },
            {
                rule: '702',
                name: 'Improper Expert Opinion',
                jargon: '"You\'re not qualified to say that."',
                full: 'Expert testimony must come from a qualified expert in the relevant field, be based on sufficient facts/data, use reliable methods, and reliably apply those methods to the case facts.',
                example: 'In East Superior: Challenging Dr. Forrester\'s opinion by showing he has never designed a building with an elevated column system.',
                exceptions: ['Expert can rely on inadmissible evidence if experts in the field normally rely on that type', 'Judge screens experts under Daubert/MRE 702 before trial'],
                tip: 'Four elements: qualified + sufficient facts + reliable method + reliable application. Attack any one of the four.'
            },
            {
                rule: '608',
                name: 'Improper Bolstering / Credibility',
                jargon: '"You can\'t vouch for them before they\'re attacked."',
                full: 'A party may not bolster (pre-emptively support) a witness\'s credibility before it has been attacked. You must wait until credibility is challenged before you rehabilitate.',
                example: 'In East Superior: During direct of Dr. Hightower, asking "You\'ve never been wrong in 25 years of engineering work, have you?"',
                exceptions: ['Rehabilitation is allowed AFTER opposing counsel attacks credibility', 'Prior consistent statements under Rule 801(d)(1)(B) if alleged fabrication'],
                tip: 'Bolstering on direct = objection. Rehabilitation after attack = allowed. The order matters.'
            },
            {
                rule: '609',
                name: 'Improper Impeachment by Conviction',
                jargon: '"That old crime isn\'t fair game here."',
                full: 'Prior criminal convictions may only be used to impeach under specific rules: felonies within 10 years, crimes of dishonesty, with probative value outweighing prejudice.',
                example: 'In East Superior: Asking Reed Alvarez about a 20-year-old misdemeanor parking violation to discredit them.',
                exceptions: ['Felony convictions within past 10 years (subject to 403 balancing)', 'Crimes involving dishonesty or false statement always admissible'],
                tip: 'Know the time limit (10 years from conviction OR release), and know the crime type. Dishonesty crimes are always admissible.'
            }
        ]
    },
    {
        id: 'evidence',
        label: 'THE EVIDENCE',
        color: '#fbbf24',
        badgeStyle: 'background:rgba(251,191,36,0.15); color:#fbbf24;',
        rules: [
            {
                rule: '401',
                name: 'Relevance',
                jargon: '"What does that have to do with anything?"',
                full: 'Evidence must make a fact of consequence more or less probable than it would be without the evidence. If it doesn\'t connect to the case, it\'s irrelevant.',
                example: 'In East Superior: Asking Cam Martinez about a completely unrelated construction project from 2005.',
                exceptions: ['Background/foundation questions allowed if limited in scope', 'Proof of habit or routine practice (Rule 406) is relevant'],
                tip: 'Two-part test: (1) Is this fact of consequence in this case? (2) Does the evidence make it more/less likely? Both must be yes.'
            },
            {
                rule: '403',
                name: 'Unfair Prejudice / Waste of Time',
                jargon: '"That\'s more harmful than it\'s worth."',
                full: 'Even relevant evidence may be excluded if its probative value is SUBSTANTIALLY OUTWEIGHED by the danger of unfair prejudice, confusion of the issues, or misleading the jury, or undue delay.',
                example: 'In East Superior: Showing dramatic renderings of the tower collapsing that are not from the actual case and inflame the jury.',
                exceptions: ['Probative value must be merely outweighed — not just close to equal', 'The standard favors admission; exclusion requires substantial imbalance'],
                tip: 'This is a balancing test — probative value vs. unfair prejudice. The bar for exclusion is HIGH. "Prejudicial" alone is not enough — it must be UNFAIRLY prejudicial.'
            },
            {
                rule: '404',
                name: 'Improper Character Evidence',
                jargon: '"Just because they did it before doesn\'t mean they did it now."',
                full: 'Evidence of a person\'s character or prior acts is generally NOT admissible to prove they acted in conformity with that character on a specific occasion.',
                example: 'In East Superior: "Apex Engineering has a history of cutting corners on other projects, so they must have done it here too."',
                exceptions: ['MIMIC exceptions (Motive, Intent, Mistake/Absence of, Identity, Common Scheme/Plan)', 'Character directly in issue (e.g., defamation cases)', 'Victim character in criminal cases'],
                tip: 'Remember MIMIC: Motive, Intent, Mistake, Identity, Common Plan. These are the doors through which prior acts can enter.'
            },
            {
                rule: '407',
                name: 'Subsequent Remedial Measures',
                jargon: '"Fixing it later doesn\'t mean they were wrong before."',
                full: 'When measures are taken after an event that would have made the event less likely to occur, evidence of those measures is NOT admissible to prove negligence or culpable conduct.',
                example: 'In East Superior: Using the fact that Metro Builders changed their welding policy after this project as evidence they were negligent before.',
                exceptions: ['Admissible to prove ownership or control', 'Admissible to rebut a claim of technical infeasibility', 'Admissible for impeachment if the party claims the product was safe'],
                tip: 'Classic civil case trap. The HOA doing a retrofit is NOT evidence the building was negligently built — it\'s a subsequent remedial measure from the defense\'s view.'
            },
            {
                rule: '408',
                name: 'Settlement / Compromise',
                jargon: '"Trying to settle doesn\'t mean you\'re guilty."',
                full: 'Evidence of offers to settle, compromise, or statements made during settlement negotiations are NOT admissible to prove liability or the amount of a claim.',
                example: 'In East Superior: "Apex offered to pay $2 million in settlement negotiations — doesn\'t that prove they knew they were at fault?"',
                exceptions: ['Admissible to prove bias or prejudice of a witness', 'Admissible if offered to show a party engaged in misconduct during negotiations'],
                tip: 'The policy: encourage settlements. If every offer could be used against you, no one would ever try to settle. Protect the process.'
            }
        ]
    },
    {
        id: 'hearsay',
        label: 'THE HEARSAY',
        color: '#ef4444',
        badgeStyle: 'background:rgba(239,68,68,0.15); color:#ef4444;',
        rules: [
            {
                rule: '801',
                name: 'Hearsay Definition',
                jargon: '"Someone said something outside court — and you\'re using it as proof."',
                full: 'Hearsay is an out-of-court STATEMENT (oral, written, or conduct intended as assertion) made by a DECLARANT, offered in evidence to prove the TRUTH OF THE MATTER ASSERTED.',
                example: 'In East Superior: Reed Alvarez testifying "The whistleblower told me the building would collapse" — offered to prove the building would collapse.',
                exceptions: ['NOT hearsay: Verbal acts (the words themselves have legal effect)', 'NOT hearsay: Effect on listener (explains why someone acted)', 'NOT hearsay: Prior inconsistent statements of party-opponent'],
                tip: 'The three questions: (1) Out-of-court statement? (2) Made by a person (declarant)? (3) Offered to prove the truth? All three must be YES for hearsay. If offered for another purpose — not hearsay.'
            },
            {
                rule: '801(d)',
                name: 'Admissions / Prior Statements (Non-Hearsay)',
                jargon: '"A party\'s own words can always come in against them."',
                full: 'A statement is not hearsay if it is offered against an OPPOSING PARTY and was made by that party (admission by party-opponent), or by their agent within the scope of agency.',
                example: 'In East Superior: The whistleblower memo written by Apex\'s own engineer Samuel Greene — an admission by party-opponent agent.',
                exceptions: ['All admissions by party-opponents are admissible — no personal knowledge requirement', 'Agents: must be within scope of employment and made during the relationship'],
                tip: 'This is why Exhibit #1 (the Apex internal memo) is so powerful — it\'s an admission by Apex\'s own agent. It can\'t be kept out as hearsay.'
            },
            {
                rule: '802',
                name: 'Hearsay Rule',
                jargon: '"Out-of-court statements proving the truth are not allowed."',
                full: 'Hearsay is not admissible unless an exception or exemption applies under the rules of evidence. This is the core prohibition.',
                example: 'In East Superior: Whitley Carter testifying "The project manager told me the change order was fully approved" — offered to prove the change order was approved.',
                exceptions: ['Over 30 exceptions exist — see Rules 803, 804, 807', 'Most common: Present Sense Impression, Excited Utterance, Business Records, Former Testimony'],
                tip: 'Hearsay = the other side gets to use the statement but can\'t cross-examine the person who made it. That\'s the core unfairness the rule prevents.'
            },
            {
                rule: '803',
                name: 'Hearsay Exceptions (Declarant Available)',
                jargon: '"Even if hearsay, these types still come in."',
                full: 'Rule 803 exceptions apply regardless of whether the declarant is available. The most critical for this case:',
                example: 'In East Superior: HOA meeting minutes (Business Record 803(6)); Dr. Hightower\'s report prepared for litigation (803(6) potentially); News articles (NOT an exception — usually 403 concern).',
                exceptions: [
                    '803(1) Present Sense Impression — said it as it happened',
                    '803(2) Excited Utterance — said it under stress/excitement',
                    '803(3) State of Mind — then-existing mental/emotional condition',
                    '803(4) Medical Treatment — statement for diagnosis',
                    '803(5) Past Recollection Recorded — witness can\'t remember, wrote it down contemporaneously',
                    '803(6) Business Records — kept in regular course of business',
                    '803(8) Public Records — official records of public agency'
                ],
                tip: 'Know 803(6) Business Records COLD — it\'s how most documents (meeting minutes, invoices, reports) get in. Regular practice + regular course of business + person with knowledge.'
            },
            {
                rule: '804',
                name: 'Hearsay Exceptions (Declarant Unavailable)',
                jargon: '"They can\'t testify, so we use what they said before."',
                full: 'Rule 804 exceptions ONLY apply when the declarant is unavailable (dead, refuses to testify, lacks memory, etc.).',
                example: 'In East Superior: Travis Swift (original Apex engineer) is deceased. His prior statements in the project file may be admissible under 804(b)(1) if he testified under oath in a prior proceeding.',
                exceptions: [
                    '804(b)(1) Former Testimony — testified under oath, opportunity to cross-examine',
                    '804(b)(2) Dying Declaration — in criminal/civil, belief of imminent death',
                    '804(b)(3) Statement Against Interest — so contrary to declarant\'s interest they wouldn\'t lie',
                    '804(b)(6) Forfeiture by Wrongdoing — party caused unavailability'
                ],
                tip: 'Travis Swift is dead — this is why 804 matters in East Superior. His engineering decisions and any sworn prior statements are potentially admissible under 804.'
            },
            {
                rule: '805',
                name: 'Hearsay Within Hearsay (Double Hearsay)',
                jargon: '"That\'s hearsay inside more hearsay — both need exceptions."',
                full: 'When a statement contains an embedded statement (hearsay within hearsay), EACH layer must independently qualify under an exception or exemption.',
                example: 'In East Superior: "Reed Alvarez told me his sister read on a blog that the building was falling down" — Alvarez\'s statement (layer 1) + blog post (layer 2).',
                exceptions: ['Each layer independently satisfies an exception', 'If one layer is an admission (Rule 801(d)) and the other qualifies under 803, both layers are covered'],
                tip: 'Peel the onion: find each statement, identify the declarant for each layer, then find an exception for each layer independently. Miss one layer — the whole thing is out.'
            }
        ]
    }
];

// ═══════════════════════════════════════════════════════════════════════
//  RULE LIBRARY — Build & Switch
// ═══════════════════════════════════════════════════════════════════════
let _objCurrentFamily = 'form';

function initObjRuleLibrary() {
    showObjStep('obj-rule-library');
    switchObjFamily('form');
    logAction("Rule Library Opened");
}

function switchObjFamily(familyId) {
    _objCurrentFamily = familyId;

    // Update tab buttons
    document.querySelectorAll('.obj-family-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('fam-btn-' + familyId);
    if (activeBtn) activeBtn.classList.add('active');

    // Build panel
    const panel = document.getElementById('obj-family-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const family = OBJ_RULE_FAMILIES.find(f => f.id === familyId);
    if (!family) return;

    family.rules.forEach((rule, idx) => {
        const mastered = ObjMastery.get('masteredRules', []);
        const isMastered = mastered.includes(rule.rule);
        const correct = ObjMastery.get('correct_' + rule.rule, 0);

        const card = document.createElement('div');
        card.className = 'obj-rule-card';
        card.id = `obj-rule-card-${familyId}-${idx}`;

        const excHTML = rule.exceptions.length > 0
            ? `<div class="mt-3"><div class="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">⚡ Exceptions / When It Doesn't Apply:</div><div class="flex flex-wrap gap-1">${rule.exceptions.map(e => `<span class="obj-exception-tag">${e}</span>`).join('')}</div></div>`
            : '';

        card.innerHTML = `
            <div class="obj-rule-header" onclick="toggleObjRuleCard('${familyId}-${idx}')">
                <div class="obj-rule-badge" style="${family.badgeStyle}">Rule ${rule.rule}</div>
                <div class="flex-grow min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-white">${rule.name}</span>
                        ${isMastered ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-green-900/40 border border-green-500/30 text-green-400 font-bold">✓ MASTERED</span>' : ''}
                        ${correct > 0 && !isMastered ? `<span class="text-[9px] text-muted">${correct}/3 correct</span>` : ''}
                    </div>
                    <div class="text-[10px] text-muted mt-0.5">${rule.jargon}</div>
                </div>
                <div class="text-muted text-sm flex-shrink-0 ml-2 rule-arrow-${familyId}-${idx}">▸</div>
            </div>
            <div class="obj-rule-body" id="obj-rule-body-${familyId}-${idx}">
                <div class="obj-jargon">💡 Jargon Crusher: ${rule.jargon}</div>
                <p class="text-xs text-muted leading-relaxed mt-2">${rule.full}</p>
                <div class="mt-3 bg-black/25 rounded-lg p-3 border-l-2 border-yellow-500/40">
                    <div class="text-[10px] font-bold uppercase tracking-widest gold-text mb-1">East Superior Example</div>
                    <div class="text-xs text-white/80 italic">${rule.example}</div>
                </div>
                ${excHTML}
                <div class="mt-3 text-[10px] bg-black/20 rounded-lg px-3 py-2.5 border-l-2 border-blue-400/40">
                    <span class="text-blue-400 font-bold">COACH TIP: </span>
                    <span class="text-muted">${rule.tip}</span>
                </div>
            </div>
        `;
        panel.appendChild(card);
    });
}

function toggleObjRuleCard(key) {
    const card  = document.getElementById(`obj-rule-card-${key}`);
    const body  = document.getElementById(`obj-rule-body-${key}`);
    const arrow = card ? card.querySelector(`.rule-arrow-${key}`) : null;
    if (!card || !body) return;

    const isOpen = card.classList.contains('open');
    // Close all
    document.querySelectorAll('.obj-rule-card').forEach(c => c.classList.remove('open'));
    document.querySelectorAll('.obj-rule-body').forEach(b => b.style.display = 'none');
    document.querySelectorAll('[class*="rule-arrow-"]').forEach(a => a.textContent = '▸');

    if (!isOpen) {
        card.classList.add('open');
        body.style.display = 'block';
        if (arrow) arrow.textContent = '▾';
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  PASSIVE LEARNING — East Superior Auto-Objection Script
// ═══════════════════════════════════════════════════════════════════════
const PASSIVE_SCRIPT = [
    { speaker: 'COUNSEL (Plaintiff)', text: 'Mr. Alvarez, please state your name for the record.', violation: false },
    { speaker: 'REED ALVAREZ', text: 'Reed Alvarez. I am the President of the East Superior Residential HOA.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Mr. Alvarez, directing your attention to March 2016 — you received a memo that changed everything for the residents, correct?', violation: false },
    { speaker: 'REED ALVAREZ', text: 'Yes. I received Exhibit 1 — the internal whistleblower memo from Samuel Greene at Apex Engineering. When I read it, my blood ran cold.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'And when you called Apex, what did their receptionist tell you?', violation: false },
    { speaker: 'REED ALVAREZ', text: 'I could hear her talking to Mr. Swift in the background. He told her to tell me they were "working on it." That means they knew the building was dangerous.', violation: true, ruleNum: '701', ruleName: 'Improper Lay Opinion', jargon: '"Regular people can\'t guess at expert stuff."', explain: 'Alvarez is interpreting what "working on it" means in a structural engineering context — specifically inferring that Apex knew the building was dangerous. That conclusion requires specialized engineering knowledge. As a lay witness (even a lawyer), he cannot draw that technical inference.' },
    { speaker: 'COUNSEL (Plaintiff)', text: 'You also spoke with Dr. Chen, correct?', violation: false },
    { speaker: 'REED ALVAREZ', text: 'Yes. Dr. Chen told me that his student had run calculations showing the building would definitely collapse in a severe storm.', violation: true, ruleNum: '802', ruleName: 'Hearsay', jargon: '"Out-of-court statements proving the truth are not allowed."', explain: 'Alvarez is repeating what Dr. Chen told him — an out-of-court statement — offered to prove the truth (that the building WOULD collapse). This is classic hearsay. Dr. Chen is the declarant; he needs to testify himself, not through Alvarez.' },
    { speaker: 'COUNSEL (Defense)', text: 'Objection, hearsay.', violation: false },
    { speaker: 'JUDGE', text: 'Sustained. The jury will disregard that statement. Please rephrase.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Mr. Alvarez, what did YOU personally observe about the building\'s condition?', violation: false },
    { speaker: 'REED ALVAREZ', text: 'I personally noticed it swayed during a thunderstorm. A tenant on the 28th floor reported it to me.', violation: false },
    { speaker: 'COUNSEL (Defense)', text: 'Mr. Alvarez, isn\'t it true that you have a financial interest in the outcome of this case, owning four units in the building?', violation: false },
    { speaker: 'REED ALVAREZ', text: 'I own units, yes. I\'ve already lost rental income.', violation: false },
    { speaker: 'COUNSEL (Defense)', text: 'And your sister, who is a real estate agent, told you property values would crash — that\'s what really motivated this lawsuit, isn\'t it?', violation: true, ruleNum: '802', ruleName: 'Hearsay', jargon: '"Out-of-court statements proving the truth are not allowed."', explain: 'Defense counsel is asserting that Alvarez\'s sister (out of court) said property values would crash — and using that statement to prove the truth of the motivation. This is hearsay embedded in a cross-examination question.' },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Objection, hearsay — counsel is characterizing an out-of-court statement as proven fact.', violation: false },
    { speaker: 'JUDGE', text: 'Sustained.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Dr. Hightower, you hold two Ph.D.s, correct?', violation: false },
    { speaker: 'DR. HIGHTOWER', text: 'Yes — from MIT in Structural Engineering and from Johns Hopkins in Industrial Hygiene and Risk Management.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'And in your professional opinion, the bolted shear connections used in the East Superior Tower were structurally inadequate for this design?', violation: false },
    { speaker: 'DR. HIGHTOWER', text: 'Yes. For a building of this height and unique elevated-column configuration, bolted shear connections provide insufficient lateral stiffness under quartering wind loads.', violation: false },
    { speaker: 'COUNSEL (Defense)', text: 'Dr. Hightower — you\'ve never visited the building in person, you made all of your calculations from your computer, and isn\'t it true that you\'ve testified for plaintiffs 100% of the time?', violation: true, ruleNum: '611(c)', ruleName: 'Compound Question', jargon: '"That\'s two questions crammed into one."', explain: 'Defense counsel asked THREE separate questions in one: (1) never visited the building, (2) made calculations from a computer, (3) testified for plaintiffs 100% of the time. The witness cannot give a single coherent answer to all three. Object immediately on compound — each deserves its own answer.' },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Objection — compound. Three separate questions in one.', violation: false },
    { speaker: 'JUDGE', text: 'Sustained. Counsel, please ask one question at a time.', violation: false },
    { speaker: 'COUNSEL (Defense)', text: 'Dr. Forrester, you\'ve worked with Apex on 10 of their 20 largest projects — isn\'t it fair to say Apex Engineering is a company that always puts public safety first?', violation: true, ruleNum: '404', ruleName: 'Improper Character Evidence', jargon: '"Just because they did it before doesn\'t mean they did it now."', explain: 'This question asks the jury to find that because Apex has a reputation for prioritizing safety (character trait), they must have acted safely in this specific case — exactly the propensity inference prohibited by Rule 404(a). General company character is not admissible to prove conduct on this specific occasion.' },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Objection — improper character evidence. Asking the jury to infer conduct from character.', violation: false },
    { speaker: 'JUDGE', text: 'Sustained. Rephrase.', violation: false },
    { speaker: 'COUNSEL (Defense)', text: 'Dr. Forrester, based on your review of the design documents, the building complied with applicable building codes at the time of construction?', violation: false },
    { speaker: 'DR. FORRESTER', text: 'Yes. The structure was fully compliant with the 2009 IBC and applicable Michigan amendments in effect at the time.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Dr. Forrester — you\'ve been paid $800 per hour to testify today, you\'ve billed 29 hours for trial prep alone, and you know Dr. Chen personally from Stanford — all of that goes to your bias, doesn\'t it?', violation: false },
    { speaker: 'DR. FORRESTER', text: 'My fees are disclosed. My opinions are independent.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Mr. Martinez, I\'ll ask you directly — you built the East Superior Tower EXACTLY as Apex specified, including the bolt substitution, right?', violation: false },
    { speaker: 'CAM MARTINEZ', text: 'Yes. Metro built what Apex approved. We followed their plans to the letter.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'And you knew the change from welds to bolts was made to reduce costs — it saved about 14 to 18 percent on structural costs, right?', violation: false },
    { speaker: 'CAM MARTINEZ', text: 'That\'s what Apex told us. Yes.', violation: false },
    { speaker: 'COUNSEL (Defense)', text: 'Mr. Martinez, after the HOA raised concerns, Metro immediately commissioned its own structural review — doesn\'t that prove Metro takes safety seriously?', violation: true, ruleNum: '407', ruleName: 'Subsequent Remedial Measures', jargon: '"Fixing it later doesn\'t mean they were wrong before."', explain: 'Counsel is using a post-event remedial action (the structural review commissioned after the HOA complained) as evidence of Metro\'s responsible character. Rule 407 prohibits using subsequent remedial measures to prove culpable conduct — it would discourage companies from doing the right thing after an incident.' },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Objection — subsequent remedial measures. Rule 407.', violation: false },
    { speaker: 'JUDGE', text: 'Sustained.', violation: false },
    { speaker: 'COUNSEL (Plaintiff)', text: 'Mr. Martinez — you heard the building sway, you heard residents complain, and you did NOTHING about it. You\'re no better than the engineers who designed it — aren\'t you?', violation: true, ruleNum: '611(a)', ruleName: 'Argumentative', jargon: '"You\'re fighting, not asking questions."', explain: 'This is a speech, not a question. "You\'re no better than the engineers" is a direct argument to the witness — it doesn\'t seek information, it attacks. The attorney is debating, not examining. Classic argumentative objection.' },
    { speaker: 'COUNSEL (Defense)', text: 'Objection — argumentative.', violation: false },
    { speaker: 'JUDGE', text: 'Sustained. Counsel, please ask a question.', violation: false }
];

// ═══════════════════════════════════════════════════════════════════════
//  PASSIVE LEARNING — RULE FLASHCARDS WITH TEXT-TO-SPEECH
// ═══════════════════════════════════════════════════════════════════════

let _flashcardState = { 
    flashcards: [],
    current: 0,
    learned: new Set(),
    speaking: false
};

function initPassiveLearning() {
    showObjStep('obj-passive-room');
    
    // Build flashcards from OBJ_RULE_FAMILIES
    _flashcardState.flashcards = [];
    OBJ_RULE_FAMILIES.forEach(family => {
        family.rules.forEach(rule => {
            _flashcardState.flashcards.push({
                ...rule,
                family: family.label,
                familyColor: family.color
            });
        });
    });
    
    _flashcardState.current = 0;
    _flashcardState.learned.clear();
    
    document.getElementById('obj-flashcard-total').textContent = _flashcardState.flashcards.length;
    displayFlashcard();
    logAction("Passive Learning (Flashcards) Ready");
}

function displayFlashcard() {
    const flashcard = _flashcardState.flashcards[_flashcardState.current];
    if (!flashcard) return;

    // Update progress
    document.getElementById('obj-flashcard-num').textContent = _flashcardState.current + 1;
    document.getElementById('obj-flashcard-learned').textContent = _flashcardState.learned.size;
    const fillPct = (_flashcardState.current / _flashcardState.flashcards.length) * 100;
    document.getElementById('obj-flashcard-mastery-fill').style.width = fillPct + '%';

    // Update card content
    document.getElementById('obj-flashcard-family').textContent = flashcard.family;
    document.getElementById('obj-flashcard-rule').textContent = 'Rule ' + flashcard.rule;
    document.getElementById('obj-flashcard-name').textContent = flashcard.name;
    document.getElementById('obj-flashcard-jargon').textContent = flashcard.jargon;
    document.getElementById('obj-flashcard-full').textContent = flashcard.full;
    document.getElementById('obj-flashcard-example').textContent = flashcard.example;
    document.getElementById('obj-flashcard-tip').textContent = flashcard.tip;

    // Update mark button text
    const markBtn = document.getElementById('obj-flashcard-mark');
    if (markBtn) {
        if (_flashcardState.learned.has(_flashcardState.current)) {
            markBtn.textContent = '✓ MARKED LEARNED';
            markBtn.classList.add('opacity-50');
        } else {
            markBtn.textContent = '✓ MARK LEARNED';
            markBtn.classList.remove('opacity-50');
        }
    }
}

function speakFlashcard() {
    const flashcard = _flashcardState.flashcards[_flashcardState.current];
    if (!flashcard) return;

    window.speechSynthesis.cancel();
    
    const text = `Rule ${flashcard.rule}. ${flashcard.name}. ${flashcard.jargon}. ${flashcard.full}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
    _flashcardState.speaking = true;
}

function nextFlashcard() {
    if (_flashcardState.current < _flashcardState.flashcards.length - 1) {
        _flashcardState.current++;
        window.speechSynthesis.cancel();
        displayFlashcard();
    }
}

function prevFlashcard() {
    if (_flashcardState.current > 0) {
        _flashcardState.current--;
        window.speechSynthesis.cancel();
        displayFlashcard();
    }
}

function markFlashcardLearned() {
    if (_flashcardState.learned.has(_flashcardState.current)) {
        _flashcardState.learned.delete(_flashcardState.current);
    } else {
        _flashcardState.learned.add(_flashcardState.current);
    }
    displayFlashcard();
}

function stopPassiveLearning() {
    window.speechSynthesis.cancel();
    _flashcardState.speaking = false;
}

// ═══════════════════════════════════════════════════════════════════════
//  BATTLE DRILLS — 10 East Superior Scenarios, 6-Second Timer
// ═══════════════════════════════════════════════════════════════════════
const OBJ_BATTLE_DRILLS = [
    {
        num: 1,
        scene: 'Direct Examination of Reed Alvarez',
        testimony: '"My neighbor told me she heard Apex engineers say the building was going to fall down during a windstorm."',
        speaker: 'REED ALVAREZ',
        correct: '802',
        correctName: 'Hearsay',
        explanation: 'Triple hearsay: Alvarez repeats what his neighbor said (Layer 1), who repeated what Apex engineers said (Layer 2). Offered to prove the truth — the building would fall. Every layer needs an independent exception. Neither qualifies here.',
        distractors: [{ rule: '602', name: 'Lack of Personal Knowledge' }, { rule: '701', name: 'Improper Lay Opinion' }, { rule: '403', name: 'Unfair Prejudice' }]
    },
    {
        num: 2,
        scene: 'Direct Examination of Dr. Hightower',
        testimony: 'COUNSEL: "Dr. Hightower — you\'ve never testified for the defense, your report was funded by the HOA, AND you didn\'t visit the building, so you can\'t be trusted, can you?"',
        speaker: 'COUNSEL (Plaintiff)',
        correct: '611(c)',
        correctName: 'Compound Question',
        explanation: 'Three separate attacks in one question: (1) never testified for defense, (2) HOA funded the report, (3) never visited the building. The witness cannot give a single coherent answer. Each challenge deserves its own question.',
        distractors: [{ rule: '611(a)', name: 'Argumentative' }, { rule: '403', name: 'Unfair Prejudice' }, { rule: '702', name: 'Improper Expert Opinion' }]
    },
    {
        num: 3,
        scene: 'Direct Examination of Whitley Carter',
        testimony: 'COUNSEL (Defense): "Inspector Carter, you\'ve always been known as the most thorough inspector in the department, haven\'t you?"',
        speaker: 'COUNSEL (Defense)',
        correct: '608',
        correctName: 'Improper Bolstering',
        explanation: 'No one has attacked Carter\'s credibility yet. You cannot pre-emptively bolster a witness\'s reputation for thoroughness before opposing counsel attacks them. Rule 608 allows credibility support only AFTER an attack.',
        distractors: [{ rule: '611(a)', name: 'Argumentative' }, { rule: '401', name: 'Relevance' }, { rule: '404', name: 'Improper Character Evidence' }]
    },
    {
        num: 4,
        scene: 'Cross-Examination of Cam Martinez',
        testimony: '"I didn\'t actually see the change order, but everyone at Metro knows the swap from welds to bolts was Apex\'s call, not ours."',
        speaker: 'CAM MARTINEZ',
        correct: '602',
        correctName: 'Lack of Personal Knowledge',
        explanation: '"Everyone at Metro knows" is speculation — not personal knowledge. Martinez didn\'t witness the decision being made. He can only testify to what he personally observed. "Everyone knows" = no one actually saw it.',
        distractors: [{ rule: '802', name: 'Hearsay' }, { rule: '701', name: 'Improper Lay Opinion' }, { rule: '611(e)', name: 'Narrative' }]
    },
    {
        num: 5,
        scene: 'Cross-Examination of Dr. Ash Forrester',
        testimony: 'COUNSEL: "Isn\'t Apex Engineering a company with a culture of prioritizing profit over safety? That culture is why we\'re here today."',
        speaker: 'COUNSEL (Plaintiff)',
        correct: '404',
        correctName: 'Improper Character Evidence',
        explanation: 'Asking the jury to infer that because Apex has a "culture" of prioritizing profit (character trait), they must have done so in THIS specific case. That is the propensity inference Rule 404(a) prohibits. You cannot prove action from character.',
        distractors: [{ rule: '403', name: 'Unfair Prejudice' }, { rule: '611(a)', name: 'Argumentative' }, { rule: '602', name: 'Lack of Personal Knowledge' }]
    },
    {
        num: 6,
        scene: 'Direct Examination of Dr. Forrester',
        testimony: 'COUNSEL (Defense): "After the HOA filed suit, Apex changed their internal welding standards for all future projects — doesn\'t that show they take safety seriously?"',
        speaker: 'COUNSEL (Defense)',
        correct: '407',
        correctName: 'Subsequent Remedial Measures',
        explanation: 'Using post-litigation policy changes to show Apex\'s safety-consciousness is exactly what Rule 407 prohibits. Subsequent remedial measures cannot be used to prove culpable conduct — OR to rehabilitate character. The policy: don\'t punish companies for improving.',
        distractors: [{ rule: '403', name: 'Unfair Prejudice' }, { rule: '404', name: 'Character Evidence' }, { rule: '802', name: 'Hearsay' }]
    },
    {
        num: 7,
        scene: 'Direct Examination of Reed Alvarez',
        testimony: '"As a retired attorney and the HOA president, in my professional opinion the bolted connections used in this building were structurally defective."',
        speaker: 'REED ALVAREZ',
        correct: '701',
        correctName: 'Improper Lay Opinion',
        explanation: 'Alvarez is a retired ATTORNEY — not a structural engineer. "Structurally defective" is a technical engineering conclusion requiring specialized knowledge under Rule 702. Being a lawyer or HOA president does not qualify you to render structural engineering opinions.',
        distractors: [{ rule: '602', name: 'Lack of Personal Knowledge' }, { rule: '401', name: 'Relevance' }, { rule: '403', name: 'Unfair Prejudice' }]
    },
    {
        num: 8,
        scene: 'Cross-Examination of Whitley Carter',
        testimony: 'COUNSEL (Plaintiff): "Mr. Carter — so you\'re telling this jury that you personally inspected every single bolt connection in a 30-story building and found nothing wrong? Nothing? Not one single problem?"',
        speaker: 'COUNSEL (Plaintiff)',
        correct: '611(a)',
        correctName: 'Argumentative',
        explanation: 'The escalating tone ("Nothing? Not one single problem?") transforms this from a question into an argument. It\'s not seeking information — it\'s fighting with the witness. The jury can hear the sarcasm. Object immediately: argumentative.',
        distractors: [{ rule: '611(f)', name: 'Asked and Answered' }, { rule: '403', name: 'Unfair Prejudice' }, { rule: '611(c)', name: 'Compound Question' }]
    },
    {
        num: 9,
        scene: 'Direct Examination of Dr. Ellis Chen',
        testimony: 'COUNSEL (Plaintiff): "Dr. Chen, you\'re a wind engineering genius with a perfect publication record — your research has literally saved lives, hasn\'t it?"',
        speaker: 'COUNSEL (Plaintiff)',
        correct: '608',
        correctName: 'Improper Bolstering',
        explanation: 'Defense has not attacked Dr. Chen\'s credibility yet. Calling him a "genius with a perfect publication record" and saying his work "literally saved lives" is pre-emptive bolstering — building up credibility before anyone tried to tear it down. Wait for the attack.',
        distractors: [{ rule: '611(b)', name: 'Leading Question' }, { rule: '401', name: 'Relevance' }, { rule: '403', name: 'Unfair Prejudice' }]
    },
    {
        num: 10,
        scene: 'Cross-Examination of Dr. Hightower',
        testimony: 'COUNSEL (Defense): "Doctor, in your settlement negotiations with Apex last year, didn\'t you agree the structural concerns were overstated?"',
        speaker: 'COUNSEL (Defense)',
        correct: '408',
        correctName: 'Settlement / Compromise',
        explanation: 'This directly uses statements made during settlement negotiations to prove liability — the exact prohibition under Rule 408. The policy is to encourage settlements. If everything said during negotiations can be used as an admission, no one will ever try to resolve disputes.',
        distractors: [{ rule: '802', name: 'Hearsay' }, { rule: '602', name: 'Lack of Personal Knowledge' }, { rule: '403', name: 'Unfair Prejudice' }]
    }
];

let _objDrillState = { idx: 0, score: 0, streak: 0, answered: false, timerInterval: null, timeLeft: 3 };

function initBattleDrillObjRoom() {
    showObjStep('obj-battle-drill-room');
    _objDrillState = { idx: 0, score: 0, streak: 0, answered: false, timerInterval: null, timeLeft: 3 };
    document.getElementById('obj-drill-total').textContent = OBJ_BATTLE_DRILLS.length;
    _loadObjDrill();
    logAction("Battle Drills Started");
}

function _loadObjDrill() {
    stopBattleDrillTimer();
    const drill = OBJ_BATTLE_DRILLS[_objDrillState.idx];
    if (!drill) { _showDrillComplete(); return; }

    _objDrillState.answered = false;

    // Update header
    document.getElementById('obj-drill-num').textContent   = _objDrillState.idx + 1;
    document.getElementById('obj-drill-score').textContent = _objDrillState.score;
    document.getElementById('obj-drill-streak').textContent = _objDrillState.streak;

    // Mastery bar (streak based)
    const fillEl = document.getElementById('obj-drill-mastery-fill');
    if (fillEl) fillEl.style.width = Math.min(100, (_objDrillState.streak / 5) * 100) + '%';

    // Scenario
    const scenBox = document.getElementById('obj-drill-scenario-box');
    const scenText = document.getElementById('obj-drill-scenario-text');
    if (scenBox) scenBox.style.borderColor = 'rgba(255,255,255,0.1)';
    if (scenText) {
        scenText.innerHTML = `<div class="text-[10px] uppercase tracking-widest gold-text font-bold mb-2">${drill.scene}</div>
            <div class="text-[11px] text-muted mb-2">${drill.speaker} testifies:</div>
            <div class="text-base italic leading-relaxed text-white">"${drill.testimony.replace(/^"/, '').replace(/"$/, '')}"</div>`;
    }

    // Feedback / next reset
    const fb   = document.getElementById('obj-drill-feedback');
    const next = document.getElementById('obj-drill-next');
    if (fb)   { fb.classList.add('hidden'); }
    if (next) next.classList.add('hidden');

    // Build buttons — rule family colors
    const familyColorMap = {
        '611': '#38bdf8', '602': '#a78bfa', '701': '#a78bfa', '702': '#a78bfa', '608': '#a78bfa', '609': '#a78bfa',
        '401': '#fbbf24', '403': '#fbbf24', '404': '#fbbf24', '407': '#fbbf24', '408': '#fbbf24',
        '802': '#ef4444', '801': '#ef4444', '803': '#ef4444', '804': '#ef4444', '805': '#ef4444'
    };
    function getColor(r) {
        for (const [prefix, color] of Object.entries(familyColorMap)) {
            if (r.startsWith(prefix)) return color;
        }
        return '#94a3b8';
    }

    const choices = [{ rule: drill.correct, name: drill.correctName }, ...drill.distractors]
        .sort(() => Math.random() - 0.5);

    const btnsDiv = document.getElementById('obj-drill-buttons');
    btnsDiv.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('button');
        const color = getColor(choice.rule);
        btn.className = 'objection-rule-btn';
        btn.style.cssText = `border-color: ${color}55; border-left: 4px solid ${color}; min-height: 60px;`;
        btn.innerHTML = `<span class="font-mono text-xs font-bold" style="color:${color}; flex-shrink:0;">Rule ${choice.rule}</span><span class="text-white/90 text-xs font-semibold">${choice.name}</span>`;
        const fire = (e) => { e.preventDefault(); _answerObjDrill(choice.rule, btn, drill); };
        btn.addEventListener('click', fire);
        btn.addEventListener('touchend', fire);
        btnsDiv.appendChild(btn);
    });

    // Start 3-second countdown
    _startDrillTimer(drill);
}

function _startDrillTimer(drill) {
    _objDrillState.timeLeft = 6;
    const timerEl = document.getElementById('obj-drill-timer');
    const barEl   = document.getElementById('obj-drill-timer-bar');

    if (timerEl) { timerEl.textContent = '6'; timerEl.classList.remove('urgent'); }
    if (barEl)   barEl.style.width = '100%';

    _objDrillState.timerInterval = setInterval(() => {
        _objDrillState.timeLeft--;
        if (timerEl) {
            timerEl.textContent = _objDrillState.timeLeft;
            if (_objDrillState.timeLeft <= 2) timerEl.classList.add('urgent');
            else timerEl.classList.remove('urgent');
        }
        if (barEl) barEl.style.width = ((_objDrillState.timeLeft / 6) * 100) + '%';

        if (_objDrillState.timeLeft <= 0) {
            stopBattleDrillTimer();
            if (!_objDrillState.answered) {
                _showDrillResult(false, null, drill, true);
            }
        }
    }, 1000);
}

function stopBattleDrillTimer() {
    if (_objDrillState.timerInterval) {
        clearInterval(_objDrillState.timerInterval);
        _objDrillState.timerInterval = null;
    }
}

function _answerObjDrill(ruleId, btn, drill) {
    if (_objDrillState.answered) return;
    _objDrillState.answered = true;
    stopBattleDrillTimer();
    const isCorrect = ruleId === drill.correct;
    _showDrillResult(isCorrect, btn, drill, false);
}

function _showDrillResult(isCorrect, btn, drill, timedOut) {
    // Color the buttons
    const btnsDiv = document.getElementById('obj-drill-buttons');
    btnsDiv.querySelectorAll('.objection-rule-btn').forEach(b => {
        const ruleSpan = b.querySelector('span');
        const ruleInBtn = ruleSpan ? ruleSpan.textContent.replace('Rule ', '').trim() : '';
        b.style.opacity = '0.5';
        b.style.pointerEvents = 'none';
        if (ruleInBtn === drill.correct) {
            b.style.opacity = '1';
            b.style.background = 'rgba(34,197,94,0.15)';
            b.style.borderColor = '#22c55e';
        } else if (b === btn && !isCorrect) {
            b.style.background = 'rgba(239,68,68,0.15)';
            b.style.borderColor = '#ef4444';
        }
    });

    // Streak
    if (isCorrect) {
        _objDrillState.score++;
        _objDrillState.streak++;
        recordObjResult(true, drill.correct);
    } else {
        _objDrillState.streak = 0;
        recordObjResult(false, drill.correct);
    }

    document.getElementById('obj-drill-streak').textContent = _objDrillState.streak;
    document.getElementById('obj-drill-score').textContent  = _objDrillState.score;

    // Feedback
    const fb = document.getElementById('obj-drill-feedback');
    if (fb) {
        fb.classList.remove('hidden');
        if (timedOut) {
            fb.className = 'p-4 rounded-xl text-sm mb-4 bg-red-950/35 border border-red-500/25 text-red-200';
            fb.innerHTML = `<span class="font-bold text-red-400">⏰ TOO SLOW!</span> The correct objection was <span class="gold-text font-bold">Rule ${drill.correct} — ${drill.correctName}</span>.<br><span class="text-xs mt-1 block text-white/70">${drill.explanation}</span>`;
        } else if (isCorrect) {
            fb.className = 'p-4 rounded-xl text-sm mb-4 bg-green-950/35 border border-green-500/25 text-green-200';
            fb.innerHTML = `<span class="font-bold text-green-400">✅ SUSTAINED!</span> Rule ${drill.correct} — ${drill.correctName}.<br><span class="text-xs mt-1 block text-white/70">${drill.explanation}</span>`;
        } else {
            fb.className = 'p-4 rounded-xl text-sm mb-4 bg-red-950/35 border border-red-500/25 text-red-200';
            fb.innerHTML = `<span class="font-bold text-red-400">❌ OVERRULED.</span> Correct: <span class="gold-text font-bold">Rule ${drill.correct} — ${drill.correctName}</span>.<br><span class="text-xs mt-1 block text-white/70">${drill.explanation}</span>`;
        }
    }

    // Show next button
    const next = document.getElementById('obj-drill-next');
    if (next) {
        next.classList.remove('hidden');
        next.textContent = (_objDrillState.idx + 1 >= OBJ_BATTLE_DRILLS.length) ? 'SEE RESULTS →' : 'NEXT DRILL →';
    }
}

function nextBattleDrillObjRoom() {
    _objDrillState.idx++;
    if (_objDrillState.idx >= OBJ_BATTLE_DRILLS.length) {
        _showDrillComplete();
    } else {
        _loadObjDrill();
    }
}

function _showDrillComplete() {
    const container = document.getElementById('obj-battle-drill-room');
    const pct = Math.round((_objDrillState.score / OBJ_BATTLE_DRILLS.length) * 100);
    const grade = pct >= 90 ? ['🏆 PARTNER', 'text-yellow-400'] :
                  pct >= 70 ? ['⚖️ ASSOCIATE', 'text-blue-400'] :
                  pct >= 50 ? ['📋 CLERK', 'text-purple-400'] :
                              ['📚 NOVICE — Study the Rule Library', 'text-red-400'];

    const inner = document.createElement('div');
    inner.className = 'max-w-2xl mx-auto mt-6 text-center';
    inner.innerHTML = `
        <div class="glass rounded-2xl p-8">
            <div class="text-6xl mb-4">${pct >= 90 ? '🏆' : pct >= 70 ? '⚖️' : pct >= 50 ? '📋' : '📚'}</div>
            <h3 class="text-3xl font-bold mb-2 ${grade[1]}">${grade[0]}</h3>
            <div class="text-xl text-white mb-1">${_objDrillState.score} / ${OBJ_BATTLE_DRILLS.length} Correct (${pct}%)</div>
            <div class="text-muted text-sm mb-6">Peak Streak: ${ObjMastery.get('streak', 0)}</div>
            <div class="obj-mastery-track mb-6"><div class="obj-mastery-fill" style="width:${pct}%"></div></div>
            <div class="grid grid-cols-2 gap-3">
                <button onclick="initBattleDrillObjRoom()"
                        class="btn-primary py-3 rounded-xl font-bold text-sm" style="touch-action:manipulation;">↺ RETRY</button>
                <button onclick="initObjRuleLibrary()"
                        class="btn-outline py-3 rounded-xl font-bold text-sm" style="touch-action:manipulation;">📚 STUDY RULES</button>
            </div>
            ${pct < 70 ? `<p class="text-xs text-muted mt-4">Tip: Switch to <strong>Passive Learning</strong> mode first — watch the violations before you drill them.</p>` : ''}
        </div>`;

    // Clear existing content and show results
    const backBtn = container.querySelector('button');
    container.innerHTML = '';
    if (backBtn) container.appendChild(backBtn);
    container.appendChild(inner);
    logAction(`Drills Complete: ${pct}%`);
}

// ── PATCH: Wire new initObjectionRoom so the sim steps still work ─────────
// The old startObjectionSim() still works — it calls showStep() which
// we need to alias to showObjStep() for the sim steps.
const _origShowStep = window.showStep;
window.showStep = function(room, stepId) {
    if (room === 'objection-room') {
        showObjStep(stepId);
    } else if (_origShowStep) {
        _origShowStep(room, stepId);
    }
};

// ── PATCH: Wire submitObjection to update streak mastery bar ──────────────
const _origSubmitObj2 = window.submitObjection;
window.submitObjection = function(ruleId) {
    const violation = State.objection.activeViolation;
    const isCorrect = !!(violation && String(violation.ruleNum) === String(ruleId));
    recordObjResult(isCorrect, ruleId);
    if (_origSubmitObj2) _origSubmitObj2(ruleId);
};