// Render 16 Ledger Rows dynamically on load
document.addEventListener("DOMContentLoaded", function () {
    const tbody = document.getElementById("ledgerTableBody");
    if (tbody) {
        let rowsHtml = "";
        for (let i = 1; i <= 16; i++) {
            rowsHtml += `
                <tr>
                    <td><input type="text" class="name-input" id="ledgerName_${i}" oninput="updateActiveCustomerName(${i}); saveLedger();" onfocus="loadRowToMain(${i})" readonly style="background-color: #e5e7eb;"></td>
                    <td><input type="text" class="readonly-col" id="ledgerDry_${i}" readonly onfocus="loadRowToMain(${i})"></td>
                    <td><input type="text" class="readonly-col" id="ledgerFresh_${i}" readonly onfocus="loadRowToMain(${i})"></td>
                    <td><input type="text" class="readonly-col" id="ledgerCab_${i}" readonly onfocus="loadRowToMain(${i})"></td>
                    <td><input type="text" class="readonly-col" id="ledgerBo_${i}" readonly onfocus="loadRowToMain(${i})"></td>
                    <td><input type="text" class="readonly-col" id="ledgerBal_${i}" readonly onfocus="loadRowToMain(${i})"></td>
                    <td><input type="text" class="readonly-col amount" id="ledgerBilling_${i}" readonly></td>
                    <td><input type="text" class="readonly-col colln-input" id="ledgerPay_${i}" readonly onfocus="loadRowToMain(${i})"></td>
                    <td><input type="text" class="readonly-col amount" id="ledgerRem_${i}" readonly></td>
                </tr>
            `;
        }
        tbody.innerHTML = rowsHtml;
    }
    loadLedger();
});

// PWA Install Prompt Handler
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            document.getElementById('installBtn').style.display = 'none';
        });
    }
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1', { scope: './' })
            .then(reg => console.log('Service Worker Registered!', reg))
            .catch(err => console.log('Service Worker Registration Failed:', err));
    });
}

let activeRow = 1;
let tapCount = 0;
let tapTimer = null;
let isLocked = true;

let priceTapCount = 0;
let priceTapTimer = null;
let isPriceLocked = true;

// SESSION & INACTIVITY TRACKING
let currentSessionDate = "";
let currentSessionName = "";
let modalMode = "OPEN";
let inactivityTimer = null;
let isEditingActive = false;
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        autoSaveAndReset();
    }, INACTIVITY_LIMIT_MS);
}

['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, true);
});

function setEncodingEditable(editable) {
    isEditingActive = editable;
    const inputs = document.querySelectorAll('.main-wrapper input:not(.price-input):not(#modalDateInput):not(#modalNameInput)');
    inputs.forEach(input => {
        if (!input.classList.contains('readonly-col')) {
            input.disabled = !editable;
        }
    });
}

function showOpenModal() {
    modalMode = "OPEN";
    document.getElementById("modalTitle").textContent = "Start New Ledger File";
    document.getElementById("modalSubtext").textContent = "Please fill out both the Date and Name to unlock encoding.";
    document.getElementById("modalActionBtn").textContent = "Open Ledger";
    document.getElementById("modalDateInput").value = "";
    document.getElementById("modalNameInput").value = "";
    document.getElementById("setupModal").style.display = "flex";
}

function openSaveConfirmationModal() {
    if (!currentSessionDate || !currentSessionName) {
        alert("No active session to save. Please start a session first.");
        return;
    }
    modalMode = "SAVE";
    document.getElementById("modalTitle").textContent = "Confirm & Save Ledger File";
    document.getElementById("modalSubtext").textContent = "Review or edit the Date and Name before saving to history.";
    document.getElementById("modalActionBtn").textContent = "Save File";
    document.getElementById("modalDateInput").value = currentSessionDate;
    document.getElementById("modalNameInput").value = currentSessionName;
    document.getElementById("setupModal").style.display = "flex";
}

