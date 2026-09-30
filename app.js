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

function autoSaveAndReset() {
    if (currentSessionDate && currentSessionName) {
        saveLedger();
        forceSaveCurrentDay();
    }
    setEncodingEditable(false);
    showOpenModal();
}

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

function closeSetupModal() {
    document.getElementById("setupModal").style.display = "none";
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

function handleModalSubmit() {
    const dateVal = document.getElementById("modalDateInput").value;
    const nameVal = document.getElementById("modalNameInput").value.trim();

    if (!dateVal || !nameVal) {
        alert("Please select both Date and Route / Salesman Name.");
        return;
    }

    if (modalMode === "OPEN") {
        currentSessionDate = dateVal;
        currentSessionName = nameVal;
        document.getElementById("displayFileDate").textContent = "Date: " + currentSessionDate;
        document.getElementById("displayFileName").textContent = currentSessionName;

        document.getElementById("setupModal").style.display = "none";
        setEncodingEditable(true);
        loadRowToMain(1);
        saveLedger();
        resetInactivityTimer();
    } else if (modalMode === "SAVE") {
        currentSessionDate = dateVal;
        currentSessionName = nameVal;
        document.getElementById("displayFileDate").textContent = "Date: " + currentSessionDate;
        document.getElementById("displayFileName").textContent = currentSessionName;

        forceSaveCurrentDay();
        document.getElementById("setupModal").style.display = "none";
        alert("File successfully saved to 30-Day History!");
    }
}

function promptNewFile() {
    if (confirm("Start a new day ledger file? Current active file will be auto-saved.")) {
        forceSaveCurrentDay();
        clearAllLedgerInputs();
        showOpenModal();
    }
}

function clearAllLedgerInputs() {
    for (let i = 1; i <= 16; i++) {
        document.getElementById(`ledgerName_${i}`).value = "";
        document.getElementById(`ledgerDry_${i}`).value = "";
        document.getElementById(`ledgerFresh_${i}`).value = "";
        document.getElementById(`ledgerCab_${i}`).value = "";
        document.getElementById(`ledgerBo_${i}`).value = "";
        document.getElementById(`ledgerBal_${i}`).value = "";
        document.getElementById(`ledgerBilling_${i}`).value = "";
        document.getElementById(`ledgerPay_${i}`).value = "";
        document.getElementById(`ledgerRem_${i}`).value = "";
    }
    clearMainInputs();
    calculateLedgerTotals();
}

function clearMainInputs() {
    document.getElementById("qtyReg").value = "";
    document.getElementById("qtyFresh").value = "";
    document.getElementById("qtyCab").value = "";
    document.getElementById("qtyBo").value = "";
    document.getElementById("inputBal").value = "";
    document.getElementById("inputPay").value = "";
    document.getElementById("syncDry").value = "";
    document.getElementById("syncFresh").value = "";
    document.getElementById("syncCab").value = "";
    document.getElementById("syncBo").value = "";
    calculateMain();
}

function formatMoney(num) {
    if (isNaN(num) || num === 0) return "0";
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function calculateMain() {
    const qtyReg = parseFloat(document.getElementById("qtyReg").value) || 0;
    const priceReg = parseFloat(document.getElementById("priceReg").value) || 0;
    const amountReg = qtyReg * priceReg;
    document.getElementById("amountReg").textContent = formatMoney(amountReg);

    const qtyFresh = parseFloat(document.getElementById("qtyFresh").value) || 0;
    const priceFresh = parseFloat(document.getElementById("priceFresh").value) || 0;
    const amountFresh = qtyFresh * priceFresh;
    document.getElementById("amountFresh").textContent = formatMoney(amountFresh);

    const qtyCab = parseFloat(document.getElementById("qtyCab").value) || 0;
    const priceCab = parseFloat(document.getElementById("priceCab").value) || 0;
    const amountCab = qtyCab * priceCab;
    document.getElementById("amountCab").textContent = formatMoney(amountCab);

    const qtyBo = parseFloat(document.getElementById("qtyBo").value) || 0;
    const priceBo = parseFloat(document.getElementById("priceBo").value) || 0;
    const amountBo = qtyBo * priceBo;
    document.getElementById("amountBo").textContent = formatMoney(amountBo);

    const totalAmount = amountReg + amountFresh + amountCab + amountBo;
    document.getElementById("totalAmount").textContent = formatMoney(totalAmount);

    const bal = parseFloat(document.getElementById("inputBal").value) || 0;
    const pay = parseFloat(document.getElementById("inputPay").value) || 0;
    const netTotal = totalAmount + bal - pay;
    document.getElementById("netTotalAmount").textContent = formatMoney(netTotal);

    // Sync back to active row in ledger table
    if (activeRow >= 1 && activeRow <= 16) {
        document.getElementById(`ledgerDry_${activeRow}`).value = qtyReg || "";
        document.getElementById(`ledgerFresh_${activeRow}`).value = qtyFresh || "";
        document.getElementById(`ledgerCab_${activeRow}`).value = qtyCab || "";
        document.getElementById(`ledgerBo_${activeRow}`).value = qtyBo || "";
        document.getElementById(`ledgerBal_${activeRow}`).value = bal || "";
        document.getElementById(`ledgerBilling_${activeRow}`).value = formatMoney(totalAmount + bal);
        document.getElementById(`ledgerPay_${activeRow}`).value = pay || "";
        document.getElementById(`ledgerRem_${activeRow}`).value = formatMoney(netTotal);
    }

    calculateLedgerTotals();
    saveLedger();
}

function syncFromTable(item) {
    const qty = document.getElementById(`qty${item}`).value;
    const syncField = document.getElementById(`sync${item === 'Reg' ? 'Dry' : item}`);
    if (syncField) syncField.value = qty;
    calculateMain();
}

function syncFromPanel(item) {
    const qty = document.getElementById(`sync${item}`).value;
    const tableField = document.getElementById(`qty${item === 'Dry' ? 'Reg' : item}`);
    if (tableField) tableField.value = qty;
    calculateMain();
}

function updateActiveCustomerName(row) {
    if (row === activeRow) {
        const val = document.getElementById(`ledgerName_${row}`).value.trim();
        document.getElementById("activeCustomerDisplay").textContent = val ? val : `Row ${row}`;
    }
}

function loadRowToMain(row) {
    activeRow = row;
    const custName = document.getElementById(`ledgerName_${row}`).value.trim();
    document.getElementById("activeCustomerDisplay").textContent = custName ? custName : `Row ${row}`;

    document.getElementById("qtyReg").value = document.getElementById(`ledgerDry_${row}`).value;
    document.getElementById("qtyFresh").value = document.getElementById(`ledgerFresh_${row}`).value;
    document.getElementById("qtyCab").value = document.getElementById(`ledgerCab_${row}`).value;
    document.getElementById("qtyBo").value = document.getElementById(`ledgerBo_${row}`).value;
    document.getElementById("inputBal").value = document.getElementById(`ledgerBal_${row}`).value;

    document.getElementById("syncDry").value = document.getElementById(`ledgerDry_${row}`).value;
    document.getElementById("syncFresh").value = document.getElementById(`ledgerFresh_${row}`).value;
    document.getElementById("syncCab").value = document.getElementById(`ledgerCab_${row}`).value;
    document.getElementById("syncBo").value = document.getElementById(`ledgerBo_${row}`).value;

    const rawColln = document.getElementById(`ledgerPay_${row}`).value.replace(/,/g, '');
    const rawBilling = document.getElementById(`ledgerBilling_${row}`).value.replace(/,/g, '');
    document.getElementById("inputPay").value = (rawColln !== rawBilling) ? rawColln : "";

    calculateMain();
}

function handleKeyClick() {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 2000);

    if (tapCount >= 5) {
        tapCount = 0;
        isLocked = !isLocked;
        for (let i = 1; i <= 16; i++) {
            const input = document.getElementById(`ledgerName_${i}`);
            input.readOnly = isLocked;
            input.style.backgroundColor = isLocked ? "#e5e7eb" : "#ffffff";
        }
        document.getElementById("lockHeader").textContent = isLocked ? "🔒" : "🔓";
    }
}

function handlePriceKeyClick() {
    priceTapCount++;
    clearTimeout(priceTapTimer);
    priceTapTimer = setTimeout(() => { priceTapCount = 0; }, 2000);

    if (priceTapCount >= 5) {
        priceTapCount = 0;
        isPriceLocked = !isPriceLocked;
        const priceInputs = document.querySelectorAll('.price-input');
        priceInputs.forEach(input => {
            input.readOnly = isPriceLocked;
            input.style.backgroundColor = isPriceLocked ? "#e5e7eb" : "#ffffff";
        });
        document.getElementById("priceLockHeader").textContent = isPriceLocked ? "Price 🔒" : "Price 🔓";
    }
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

    document.getElementById("totalDry").textContent = formatMoney(sumDry);
    document.getElementById("totalFresh").textContent = formatMoney(sumFresh);
    document.getElementById("totalCab").textContent = formatMoney(sumCab);
    document.getElementById("totalBo").textContent = sumBo % 1 === 0 ? sumBo : sumBo.toFixed(1);
    document.getElementById("totalBal").textContent = formatMoney(sumBal);
    document.getElementById("totalBilling").textContent = formatMoney(sumBilling);
    document.getElementById("totalColln").textContent = formatMoney(sumColln);
    document.getElementById("totalRem").textContent = formatMoney(sumRem);
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

    clearAllLedgerInputs();

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
    loadRowToMain(1);
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
    loadRowToMain(1);
    calculateLedgerTotals();
    renderHistoryUI();
    resetInactivityTimer();
}
