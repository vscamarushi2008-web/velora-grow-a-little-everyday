// ==========================================================================
// Velora — BUSINESS LOGIC & STATE MANAGEMENT
// ==========================================================================

// Application State
let state = {
    activeHabits: [],
    history: {},
    settings: {
        name: "friend",
        avatar: "🌸",
        reminders: false,
        reminderTime: "20:00"
    },
    currentTab: "today",
    calendarMonth: new Date()
};

// Notification flag to avoid duplicate triggers
let lastNotificationDate = "";

// Motivational Quotes List
const MOTIVATIONAL_QUOTES = [
    "One small step is enough today.",
    "Progress beats perfection.",
    "Future you will thank you.",
    "Tiny actions create massive change.",
    "Just start. The rest follows.",
    "Consistency is quiet power.",
    "You don't have to be perfect, just consistent.",
    "Keep showing up for yourself.",
    "Focus on the step in front of you.",
    "Every day is a fresh beginning."
];

// Category metadata
const CATEGORIES = {
    dsa: { label: "DSA", emoji: "💻", theme: "dsa-theme" },
    coding: { label: "Coding", emoji: "🚀", theme: "coding-theme" },
    study: { label: "Study", emoji: "📚", theme: "study-theme" },
    reading: { label: "Reading", emoji: "📖", theme: "reading-theme" },
    fitness: { label: "Fitness", emoji: "🏃", theme: "fitness-theme" },
    personal: { label: "Personal", emoji: "🎯", theme: "personal-theme" }
};

// ==========================================================================
// DATE HELPERS
// ==========================================================================
function getLocalDateString(date = new Date()) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

function getOffsetDate(dateStr, offsetDays) {
    const date = new Date(dateStr + "T00:00:00");
    date.setDate(date.getDate() + offsetDays);
    return getLocalDateString(date);
}

