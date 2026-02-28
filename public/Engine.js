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
    const qObj = State.witness.bank[State.witness.qIndex];
    appendMessage('bot', qObj.q, 'wit-chat-feed');
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
    clearInterval(State.witness.interval);
    const feed = document.getElementById('wit-chat-feed');
    feed.innerHTML += `<div class="text-center p-8 glass mt-8"><h3 class="text-2xl text-gold mb-2">SESSION ENDED</h3><p class="text-muted">${reason}</p><button class="btn-primary px-8 py-2 rounded-full mt-4" onclick="navigateTo('dashboard')">RETURN HOME</button></div>`;
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

// ========== TRIPLE-LOCK ENGINE ==========
async function handleLawSend() {
    const input = document.getElementById('law-user-msg');
    const q = input.value.trim();
    if (!q) return;

    appendMessage('user', q, 'law-chat-feed');
    input.value = '';
    logAction("Lawyer Question Submitted");

    // --- CROSS-EXAMINATION TRACKER ---
    const wordCount = q.split(/\s+/).length;
    if (wordCount > 15) {
        State.lawyer.controlScore = Math.max(0, State.lawyer.controlScore - 5);
    } else {
        State.lawyer.controlScore = Math.min(100, State.lawyer.controlScore + 2);
    }
    const controlEl = document.getElementById('law-control-score');
    if (controlEl) {
        controlEl.innerText = State.lawyer.controlScore + '%';
        controlEl.style.color = State.lawyer.controlScore > 80 ? '#4ade80' : (State.lawyer.controlScore < 50 ? '#ef4444' : '#d4af37');
    }

    // Get the witness's testimony lines from the patched database
    let textArray = [];
    try {
        const witnessName = State.lawyer.name;
        if (window.MockTrialCaseData && window.MockTrialCaseData.witnesses) {
            textArray = window.MockTrialCaseData.witnesses[witnessName] || [];
        }
    } catch (e) {
        console.warn("Error accessing witness data", e);
    }

    // ----- LOCK 1: PATTERN MATCHER (intro / role) -----
    const lowerQ = q.toLowerCase();
    const roleInfo = window.WitnessRoles[State.lawyer.name];
    
    // Handle greetings and simple intros
    if (lowerQ.match(/^(hi|hello|good morning|good afternoon|good evening)\b/)) {
        return setTimeout(() => appendMessage('bot', "Hello, Counselor.", 'law-chat-feed'), 800);
    }
    if (lowerQ.match(/how are you/)) {
        return setTimeout(() => appendMessage('bot', "I'm doing well, thank you.", 'law-chat-feed'), 800);
    }
    
    // Name / role / job questions – answer from WitnessRoles or first line of testimony
    if (lowerQ.includes('name') || lowerQ.includes('who are you') || lowerQ.includes('your job') || lowerQ.includes('your role')) {
        let answer = '';
        if (roleInfo) {
            answer = `My name is ${State.lawyer.name}. I am the ${roleInfo.title}.`;
        } else if (textArray.length > 0) {
            answer = textArray[0]; // first line usually contains introduction
        } else {
            answer = `My name is ${State.lawyer.name}.`;
        }
        return setTimeout(() => appendMessage('bot', answer, 'law-chat-feed'), 800);
    }

    // ----- PREPARE FOR LOCKS 2 & 3 -----
    if (textArray.length === 0) {
        // No testimony data – fallback
        const fallbacks = [
            "I don't recall that specifically, Counselor.",
            "My affidavit doesn't speak to that.",
            "I don't have that information."
        ];
        return setTimeout(() => appendMessage('bot', fallbacks[Math.floor(Math.random() * fallbacks.length)], 'law-chat-feed'), 800);
    }

    // Tokenizer & stopwords
    const stopwords = new Set(['the','is','in','at','of','on','and','a','an','to','it','for','with','that','this','did','do','you','your','i','me','my','we','our','us','he','him','his','she','her','they','them','their','what','which','who','whom','whose','why','how','where','when','are','were','was','been','have','has','had','will','would','shall','should','may','might','must','can','could']);
    const tokenize = (str) => str.toLowerCase().split(/[\s,\.!?;:()\-]+/).filter(w => w.length >= 2 && !stopwords.has(w));

    // --- SEMANTIC EXPANSION ---
    const expandTokens = (tokens) => {
        let expanded = [...tokens];
        tokens.forEach(t => {
            for (const [key, syns] of Object.entries(SYNONYMS)) {
                if (key === t || syns.includes(t)) {
                    expanded.push(key);
                    expanded.push(...syns);
                }
            }
        });
        return [...new Set(expanded)]; // unique
    };

    const queryTokens = expandTokens(tokenize(q));
    if (queryTokens.length === 0) {
        // If query contains only stopwords, use a simple fallback
        return setTimeout(() => appendMessage('bot', "Could you please rephrase your question?", 'law-chat-feed'), 800);
    }

    // Build TF‑IDF vectors for all lines
    const lines = textArray;
    const allTokens = [];
    lines.forEach((line, idx) => {
        const tokens = tokenize(line); // Don't expand line tokens, only query
        allTokens[idx] = tokens;
    });

    // Compute IDF for each token (across all lines)
    const tokenDocCount = {};
    allTokens.forEach(tokens => {
        const unique = new Set(tokens);
        unique.forEach(tok => tokenDocCount[tok] = (tokenDocCount[tok] || 0) + 1);
    });
    const totalDocs = lines.length;
    const idf = {};
    for (const [tok, count] of Object.entries(tokenDocCount)) {
        idf[tok] = Math.log(totalDocs / count) + 1;  // smooth
    }

    // Compute TF‑IDF vector for query
    const queryVec = {};
    queryTokens.forEach(tok => queryVec[tok] = (queryVec[tok] || 0) + 1);
    // Normalize query vector length
    let queryNorm = 0;
    for (const tok in queryVec) {
        const tf = queryVec[tok] / queryTokens.length;  // term frequency
        const tfidf = tf * (idf[tok] || 1);
        queryVec[tok] = tfidf;
        queryNorm += tfidf * tfidf;
    }
    queryNorm = Math.sqrt(queryNorm);

    // Precompute line vectors
    const lineVectors = lines.map((_, idx) => {
        const tokens = allTokens[idx];
        const vec = {};
        const len = tokens.length;
        tokens.forEach(tok => vec[tok] = (vec[tok] || 0) + 1);
        // Normalize term frequency
        for (const tok in vec) {
            vec[tok] = (vec[tok] / len) * (idf[tok] || 1);
        }
        return vec;
    });

    // ----- LOCK 2: COSINE SIMILARITY -----
    let bestCosine = -1;
    let bestCosineIdx = -1;
    lineVectors.forEach((vec, idx) => {
        let dot = 0, normA = 0, normB = queryNorm;
        for (const tok in queryVec) {
            if (vec[tok]) dot += queryVec[tok] * vec[tok];
        }
        for (const tok in vec) normA += vec[tok] * vec[tok];
        normA = Math.sqrt(normA);
        let sim = (normA && normB) ? dot / (normA * normB) : 0;

        // --- RECENCY PENALTY ---
        if (State.lawyer.usedLines[idx]) {
            sim *= 0.5; // 50% penalty
        }

        // --- LOGIC BUFF (Exact Match) ---
        if (lines[idx].toLowerCase().includes(q.toLowerCase())) {
            sim *= 2.0; // 2x multiplier
        }

        if (sim > bestCosine) {
            bestCosine = sim;
            bestCosineIdx = idx;
        }
    });

    // ----- LOCK 3: FUZZY INCLUSION (simple stemming) -----
    const stem = (word) => word.replace(/(ed|ing|s|es|ly)$/, '');  // crude stemmer
    const queryStems = queryTokens.map(stem);
    let bestFuzzyScore = 0;
    let bestFuzzyIdx = -1;
    lines.forEach((line, idx) => {
        const lineTokens = tokenize(line);
        const lineStems = lineTokens.map(stem);
        let matchCount = 0;
        queryStems.forEach(qs => {
            if (lineStems.some(ls => ls.includes(qs) || qs.includes(ls))) matchCount++;
        });
        let score = matchCount / queryStems.length;

        // --- RECENCY PENALTY (Fuzzy) ---
        if (State.lawyer.usedLines[idx]) {
            score *= 0.5;
        }

        if (score > bestFuzzyScore) {
            bestFuzzyScore = score;
            bestFuzzyIdx = idx;
        }
    });

    // Combine scores: if cosine is decent, use it; otherwise fallback to fuzzy
    const COSINE_THRESHOLD = 0.15;
    let selectedIdx;
    if (bestCosine >= COSINE_THRESHOLD) {
        selectedIdx = bestCosineIdx;
    } else if (bestFuzzyScore > 0.3) {
        selectedIdx = bestFuzzyIdx;
    } else {
        // No good match – random fallback
        const fallbacks = [
            "I'm not sure I follow, Counselor.",
            "Could you rephrase that?",
            "That's not something I can answer from my affidavit."
        ];
        return setTimeout(() => appendMessage('bot', fallbacks[Math.floor(Math.random() * fallbacks.length)], 'law-chat-feed'), 800);
    }

    // Mark line as used
    State.lawyer.usedLines[selectedIdx] = (State.lawyer.usedLines[selectedIdx] || 0) + 1;

    let bestLine = lines[selectedIdx];

    // Add a small prefix based on mode (direct/cross) for realism
    let prefix = "";
    if (State.lawyer.mode === 'cross') {
        const crossPref = ["As I said, ", "Actually, ", "Yes, "];
        prefix = Math.random() > 0.6 ? crossPref[Math.floor(Math.random()*crossPref.length)] : "";
    } else {
        const directPref = ["Certainly. ", "Yes. "];
        prefix = Math.random() > 0.6 ? directPref[Math.floor(Math.random()*directPref.length)] : "";
    }

    setTimeout(() => {
        appendMessage('bot', prefix + bestLine, 'law-chat-feed');
    }, 1000);
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