function calculateLedgerTotals() {
    let sumDry = 0, sumFresh = 0, sumCab = 0, sumBo = 0;
    let sumBal = 0, sumBilling = 0, sumColln = 0, sumRem = 0;

    for (let i = 1; i <= 16; i++) {
        sumDry += parseFloat(document.getElementById(`ledgerDry_${i}`).value) || 0;
        sumFresh += parseFloat(document.getElementById(`ledgerFresh_${i}`).value) || 0;
        sumCab += parseFloat(document.getElementById(`ledgerCab_${i}`).value) || 0;
        sumBo += parseFloat(document.getElementById(`ledgerBo_${i}`).value) || 0;
        sumBal += parseFloat(document.getElementById(`ledgerBal_${i}`).value) || 0;
        
        const billStr = document.getElementById(`ledgerBilling_${i}`).value.replace(/,/g, '');
        sumBilling += parseFloat(billStr) || 0;

        const collnStr = document.getElementById(`ledgerPay_${i}`).value.replace(/,/g, '');
        sumColln += parseFloat(collnStr) || 0;

        const remStr = document.getElementById(`ledgerRem_${i}`).value.replace(/,/g, '');
        sumRem += parseFloat(remStr) || 0;
    }

    document.getElementById("totalDry").textContent = sumDry;
    document.getElementById("totalFresh").textContent = sumFresh;
    document.getElementById("totalCab").textContent = sumCab;
    document.getElementById("totalBo").textContent = sumBo % 1 === 0 ? sumBo : sumBo.toFixed(1);
    document.getElementById("totalBal").textContent = sumBal;
    document.getElementById("totalBilling").textContent = sumBilling;
    document.getElementById("totalColln").textContent = sumColln;
    document.getElementById("totalRem").textContent = sumRem;
}

function saveLedger() {
    if (!currentSessionDate || !currentSessionName || !isEditingActive) return;

    const ledgerData = {
        date: currentSessionDate,
        name: currentSessionName,
        rows: {}
    };

    for (let i = 1; i <= 16; i++) {
        ledgerData.rows[`name_${i}`] = document.getElementById(`ledgerName_${i}`).value;
        ledgerData.rows[`dry_${i}`] = document.getElementById(`ledgerDry_${i}`).value;
        ledgerData.rows[`fresh_${i}`] = document.getElementById(`ledgerFresh_${i}`).value;
        ledgerData.rows[`cab_${i}`] = document.getElementById(`ledgerCab_${i}`).value;
        ledgerData.rows[`bo_${i}`] = document.getElementById(`ledgerBo_${i}`).value;
        ledgerData.rows[`bal_${i}`] = document.getElementById(`ledgerBal_${i}`).value;
        ledgerData.rows[`billing_${i}`] = document.getElementById(`ledgerBilling_${i}`).value;
        ledgerData.rows[`pay_${i}`] = document.getElementById(`ledgerPay_${i}`).value;
        ledgerData.rows[`rem_${i}`] = document.getElementById(`ledgerRem_${i}`).value;
    }

    localStorage.setItem("miki_ledger_data", JSON.stringify(ledgerData));
}

function forceSaveCurrentDay() {
    if (!currentSessionDate || !currentSessionName) return;

    saveLedger();
    const activeDraft = JSON.parse(localStorage.getItem("miki_ledger_data"));
    if (!activeDraft) return;

    let history = JSON.parse(localStorage.getItem("miki_30day_history") || "[]");

    const existingIndex = history.findIndex(item => item.date === activeDraft.date);
    if (existingIndex !== -1) {
        history[existingIndex] = activeDraft;
    } else {
        history.unshift(activeDraft);
    }

    if (history.length > 30) {
        history = history.slice(0, 30);
    }

    localStorage.setItem("miki_30day_history", JSON.stringify(history));
    renderHistoryUI();
}

function loadHistoryFile(dateKey) {
    const history = JSON.parse(localStorage.getItem("miki_30day_history") || "[]");
    const selectedFile = history.find(item => item.date === dateKey);

    if (!selectedFile) return;

    currentSessionDate = selectedFile.date;
    currentSessionName = selectedFile.name;

    document.getElementById("displayFileDate").textContent = "Date: " + currentSessionDate;
    document.getElementById("displayFileName").textContent = currentSessionName;

    for (let i = 1; i <= 16; i++) {
        if(selectedFile.rows[`name_${i}`] !== undefined) document.getElementById(`ledgerName_${i}`).value = selectedFile.rows[`name_${i}`];
        if(selectedFile.rows[`dry_${i}`] !== undefined) document.getElementById(`ledgerDry_${i}`).value = selectedFile.rows[`dry_${i}`];
        if(selectedFile.rows[`fresh_${i}`] !== undefined) document.getElementById(`ledgerFresh_${i}`).value = selectedFile.rows[`fresh_${i}`];
        if(selectedFile.rows[`cab_${i}`] !== undefined) document.getElementById(`ledgerCab_${i}`).value = selectedFile.rows[`cab_${i}`];
        if(selectedFile.rows[`bo_${i}`] !== undefined) document.getElementById(`ledgerBo_${i}`).value = selectedFile.rows[`bo_${i}`];
        if(selectedFile.rows[`bal_${i}`] !== undefined) document.getElementById(`ledgerBal_${i}`).value = selectedFile.rows[`bal_${i}`];
        if(selectedFile.rows[`billing_${i}`] !== undefined) document.getElementById(`ledgerBilling_${i}`).value = selectedFile.rows[`billing_${i}`];
        if(selectedFile.rows[`pay_${i}`] !== undefined) document.getElementById(`ledgerPay_${i}`).value = selectedFile.rows[`pay_${i}`];
        if(selectedFile.rows[`rem_${i}`] !== undefined) document.getElementById(`ledgerRem_${i}`).value = selectedFile.rows[`rem_${i}`];
    }

    document.getElementById("setupModal").style.display = "none";
    setEncodingEditable(true);
    calculateLedgerTotals();
    saveLedger();
    renderHistoryUI(dateKey);
}