function formatPrettyDate(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ==========================================================================
// STATE PERSISTENCE & INITIALIZATION
// ==========================================================================
function loadState() {
    try {
        const localActive = localStorage.getItem("Velora_active_habits");
        const localHistory = localStorage.getItem("Velora_history");
        const localSettings = localStorage.getItem("Velora_settings");

        if (localActive && localHistory) {
            state.activeHabits = JSON.parse(localActive);
            state.history = JSON.parse(localHistory);
            if (localSettings) {
                state.settings = { ...state.settings, ...JSON.parse(localSettings) };
            }
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error loading local storage state:", e);
        return false;
    }
}

function saveState() {
    try {
        localStorage.setItem("Velora_active_habits", JSON.stringify(state.activeHabits));
        localStorage.setItem("Velora_history", JSON.stringify(state.history));
        localStorage.setItem("Velora_settings", JSON.stringify(state.settings));
    } catch (e) {
        console.error("Error saving state to local storage:", e);
    }
}

function initFirstLaunch() {

    // No default habits
    state.activeHabits = [];

    // Initialize empty history for today
    const todayStr = getLocalDateString();

    state.history[todayStr] = {
        date: todayStr,
        tasks: []
    };

    localStorage.setItem("velora_first_launch", "true");
    saveState();
}

// Check if day changed, initialize today's habits
function checkDayTransition() {
    const todayStr = getLocalDateString();
    if (!state.history[todayStr]) {
        state.history[todayStr] = {
            date: todayStr,
            tasks: state.activeHabits.map(h => ({ ...h, completed: false }))
        };
        saveState();
    }
}

// ==========================================================================
// STREAK & ANALYTICS CALCULATOR
// ==========================================================================

// A date is completed if it has tasks and all are completed
function isDateCompleted(dateStr) {
    const entry = state.history[dateStr];
    if (!entry || entry.tasks.length === 0) return false;
    return entry.tasks.every(t => t.completed);
}

// Dynamic Streak Calculator
function calculateStreaks() {
    const todayStr = getLocalDateString();
    const yesterdayStr = getOffsetDate(todayStr, -1);

    // Sort all history dates chronologically
    const historyDates = Object.keys(state.history).sort();

    let currentStreak = 0;
    let bestStreak = 0;
    let runningStreak = 0;

    // Calculate best streak historically
    historyDates.forEach(dateStr => {
        const entry = state.history[dateStr];
        if (entry.tasks.length === 0) return; // Skip days with no tasks

        if (entry.tasks.every(t => t.completed)) {
            runningStreak++;
            bestStreak = Math.max(bestStreak, runningStreak);
        } else {
            runningStreak = 0;
        }
    });

    // Calculate current streak ending today or yesterday
    if (isDateCompleted(todayStr)) {
        currentStreak = 1;
        let checkDate = yesterdayStr;
        while (isDateCompleted(checkDate)) {
            currentStreak++;
            checkDate = getOffsetDate(checkDate, -1);
        }
    } else if (isDateCompleted(yesterdayStr)) {
        // Today is not yet completed, but yesterday was. Streak is still alive today!
        currentStreak = 1;
        let checkDate = getOffsetDate(yesterdayStr, -1);
        while (isDateCompleted(checkDate)) {
            currentStreak++;
            checkDate = getOffsetDate(checkDate, -1);
        }
    } else {
        currentStreak = 0;
    }

    return { currentStreak, bestStreak };
}

// Calculate Statistics
function getStats() {
    const historyDates = Object.keys(state.history);
    let totalCompletedTasks = 0;
    let totalAssignedTasks = 0;

    historyDates.forEach(dStr => {
        const tasks = state.history[dStr].tasks;
        tasks.forEach(t => {
            totalAssignedTasks++;
            if (t.completed) totalCompletedTasks++;
        });
    });

    // Weekly completion rate (last 7 days including today)
    const todayStr = getLocalDateString();
    let weekAssigned = 0;
    let weekCompleted = 0;
    for (let i = 0; i < 7; i++) {
        const dStr = getOffsetDate(todayStr, -i);
        const entry = state.history[dStr];
        if (entry) {
            entry.tasks.forEach(t => {
                weekAssigned++;
                if (t.completed) weekCompleted++;
            });
        }
    }
    const weeklyRate = weekAssigned === 0 ? 0 : Math.round((weekCompleted / weekAssigned) * 100);

    // Monthly completion rate (last 30 days including today)
    let monthAssigned = 0;
    let monthCompleted = 0;
    for (let i = 0; i < 30; i++) {
        const dStr = getOffsetDate(todayStr, -i);
        const entry = state.history[dStr];
        if (entry) {
            entry.tasks.forEach(t => {
                monthAssigned++;
                if (t.completed) monthCompleted++;
            });
        }
    }
    const monthlyRate = monthAssigned === 0 ? 0 : Math.round((monthCompleted / monthAssigned) * 100);

    // Category breakdown
    const categoryStats = {
        dsa: { completed: 0, total: 0 },
        coding: { completed: 0, total: 0 },
        study: { completed: 0, total: 0 },
        reading: { completed: 0, total: 0 },
        fitness: { completed: 0, total: 0 },
        personal: { completed: 0, total: 0 }
    };

    historyDates.forEach(dStr => {
        const tasks = state.history[dStr].tasks;
        tasks.forEach(t => {
            if (categoryStats[t.category]) {
                categoryStats[t.category].total++;
                if (t.completed) categoryStats[t.category].completed++;
            }
        });
    });

    return {
        totalCompletedTasks,
        weeklyRate,
        monthlyRate,
        categoryStats
    };
}

// ==========================================================================
// CONFETTI CELEBRATION
// ==========================================================================
function triggerConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");

    // Resize to container size
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const colors = ["#8B7CF8", "#B8AEFF", "#FFD6E8", "#B7F5C5", "#FF9ECA", "#FFEDD5"];
    const particles = [];
    const particleCount = 75;

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 60,
            y: canvas.height - 80, // Shoot from above bottom menu
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 12 - 6,
            size: Math.random() * 6 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            opacity: 1
        });
    }

    let animationId;
    function updateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            if (p.opacity > 0) {
                active = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35; // Gravity
                p.vx *= 0.98; // Friction
                p.rotation += p.rotationSpeed;
                p.opacity -= 0.015;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        });

        if (active) {
            animationId = requestAnimationFrame(updateParticles);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    updateParticles();
}

// ==========================================================================
// TOAST & WEB NOTIFICATION ENGINE
// ==========================================================================
function showToast(title, body) {
    const toast = document.getElementById("toast-notification");
    document.getElementById("toast-title").innerText = title;
    document.getElementById("toast-body").innerText = body;

    toast.classList.add("show");

    // Play subtle soft notification chime in code if browser allows
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        // Cute chime: C6 followed by E6 quickly
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime); // C6
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.1); // E6
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) { }

    setTimeout(() => {
        toast.classList.remove("show");
    }, 4500);
}

