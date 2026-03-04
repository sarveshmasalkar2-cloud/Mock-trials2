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