function deleteHistoryFile(dateKey) {
    if (confirm(`Delete file for ${dateKey}?`)) {
        let history = JSON.parse(localStorage.getItem("miki_30day_history") || "[]");
        history = history.filter(item => item.date !== dateKey);
        localStorage.setItem("miki_30day_history", JSON.stringify(history));
        renderHistoryUI();
    }
}

function renderHistoryUI(selectedDateKey = null) {
    const historyContainer = document.getElementById("historyContainer");
    const historyCount = document.getElementById("historyCount");
    const history = JSON.parse(localStorage.getItem("miki_30day_history") || "[]");

    historyCount.textContent = `${history.length} / 30`;

    if (history.length === 0) {
        historyContainer.innerHTML = `<p style="color: #9ca3af; text-align: center; margin: 10px 0;">No saved files yet.</p>`;
        return;
    }

    const highlightKey = selectedDateKey || currentSessionDate;

    historyContainer.innerHTML = "";
    history.forEach(item => {
        const div = document.createElement("div");
        const isSelected = item.date === highlightKey;
        div.className = `history-item ${isSelected ? 'selected-file' : ''}`;
        div.innerHTML = `
            <div>
                <strong>${item.date}</strong> - ${item.name}
            </div>
            <div>
                <button class="btn-sm btn-edit" onclick="loadHistoryFile('${item.date}')">Edit</button>
                <button class="btn-sm btn-del" onclick="deleteHistoryFile('${item.date}')">Del</button>
            </div>
        `;
        historyContainer.appendChild(div);
    });
}

function loadLedger() {
    renderHistoryUI();
    const saved = localStorage.getItem("miki_ledger_data");

    if (!saved) {
        setEncodingEditable(false);
        showOpenModal();
        return;
    }

    const ledgerData = JSON.parse(saved);
    if (!ledgerData.date || !ledgerData.name) {
        setEncodingEditable(false);
        showOpenModal();
        return;
    }

    currentSessionDate = ledgerData.date;
    currentSessionName = ledgerData.name;
    document.getElementById("displayFileDate").textContent = "Date: " + currentSessionDate;
    document.getElementById("displayFileName").textContent = currentSessionName;

    for (let i = 1; i <= 16; i++) {
        if(ledgerData.rows[`name_${i}`] !== undefined) document.getElementById(`ledgerName_${i}`).value = ledgerData.rows[`name_${i}`];
        if(ledgerData.rows[`dry_${i}`] !== undefined) document.getElementById(`ledgerDry_${i}`).value = ledgerData.rows[`dry_${i}`];
        if(ledgerData.rows[`fresh_${i}`] !== undefined) document.getElementById(`ledgerFresh_${i}`).value = ledgerData.rows[`fresh_${i}`];
        if(ledgerData.rows[`cab_${i}`] !== undefined) document.getElementById(`ledgerCab_${i}`).value = ledgerData.rows[`cab_${i}`];
        if(ledgerData.rows[`bo_${i}`] !== undefined) document.getElementById(`ledgerBo_${i}`).value = ledgerData.rows[`bo_${i}`];
        if(ledgerData.rows[`bal_${i}`] !== undefined) document.getElementById(`ledgerBal_${i}`).value = ledgerData.rows[`bal_${i}`];
        if(ledgerData.rows[`billing_${i}`] !== undefined) document.getElementById(`ledgerBilling_${i}`).value = ledgerData.rows[`billing_${i}`];
        if(ledgerData.rows[`pay_${i}`] !== undefined) document.getElementById(`ledgerPay_${i}`).value = ledgerData.rows[`pay_${i}`];
        if(ledgerData.rows[`rem_${i}`] !== undefined) document.getElementById(`ledgerRem_${i}`).value = ledgerData.rows[`rem_${i}`];
    }

    document.getElementById("setupModal").style.display = "none";
    setEncodingEditable(true);
    calculateLedgerTotals();
    renderHistoryUI();
    resetInactivityTimer();
}