function sendNotification(title, body) {
    // 1. Show dynamic in-app toast
    showToast(title, body);

    // 2. Try browser-native notification API
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: "assets/icon-192.png"
        });
    }
}

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

// Periodic check for notifications
function runNotificationScheduler() {
    if (!state.settings.reminders) return;

    const now = new Date();
    const currentHourMin = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
    const todayStr = getLocalDateString(now);

    if (currentHourMin === state.settings.reminderTime && lastNotificationDate !== todayStr) {
        // Send daily reminder
        const reminders = [
            "Keep your streak alive today. 🔥",
            "Tiny progress is still progress. 🌸",
            "One task today is enough. ✨",
            "Take 5 minutes for your habits. 🌱"
        ];
        const randomBody = reminders[Math.floor(Math.random() * reminders.length)];
        sendNotification("velora Reminder", randomBody);

        lastNotificationDate = todayStr;
    }
}

// ==========================================================================
// DYNAMIC UI RENDERING
// ==========================================================================

// Render Time-based Greeting
function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = "Good Morning ☀️";

    if (hour >= 12 && hour < 17) {
        greeting = "Good Afternoon 🌸";
    } else if (hour >= 17 || hour < 5) {
        greeting = "Good Evening 🌙";
    }

    document.getElementById("greeting-text").innerText = greeting;
    document.getElementById("user-display-name").innerText = state.settings.name;
    document.getElementById("avatar-btn").innerText = state.settings.avatar;
}

// --------------------------------------------------------------------------
// 1. TODAY PAGE RENDERER
// --------------------------------------------------------------------------
function renderToday() {
    const todayStr = getLocalDateString();
    checkDayTransition();

    const todayEntry = state.history[todayStr];
    const { currentStreak, bestStreak } = calculateStreaks();

    // A. Update Streaks Card
    document.getElementById("today-streak-display").innerText = `${currentStreak} Day Streak`;
    document.getElementById("best-streak-display").innerText = bestStreak;

    const subtitleEl = document.getElementById("streak-quote");
    if (currentStreak === 0) {
        subtitleEl.innerText = "Start fresh today! ✨";
    } else if (currentStreak > 0 && todayEntry.tasks.every(t => t.completed) && todayEntry.tasks.length > 0) {
        subtitleEl.innerText = "Today's goals cleared! 🎉";
    } else {
        subtitleEl.innerText = "Keep showing up.";
    }

    // B. Update Progress Card
    const totalTasks = todayEntry.tasks.length;
    const completedTasks = todayEntry.tasks.filter(t => t.completed).length;
    const pct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    document.getElementById("progress-fraction").innerText = `${completedTasks} / ${totalTasks} Completed`;
    document.getElementById("progress-bar-fill").style.width = `${pct}%`;

    const progressMsg = document.getElementById("progress-message");
    if (totalTasks === 0) {
        progressMsg.innerText = "Add a habit to get started!";
    } else if (pct === 100) {
        progressMsg.innerText = "Perfect day! You are amazing! 🌸";
    } else if (pct >= 50) {
        progressMsg.innerText = "More than halfway done! Keep going!";
    } else if (completedTasks > 0) {
        progressMsg.innerText = "Great start. One step at a time.";
    } else {
        progressMsg.innerText = "Let's complete one goal today.";
    }

    // C. Daily Quote Seeded
    const quoteIndex = todayStr.split("-").reduce((acc, c) => acc + parseInt(c), 0) % MOTIVATIONAL_QUOTES.length;
    document.getElementById("motivation-quote").innerText = `"${MOTIVATIONAL_QUOTES[quoteIndex]}"`;

    // D. Render Date Header
    document.getElementById("current-date-text").innerText = formatPrettyDate(todayStr);

    // E. Task List
    const tasksContainer = document.getElementById("tasks-list-container");
    tasksContainer.innerHTML = "";

    if (totalTasks === 0) {
        // Beautiful Empty State
        tasksContainer.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🌸</span>
                <h3 class="empty-title">No tasks yet</h3>
                <p class="empty-body">Add one small goal and start building Velora.</p>
            </div>
        `;
        return;
    }

    todayEntry.tasks.forEach(task => {
        const isComp = task.completed ? "completed" : "";
        const catObj = CATEGORIES[task.category] || CATEGORIES.personal;

        const durationTag = task.duration
            ? `<span class="duration-tag"><i data-lucide="clock"></i> ${task.duration} min</span>`
            : "";

        const card = document.createElement("div");
        card.className = `task-card ${isComp} ${task.category}`;
        card.setAttribute("data-id", task.id);

        card.innerHTML = `
            <div class="category-indicator"></div>
            <div class="checkbox-wrapper">
                <div class="custom-checkbox">
                    <i data-lucide="check"></i>
                </div>
            </div>
            <div class="task-info">
                <span class="task-title">${task.name}</span>
                <div class="task-meta">
                    <span class="category-badge ${catObj.theme}">${catObj.emoji} ${catObj.label}</span>
                    ${durationTag}
                </div>
            </div>
        `;

        // Task Click Action
        card.addEventListener("click", () => {
            toggleTaskCompletion(task.id);
        });

        tasksContainer.appendChild(card);
    });

    lucide.createIcons();
}

function toggleTaskCompletion(taskId) {
    const todayStr = getLocalDateString();
    const todayEntry = state.history[todayStr];
    if (!todayEntry) return;

    const task = todayEntry.tasks.find(t => t.id === taskId);
    if (task) {
        const oldState = task.completed;
        task.completed = !task.completed;

        // Dynamic confetti on perfect day completion
        const allCompletedNow = todayEntry.tasks.every(t => t.completed);
        const previouslyAllCompleted = todayEntry.tasks.every(t => t.id === taskId ? oldState : t.completed);

        if (!previouslyAllCompleted && allCompletedNow) {
            triggerConfetti();
            // Tiny delay before toast so they enjoy visual fireworks
            setTimeout(() => {
                sendNotification("Goal Accomplished! 🎉", "Perfect consistency day achieved! Keep shining!");
            }, 500);
        } else if (!oldState) {
            // Task check chime / tick vibration feel
            triggerMiniHaptic();
        }

        saveState();
        renderToday();
    }
}

function triggerMiniHaptic() {
    if ("vibrate" in navigator) {
        navigator.vibrate(15);
    }
}

// --------------------------------------------------------------------------
// 2. CALENDAR PAGE RENDERER
// --------------------------------------------------------------------------
function renderCalendar() {
    const container = document.getElementById("calendar-days-grid");
    container.innerHTML = "";

    const activeYear = state.calendarMonth.getFullYear();
    const activeMonth = state.calendarMonth.getMonth(); // 0-indexed

    // Set Month Year Title
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("calendar-month-year-display").innerText = `${monthNames[activeMonth]} ${activeYear}`;

    // Get First Day of Month Index (Monday = 0 ... Sunday = 6)
    // Date(year, month, 1) gets first day
    let firstDay = new Date(activeYear, activeMonth, 1).getDay();
    // JS days: 0 = Sun, 1 = Mon ... 6 = Sat. Shift so Mon = 0, Sun = 6
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;

    // Get total days in viewed month
    let totalDays = new Date(activeYear, activeMonth + 1, 0).getDate();

    // Render Blank Cells for alignment
    for (let i = 0; i < startOffset; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day-cell empty";
        container.appendChild(emptyCell);
    }

    const todayStr = getLocalDateString();

    // Render Month Day cells
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell";
        cell.innerText = dayNum;

        // Construct Date String
        const monthPad = String(activeMonth + 1).padStart(2, "0");
        const dayPad = String(dayNum).padStart(2, "0");
        const cellDateStr = `${activeYear}-${monthPad}-${dayPad}`;

        // Add today outline style
        if (cellDateStr === todayStr) {
            cell.classList.add("today");
        }

        // Add Completion Status
        const dayEntry = state.history[cellDateStr];
        if (dayEntry && dayEntry.tasks.length > 0) {
            const allDone = dayEntry.tasks.every(t => t.completed);

            if (allDone) {
                cell.classList.add("status-completed");
                cell.classList.add("has-streak");
            } else {
                // If it is a past day, flag as missed
                if (cellDateStr < todayStr) {
                    cell.classList.add("status-missed");
                } else {
                    cell.classList.add("status-none");
                }
            }
        } else {
            // Check if day is past but has no records. If activeHabits is non-empty, 
            // and it is prior to habit creation date, we do not mark as missed.
            if (cellDateStr < todayStr) {
                cell.classList.add("status-missed");
            } else {
                cell.classList.add("status-none");
            }
        }

        container.appendChild(cell);
    }
}

// --------------------------------------------------------------------------
// 3. STATISTICS PAGE RENDERER
// --------------------------------------------------------------------------
function renderStats() {
    const { currentStreak, bestStreak } = calculateStreaks();
    const stats = getStats();

    // A. Values
    document.getElementById("stats-current-streak").innerText = currentStreak;
    document.getElementById("stats-best-streak").innerText = bestStreak;
    document.getElementById("stats-total-completed").innerText = stats.totalCompletedTasks;

    // B. Circular Gauges
    // Stroke dasharray formula: pct * 100 / 100
    // Total perimeter is 100 (for simplicity, our SVGs are scaled that way)
    document.getElementById("stats-monthly-percent").innerText = `${stats.monthlyRate}%`;
    document.getElementById("stats-monthly-ring").style.strokeDasharray = `${stats.monthlyRate}, 100`;

    document.getElementById("stats-weekly-percent").innerText = `${stats.weeklyRate}%`;
    document.getElementById("stats-weekly-ring").style.strokeDasharray = `${stats.weeklyRate}, 100`;

    // C. Weekly Consistency Bar Chart
    const barChartContainer = document.getElementById("weekly-bar-chart");
    barChartContainer.innerHTML = "";

    const todayStr = getLocalDateString();
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Render last 7 days starting from 6 days ago up to today
    for (let i = 6; i >= 0; i--) {
        const dStr = getOffsetDate(todayStr, -i);
        const dayDate = new Date(dStr + "T00:00:00");
        const dayName = dayLabels[dayDate.getDay()];
        const dayNum = dayDate.getDate();

        const entry = state.history[dStr];
        let pct = 0;
        if (entry && entry.tasks.length > 0) {
            const completed = entry.tasks.filter(t => t.completed).length;
            pct = Math.round((completed / entry.tasks.length) * 100);
        }

        const barWrapper = document.createElement("div");
        barWrapper.className = "bar-wrapper";
        barWrapper.innerHTML = `
            <div class="bar-track" title="${pct}% Completed">
                <div class="bar-fill" style="height: ${pct}%"></div>
            </div>
            <span class="bar-day">${dayName}</span>
        `;
        barChartContainer.appendChild(barWrapper);
    }

    // D. Category Breakdown Progress Bars
    const breakdownContainer = document.getElementById("category-breakdown-container");
    breakdownContainer.innerHTML = "";

    Object.keys(CATEGORIES).forEach(catKey => {
        const catMeta = CATEGORIES[catKey];
        const catData = stats.categoryStats[catKey] || { completed: 0, total: 0 };
        const pct = catData.total === 0 ? 0 : Math.round((catData.completed / catData.total) * 100);

        // Fetch primary CSS theme variables dynamically
        let catColor = "#8B7CF8";
        if (catKey === "dsa") catColor = "#4F46E5";
        else if (catKey === "coding") catColor = "#EA580C";
        else if (catKey === "study") catColor = "#0891B2";
        else if (catKey === "reading") catColor = "#DB2777";
        else if (catKey === "fitness") catColor = "#16A34A";
        else if (catKey === "personal") catColor = "#E11D48";

        const row = document.createElement("div");
        row.className = "breakdown-row";
        row.innerHTML = `
            <div class="breakdown-meta">
                <span class="breakdown-label">${catMeta.emoji} ${catMeta.label}</span>
                <span class="breakdown-pct">${pct}% (${catData.completed}/${catData.total})</span>
            </div>
            <div class="breakdown-bar-bg">
                <div class="breakdown-bar-fill" style="width: ${pct}%; background-color: ${catColor}"></div>
            </div>
        `;
        breakdownContainer.appendChild(row);
    });
}

// --------------------------------------------------------------------------
// 4. SETTINGS PAGE RENDERER
// --------------------------------------------------------------------------
function renderSettings() {
    // Fill basic form inputs
    document.getElementById("settings-name-input").value = state.settings.name;
    document.getElementById("settings-avatar-select").value = state.settings.avatar;
    document.getElementById("settings-reminder-toggle").checked = state.settings.reminders;
    document.getElementById("settings-reminder-time").value = state.settings.reminderTime;

    // Toggle reminder field visibility
    const timeSetting = document.getElementById("reminder-time-setting");
    const testSetting = document.getElementById("reminder-test-setting");
    if (state.settings.reminders) {
        timeSetting.style.display = "flex";
        testSetting.style.display = "flex";
    } else {
        timeSetting.style.display = "none";
        testSetting.style.display = "none";
    }

    // Render active habits manager list
    const habitManagerContainer = document.getElementById("settings-habits-list");
    habitManagerContainer.innerHTML = "";

    if (state.activeHabits.length === 0) {
        habitManagerContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size:12px;">No active habits configured.</div>`;
        return;
    }

    state.activeHabits.forEach(habit => {
        const catMeta = CATEGORIES[habit.category] || CATEGORIES.personal;

        const durationInfo = habit.duration ? `(${habit.duration} min)` : "";

        const item = document.createElement("div");
        item.className = "settings-habit-item";
        item.innerHTML = `
            <div class="settings-habit-item-info">
                <span class="settings-habit-emoji">${catMeta.emoji}</span>
                <span class="settings-habit-name">${habit.name} ${durationInfo}</span>
            </div>
            <button class="settings-habit-delete" data-id="${habit.id}" title="Remove Goal">
                <i data-lucide="trash-2"></i>
            </button>
        `;

        // Handle delete habit action
        item.querySelector(".settings-habit-delete").addEventListener("click", (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            showConfirmDialog(
                "Delete Goal?",
                "This removes the goal from future lists. Historical completions will remain saved.",
                () => deleteHabit(id)
            );
        });

        habitManagerContainer.appendChild(item);
    });

    lucide.createIcons();
}

function deleteHabit(habitId) {
    // 1. Remove from active habits
    state.activeHabits = state.activeHabits.filter(h => h.id !== habitId);

    // 2. Remove from today's list if not yet completed (for convenience)
    const todayStr = getLocalDateString();
    const todayEntry = state.history[todayStr];
    if (todayEntry) {
        todayEntry.tasks = todayEntry.tasks.filter(t => t.id !== habitId);
    }

    saveState();
    renderSettings();
    showToast("Goal Deleted", "Future trackers will reflect this change.");
}

// ==========================================================================
// DIALOG SYSTEMS
// ==========================================================================
let confirmCallback = null;

function showConfirmDialog(title, message, onConfirm) {
    const dialog = document.getElementById("confirm-dialog");
    document.getElementById("confirm-dialog-title").innerText = title;
    document.getElementById("confirm-dialog-message").innerText = message;

    confirmCallback = onConfirm;
    dialog.classList.add("open");
}

function closeConfirmDialog() {
    document.getElementById("confirm-dialog").classList.remove("open");
    confirmCallback = null;
}

// ==========================================================================
// TABS NAVIGATION CONTROLLER
// ==========================================================================
function switchTab(tabId) {
    // Update State
    state.currentTab = tabId;

    // Toggle Nav items styling
    document.querySelectorAll(".nav-item").forEach(item => {
        if (item.getAttribute("data-tab") === tabId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Toggle Visible Page layout
    document.querySelectorAll(".page").forEach(page => {
        if (page.getAttribute("id") === `page-${tabId}`) {
            page.classList.add("active");
        } else {
            page.classList.remove("active");
        }
    });

    // Page Specific Renders
    if (tabId === "today") {
        renderToday();
    } else if (tabId === "calendar") {
        renderCalendar();
    } else if (tabId === "stats") {
        renderStats();
    } else if (tabId === "settings") {
        renderSettings();
    }
}

// ==========================================================================
// EVENT LISTENERS & FORM HANDLERS
// ==========================================================================

// Add Goal Bottom Sheet controls
const addTaskSheet = document.getElementById("add-task-sheet");
const addForm = document.getElementById("add-task-form");

function openAddTaskSheet() {
    addTaskSheet.classList.add("open");
}

function closeAddTaskSheet() {
    addTaskSheet.classList.remove("open");
    addForm.reset();
}

// Handle Task Submission Form
addForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("task-name-input").value.trim();
    const category = document.querySelector('input[name="task-category"]:checked').value;
    const durationVal = document.getElementById("task-duration-input").value;
    const duration = durationVal ? parseInt(durationVal) : null;

    if (!name) return;

    // Create unique Habit object
    const newHabit = {
        id: `habit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: name,
        category: category,
        duration: duration,
        createdAt: new Date().toISOString()
    };

    // 1. Add to master list
    state.activeHabits.push(newHabit);

    // 2. Add to today's active tracker list
    const todayStr = getLocalDateString();
    checkDayTransition();
    state.history[todayStr].tasks.push({ ...newHabit, completed: false });

    // 3. Save, close & refresh
    saveState();
    closeAddTaskSheet();

    // Jump back to Today page to see the newly created habit immediately
    switchTab("today");

    showToast("Goal Added!", "Your daily tracker has been updated.");
});

// Settings update listeners
document.getElementById("settings-name-input").addEventListener("input", (e) => {
    state.settings.name = e.target.value.trim() || "friend";
    saveState();
    updateGreeting();
});

document.getElementById("settings-avatar-select").addEventListener("change", (e) => {
    state.settings.avatar = e.target.value;
    saveState();
    updateGreeting();
});

document.getElementById("settings-reminder-toggle").addEventListener("change", (e) => {
    state.settings.reminders = e.target.checked;

    if (state.settings.reminders) {
        requestNotificationPermission();
    }

    saveState();
    renderSettings();
});

document.getElementById("settings-reminder-time").addEventListener("change", (e) => {
    state.settings.reminderTime = e.target.value;
    saveState();
});

// Notification Test Action button
document.getElementById("test-notification-btn").addEventListener("click", () => {
    sendNotification("Velora Test", "Consistency brings success! Keep going! 🌸");
});

// Danger Zone Reset All Data
document.getElementById("reset-data-btn").addEventListener("click", () => {
    showConfirmDialog(
        "Permanently Reset Everything?",
        "This completely wipes all streaks, habits, settings, and historical completion logs. There is no undo.",
        () => {
            localStorage.clear();
            state.activeHabits = [];
            state.history = {};
            state.settings = {
                name: "friend",
                avatar: "🌸",
                reminders: false,
                reminderTime: "20:00"
            };
            initFirstLaunch();
            closeConfirmDialog();
            switchTab("today");
            showToast("System Reset", "All data successfully cleaned.");
        }
    );
});

// Dialog buttons actions
document.getElementById("confirm-cancel-btn").addEventListener("click", closeConfirmDialog);
document.getElementById("confirm-action-btn").addEventListener("click", () => {
    if (confirmCallback) confirmCallback();
    closeConfirmDialog();
});

// Page setup bindings
document.querySelectorAll(".nav-item").forEach(item => {
    const tab = item.getAttribute("data-tab");
    if (tab) {
        item.addEventListener("click", () => switchTab(tab));
    }
});

// Floating Action Button FAB click trigger
document.getElementById("fab-add-task").addEventListener("click", openAddTaskSheet);
document.getElementById("quick-add-btn").addEventListener("click", openAddTaskSheet);
document.getElementById("sheet-close-btn").addEventListener("click", closeAddTaskSheet);
document.getElementById("sheet-backdrop").addEventListener("click", closeAddTaskSheet);

// Calendar Navigation actions
document.getElementById("prev-month-btn").addEventListener("click", () => {
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() - 1);
    renderCalendar();
});
document.getElementById("next-month-btn").addEventListener("click", () => {
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() + 1);
    renderCalendar();
});

// ==========================================================================
// CORE APP LAUNCH SEQUENCE
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
    // 1. Initial State Setup
    const loaded = loadState();
    if (!loaded) {
        initFirstLaunch();
    } else {
        checkDayTransition();
    }

    // 2. Setup greeting UI
    updateGreeting();

    // 3. Render Initial tab (Today view)
    switchTab("today");

    // 4. Request Notifications
    if (state.settings.reminders) {
        requestNotificationPermission();
    }

    // 5. Start notification time tracker polling loops (run every 30s)
    setInterval(runNotificationScheduler, 30000);

    // 6. Register Service Worker for PWA / Offline support
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js")
            .then(() => console.log("Velora Service Worker Registered"))
            .catch(err => console.warn("Service Worker registration failed:", err));
    }
});
