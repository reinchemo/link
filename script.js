// ================================================================
// EXPENDITURE SYSTEM — DEMO VERSION (No Supabase, No Login)
// ================================================================
// - No Supabase connection
// - No login system
// - No cloud sync
// - Saves to localStorage only
// - "Made by B" WhatsApp button in HTML
// ================================================================

(function() {
        "use strict";

        // ========================================
        // STORAGE KEYS
        // ========================================
        const KEY_THEME = 'expenditure_demo_theme';
        const KEY_COLUMN_NAMES = 'expenditure_demo_column_names';
        const STORAGE_KEY = 'expenditureDemoData_v1';

        // ========================================
        // UTILITIES
        // ========================================
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function safeNum(v) {
            if (v === '' || v === null || v === undefined) return 0;
            const n = typeof v === 'number' ? v : parseFloat(v);
            return isNaN(n) ? 0 : n;
        }

        function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast-message');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.textContent = message;
            toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
            z-index: 9999;
            background: ${type === 'success' ? 'rgba(111, 203, 147, 0.15)' : type === 'error' ? 'rgba(226, 104, 91, 0.15)' : 'rgba(79, 182, 168, 0.15)'};
            color: ${type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-teal)'};
            border: 1px solid ${type === 'success' ? 'rgba(111, 203, 147, 0.2)' : type === 'error' ? 'rgba(226, 104, 91, 0.2)' : 'rgba(79, 182, 168, 0.2)'};
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px var(--shadow);
            max-width: 90%;
            text-align: center;
        `;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // ========================================
        // M-PESA PARSING
        // ========================================
        function parseMpesaMessage(message) {
            if (!message || message.trim() === '') return null;
            const r = { amount: null, date: null, time: null, transactionCost: null, fullMessage: message, transactionCode: null };

            const c = message.match(/^([A-Z0-9]+)/);
            if (c) r.transactionCode = c[1];

            const a = message.match(/(?:KSh|KES|Ksh|ksh)\s*([\d,]+\.?\d*)\s*(?:sent|received|to|from)?/i);
            if (a) r.amount = parseFloat(a[1].replace(/,/g, ''));

            const f = message.match(/Transaction\s+cost[,:]\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i);
            if (f) r.transactionCost = parseFloat(f[1].replace(/,/g, ''));
            else {
                const f2 = message.match(/(?:Fee|Charge|Cost)[,:]\s*(?:KSh|KES|Ksh|ksh)?\s*([\d,]+\.?\d*)/i);
                if (f2) r.transactionCost = parseFloat(f2[1].replace(/,/g, ''));
            }

            const d = message.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
            if (d) r.date = d[1];

            const t = message.match(/(\d{1,2}:\d{2})\s*(?:AM|PM)?/i);
            if (t) r.time = t[1];

            return r;
        }

        // ========================================
        // TRANSACTION FEES
        // ========================================
        let transactionFees = {};
        let totalTransactionFees = 0;

        function updateTransactionFeesDisplay() {
            const el = document.getElementById('transactionFeesTotal');
            if (el) el.textContent = totalTransactionFees.toFixed(2);
        }

        function recalculateTotalFees() {
            totalTransactionFees = 0;
            for (let k in transactionFees) totalTransactionFees += transactionFees[k];
            return totalTransactionFees;
        }

        function rebuildFeesFromData() {
            transactionFees = {};
            totalTransactionFees = 0;
            const allCols = getAllColumns();

            data.forEach(group => {
                group.rows.forEach(row => {
                    let rowFee = null;
                    allCols.forEach(col => {
                        const transKey = col.key + '_transaction';
                        const transVal = row[transKey];
                        if (transVal && transVal.trim() !== '') {
                            const parsed = parseMpesaMessage(transVal);
                            if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                                rowFee = parsed.transactionCost;
                            }
                        }
                    });
                    if (rowFee !== null && rowFee > 0) {
                        transactionFees[group.id + '_' + row.id] = rowFee;
                    }
                });
            });

            recalculateTotalFees();
            updateTransactionFeesDisplay();
            return totalTransactionFees;
        }

        // ========================================
        // COLUMN NAME EDITS
        // ========================================
        let columnNameEdits = {};

        function loadColumnNameEdits() {
            try {
                const s = localStorage.getItem(KEY_COLUMN_NAMES);
                if (s) columnNameEdits = JSON.parse(s);
            } catch (e) {}
        }

        function saveColumnNameEdits() {
            try {
                localStorage.setItem(KEY_COLUMN_NAMES, JSON.stringify(columnNameEdits));
            } catch (e) {}
        }

        function getColumnLabel(col) {
            return columnNameEdits[col.key] || col.label;
        }

        function editColumnName(colKey) {
            const allCols = getAllColumns();
            const col = allCols.find(c => c.key === colKey);
            if (!col) { showToast('❌ Column not found', 'error'); return; }

            const current = columnNameEdits[colKey] || col.label;
            const newName = prompt('Enter new column name:', current);
            if (newName === null) return;
            if (!newName.trim()) { showToast('❌ Column name cannot be empty', 'error'); return; }

            columnNameEdits[colKey] = newName.trim().toUpperCase();
            saveColumnNameEdits();
            render();
            showToast('✅ Column renamed to: ' + newName.trim().toUpperCase(), 'success');
        }

        // ========================================
        // MAIN APP CONSTANTS
        // ========================================
        const DEFAULT_COLUMNS = [
            { key: 'starlinkGeneral', label: 'STARLINK GENERAL', isCustom: false },
            { key: 'commonInvestment', label: 'COMMON INVESTMENT', isCustom: false },
            { key: 'commonExpenditure', label: 'COMMON EXPENDITURE', isCustom: false },
            { key: 'tokens', label: 'TOKENS', isCustom: false },
            { key: 'fuelBike', label: 'FUEL/BIKE', isCustom: false },
            { key: 'routers', label: 'ROUTERS', isCustom: false }
        ];

        const NUMERIC_KEYS = DEFAULT_COLUMNS.map(c => c.key);

        let customColumns = [];
        let data = [];
        let nextDateId = 1;
        let nextRowId = 1;
        let nextColId = 1;
        let savedDates = {};
        let editModes = {};
        let savedCustomColumns = [];

        let dateFrom = '';
        let dateTo = '';

        const wrapper = document.getElementById('tableWrapper');
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        const clearFilterBtn = document.getElementById('clearFilterBtn');
        const printBtn = document.getElementById('printPdfBtn');
        const addDateBtn = document.getElementById('addDateBtn');
        const addRowBtn = document.getElementById('addRowBtn');
        const grandTotalEl = document.getElementById('grandTotal');

        const modal = document.getElementById('readMoreModal');
        const modalBody = document.getElementById('modalBody');
        const modalCloseBtn = document.getElementById('modalCloseBtn');

        const themeToggle = document.getElementById('themeToggle');

        loadColumnNameEdits();

        // ========================================
        // THEME
        // ========================================
        function getStoredTheme() {
            return localStorage.getItem(KEY_THEME) || 'dark';
        }

        function setStoredTheme(theme) {
            localStorage.setItem(KEY_THEME, theme);
        }

        function applyTheme(theme) {
            if (theme === 'light') {
                document.body.classList.add('light-mode');
                if (themeToggle) themeToggle.textContent = '🌙 Dark';
            } else {
                document.body.classList.remove('light-mode');
                if (themeToggle) themeToggle.textContent = '☀️ Light';
            }
            setStoredTheme(theme);
        }

        function toggleTheme() {
            applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
        }

        // ========================================
        // COLUMN HELPERS
        // ========================================
        function getAllColumns() {
            const cols = [...DEFAULT_COLUMNS, ...customColumns, ...savedCustomColumns];
            return cols.map(col => {
                if (columnNameEdits[col.key]) return {...col, label: columnNameEdits[col.key] };
                return col;
            });
        }

        function isNumericColumn(colKey) {
            if (NUMERIC_KEYS.includes(colKey)) return true;
            if (customColumns.some(c => c.key === colKey)) return true;
            if (savedCustomColumns.some(c => c.key === colKey)) return true;
            return false;
        }

        function formatNumber(v) {
            return safeNum(v);
        }

        function getColumnAmount(row, columnKey) {
            if (!columnKey) return 0;
            const amountKey = columnKey + '_amount';
            return safeNum(row[amountKey]);
        }

        function getRowTotal(row) {
            let sum = 0;
            getAllColumns().forEach(col => {
                if (isNumericColumn(col.key)) sum += getColumnAmount(row, col.key);
            });
            return sum;
        }

        function getDateGroupTotal(group) {
            if (!group || !group.rows) return 0;
            let sum = 0;
            group.rows.forEach(row => { sum += getRowTotal(row); });
            return sum;
        }

        function getFilteredData() {
            let filtered = data;
            if (dateFrom && dateTo) {
                filtered = filtered.filter(d => d.date && d.date >= dateFrom && d.date <= dateTo);
            } else if (dateFrom) {
                filtered = filtered.filter(d => d.date && d.date >= dateFrom);
            } else if (dateTo) {
                filtered = filtered.filter(d => d.date && d.date <= dateTo);
            }
            return sortDataByDate(filtered);
        }

        function computeColumnTotals(filteredData) {
            const totals = {};
            const allCols = getAllColumns();
            allCols.forEach(col => {
                if (isNumericColumn(col.key)) totals[col.key] = 0;
            });
            filteredData.forEach(group => {
                group.rows.forEach(row => {
                    allCols.forEach(col => {
                        if (isNumericColumn(col.key)) {
                            totals[col.key] += getColumnAmount(row, col.key);
                        }
                    });
                });
            });
            return totals;
        }

        function computeGrandTotal(filteredData) {
            let sum = 0;
            filteredData.forEach(g => { sum += getDateGroupTotal(g); });
            return sum;
        }

        function truncateText(text, wordLimit = 3) {
            if (!text) return { short: text, full: text, needsReadMore: false };
            const words = text.trim().split(/\s+/);
            if (words.length <= wordLimit) return { short: text, full: text, needsReadMore: false };
            return {
                short: words.slice(0, wordLimit).join(' ') + '...',
                full: text,
                needsReadMore: true
            };
        }

        function createEmptyRow() {
            const row = { id: nextRowId++ };
            getAllColumns().forEach(col => {
                row[col.key + '_desc'] = '';
                row[col.key + '_transaction'] = '';
                row[col.key + '_amount'] = '';
            });
            return row;
        }

        function sortDataByDate(dataArray) {
            if (!dataArray || dataArray.length === 0) return dataArray;
            return [...dataArray].sort((a, b) => {
                const a1 = new Date(a.date),
                    b1 = new Date(b.date);
                return b1 - a1;
            });
        }

        // ========================================
        // CUSTOM COLUMNS
        // ========================================
        function addCustomColumn() {
            const colName = prompt('Enter the name of the new expenditure column:', 'New Expenditure');
            if (!colName || colName.trim() === '') return;

            const key = 'temp_' + nextColId++ + '_' + colName.replace(/\s+/g, '_').toLowerCase();
            customColumns.push({
                key: key,
                label: colName.trim().toUpperCase(),
                isCustom: true,
                isTemp: true
            });

            data.forEach(group => {
                group.rows.forEach(row => {
                    row[key + '_desc'] = '';
                    row[key + '_transaction'] = '';
                    row[key + '_amount'] = '';
                });
            });

            render();
            showToast('✅ Column added: ' + colName.trim().toUpperCase(), 'success');
        }

        function saveCustomColumn(colKey) {
            const colIndex = customColumns.findIndex(c => c.key === colKey);
            if (colIndex === -1) return;

            const colToSave = customColumns[colIndex];
            const savedCol = {
                key: 'saved_' + nextColId++ + '_' + colToSave.label.replace(/\s+/g, '_').toLowerCase(),
                label: colToSave.label,
                isCustom: true,
                isSaved: true
            };

            data.forEach(group => {
                group.rows.forEach(row => {
                    row[savedCol.key + '_desc'] = row[colToSave.key + '_desc'] || '';
                    row[savedCol.key + '_transaction'] = row[colToSave.key + '_transaction'] || '';
                    row[savedCol.key + '_amount'] = row[colToSave.key + '_amount'] || '';
                });
            });

            savedCustomColumns.push(savedCol);
            customColumns.splice(colIndex, 1);

            data.forEach(group => {
                group.rows.forEach(row => {
                    delete row[colToSave.key + '_desc'];
                    delete row[colToSave.key + '_transaction'];
                    delete row[colToSave.key + '_amount'];
                });
            });

            render();
            showToast('✅ Column saved permanently', 'success');
        }

        function removeCustomColumn(colKey) {
            const savedIndex = savedCustomColumns.findIndex(c => c.key === colKey);
            if (savedIndex !== -1) {
                if (!confirm('Delete this saved column and all its data?')) return;
                savedCustomColumns.splice(savedIndex, 1);
                data.forEach(group => {
                    group.rows.forEach(row => {
                        delete row[colKey + '_desc'];
                        delete row[colKey + '_transaction'];
                        delete row[colKey + '_amount'];
                    });
                });
                render();
                showToast('✅ Column deleted', 'success');
                return;
            }

            const tempIndex = customColumns.findIndex(c => c.key === colKey);
            if (tempIndex !== -1) {
                if (!confirm('Delete this temporary column and all its data?')) return;
                customColumns.splice(tempIndex, 1);
                data.forEach(group => {
                    group.rows.forEach(row => {
                        delete row[colKey + '_desc'];
                        delete row[colKey + '_transaction'];
                        delete row[colKey + '_amount'];
                    });
                });
                render();
                showToast('✅ Column deleted', 'success');
            }
        }

        // ========================================
        // DATE / ROW OPERATIONS
        // ========================================
        function saveDateEntry(dateId) {
            const group = data.find(d => d.id === dateId);
            if (!group) return;

            const btn = document.querySelector(`.save-btn[data-date-id="${dateId}"]`);
            if (btn) {
                btn.textContent = '✓ Saved';
                btn.classList.add('saved');
                setTimeout(() => {
                    btn.textContent = '💾 Save';
                    btn.classList.remove('saved');
                }, 2000);
            }

            let feesCount = 0,
                feesTotal = 0;
            const allCols = getAllColumns();

            const keysToRemove = [];
            for (let key in transactionFees) {
                if (key.startsWith(dateId + '_')) keysToRemove.push(key);
            }
            keysToRemove.forEach(k => delete transactionFees[k]);

            group.rows.forEach(row => {
                let rowFee = null;
                allCols.forEach(col => {
                    const transKey = col.key + '_transaction';
                    const transVal = row[transKey];
                    if (transVal && transVal.trim() !== '') {
                        const parsed = parseMpesaMessage(transVal);
                        if (parsed && parsed.transactionCost !== null && parsed.transactionCost > 0) {
                            rowFee = parsed.transactionCost;
                        }
                    }
                });
                if (rowFee !== null && rowFee > 0) {
                    transactionFees[dateId + '_' + row.id] = rowFee;
                    feesCount++;
                    feesTotal += rowFee;
                }
                delete row._pendingFee;
            });

            recalculateTotalFees();
            updateTransactionFeesDisplay();

            savedDates[dateId] = true;
            editModes[dateId] = false;

            render();
            saveToStorage();

            if (feesCount > 0) {
                showToast(`✅ Saved! ${feesCount} fee(s): KSh ${feesTotal.toFixed(2)}`, 'success');
            } else {
                showToast('✅ Date saved successfully!', 'success');
            }
        }

        function editDateEntry(dateId) {
            editModes[dateId] = !editModes[dateId];
            if (editModes[dateId]) savedDates[dateId] = false;
            render();
        }

        function addTransactionRow(dateId) {
            const group = data.find(d => d.id === dateId);
            if (!group) { showToast('❌ Date entry not found', 'error'); return; }
            group.rows.push(createEmptyRow());
            render();
        }

        function addDateEntry() {
            const dateInput = prompt('Enter date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            if (!dateInput) return;

            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                alert('Please use YYYY-MM-DD format');
                return;
            }

            if (data.some(d => d.date === dateInput)) {
                alert('❌ This date already exists!');
                return;
            }

            const newGroup = {
                id: nextDateId++,
                date: dateInput,
                rows: [createEmptyRow()]
            };

            data.push(newGroup);
            data = sortDataByDate(data);
            render();
            showToast('✅ Date added successfully!', 'success');
        }

        function handleDeleteRow(e) {
            const dateId = parseInt(e.currentTarget.dataset.dateId);
            const rowId = parseInt(e.currentTarget.dataset.rowId);

            if (!confirm('⚠️ Delete this transaction?')) return;

            const group = data.find(d => d.id === dateId);
            if (!group) return;

            const key = dateId + '_' + rowId;
            if (transactionFees[key]) delete transactionFees[key];
            recalculateTotalFees();
            updateTransactionFeesDisplay();

            group.rows = group.rows.filter(r => r.id !== rowId);
            render();
            saveToStorage();
            showToast('✅ Transaction deleted', 'success');
        }

        function handleDeleteDate(e) {
            const dateId = parseInt(e.currentTarget.dataset.dateId);

            if (!confirm('⚠️ Delete this entire date entry and all its transactions?')) return;

            const keysToRemove = [];
            for (let key in transactionFees) {
                if (key.startsWith(dateId + '_')) keysToRemove.push(key);
            }
            keysToRemove.forEach(k => delete transactionFees[k]);

            data = data.filter(d => d.id !== dateId);
            delete savedDates[dateId];
            delete editModes[dateId];

            recalculateTotalFees();
            updateTransactionFeesDisplay();

            render();
            saveToStorage();
            showToast('✅ Date entry deleted', 'success');
        }

        // ========================================
        // INPUT HANDLING
        // ========================================
        let saveTimeout = null;

        function debouncedSave() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveToStorage, 500);
        }

        function handleInputChange(e) {
            const input = e.target;
            const dateId = parseInt(input.dataset.dateId);
            const rowId = parseInt(input.dataset.rowId);
            const key = input.dataset.key;
            const value = input.value;

            const group = data.find(d => d.id === dateId);
            if (!group) return;
            const row = group.rows.find(r => r.id === rowId);
            if (!row) return;

            row[key] = value;

            if (key.endsWith('_transaction')) {
                input.title = value;
                const amountKey = key.replace('_transaction', '_amount');
                if (!value || value.trim() === '') {
                    row[amountKey] = '';
                    row._pendingFee = null;
                } else if (value.length > 5) {
                    const parsed = parseMpesaMessage(value);
                    if (parsed) {
                        if (parsed.amount !== null && parsed.amount > 0) {
                            row[amountKey] = parsed.amount.toString();
                            showToast('💰 Amount extracted: KSh ' + parsed.amount.toFixed(2), 'success');
                        } else {
                            row[amountKey] = '';
                        }
                        if (parsed.transactionCost !== null && parsed.transactionCost > 0) {
                            row._pendingFee = parsed.transactionCost;
                            showToast('💳 Fee detected: KSh ' + parsed.transactionCost.toFixed(2), 'info');
                        } else {
                            row._pendingFee = null;
                        }
                    } else {
                        row[amountKey] = '';
                        row._pendingFee = null;
                    }
                } else {
                    row[amountKey] = '';
                    row._pendingFee = null;
                }
            }

            updateTotalsOnly();
            debouncedSave();
        }

        function updateTotalsOnly() {
            const filtered = getFilteredData();
            const allColumns = getAllColumns();

            const grandTotal = computeGrandTotal(filtered);
            if (grandTotalEl) grandTotalEl.textContent = grandTotal.toFixed(2);

            const rowTotalCells = document.querySelectorAll('.row-total-col');
            let rowIndex = 0;
            filtered.forEach(group => {
                group.rows.forEach(row => {
                    if (rowTotalCells[rowIndex]) {
                        rowTotalCells[rowIndex].textContent = getRowTotal(row).toFixed(2);
                    }
                    rowIndex++;
                });
            });

            const dateTotalCells = document.querySelectorAll('.date-total-amount');
            filtered.forEach((group, idx) => {
                if (dateTotalCells[idx]) {
                    dateTotalCells[idx].textContent = getDateGroupTotal(group).toFixed(2);
                }
            });

            const colTotals = computeColumnTotals(filtered);
            const colTotalCells = document.querySelectorAll('.col-total-row td[data-label]');
            if (colTotalCells.length > 0) {
                let colIndex = 0;
                allColumns.forEach(col => {
                    if (isNumericColumn(col.key)) {
                        const cellIdx = colIndex + 1;
                        if (colTotalCells[cellIdx]) {
                            colTotalCells[cellIdx].textContent = (colTotals[col.key] || 0).toFixed(2);
                        }
                        colIndex++;
                    }
                });
                const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
                const lastCell = colTotalCells[colTotalCells.length - 1];
                if (lastCell) lastCell.textContent = totalColSum.toFixed(2);
            }

            recalculateTotalFees();
            updateTransactionFeesDisplay();
        }

        // ========================================
        // SEARCH
        // ========================================
        function setupSearchFunctionality() {
            const searchInput = document.getElementById('searchInput');
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            if (!searchInput || searchInput._searchInitialized) return;
            searchInput._searchInitialized = true;

            let timer = null;
            searchInput.addEventListener('input', function() {
                clearTimeout(timer);
                timer = setTimeout(() => performSearch(this.value.trim()), 250);
            });
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    this.value = '';
                    performSearch('');
                }
            });
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', function() {
                    searchInput.value = '';
                    performSearch('');
                    searchInput.focus();
                });
            }
        }

        function performSearch(query) {
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            const info = document.getElementById('searchResultInfo');

            document.querySelectorAll('tr.row-highlight').forEach(el => el.classList.remove('row-highlight'));
            document.querySelectorAll('td.cell-highlight').forEach(el => el.classList.remove('cell-highlight'));

            if (clearSearchBtn) clearSearchBtn.style.display = query ? 'inline-block' : 'none';

            if (!query) {
                if (info) { info.style.display = 'none';
                    info.textContent = ''; }
                return;
            }

            const q = query.toUpperCase();
            let matchCount = 0;
            let firstMatch = null;

            document.querySelectorAll('.trans-input, .desc-display[data-type="transaction"]').forEach(el => {
                const text = (el.value || el.textContent || el.dataset.fullText || '').toUpperCase();
                if (text.includes(q)) {
                    matchCount++;
                    const row = el.closest('tr');
                    if (row && !row.classList.contains('row-highlight')) {
                        row.classList.add('row-highlight');
                        if (!firstMatch) firstMatch = row;
                    }
                    const cell = el.closest('td');
                    if (cell) cell.classList.add('cell-highlight');
                }
            });

            if (info) {
                if (matchCount > 0) {
                    info.textContent = `Found ${matchCount} match${matchCount > 1 ? 'es' : ''}`;
                    info.classList.remove('no-result');
                    info.style.display = 'inline-block';
                } else {
                    info.textContent = 'No matches found';
                    info.classList.add('no-result');
                    info.style.display = 'inline-block';
                }
            }

            if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // ========================================
        // READ MORE MODAL
        // ========================================
        function openReadMoreModal(text) {
            if (!modal || !modalBody) return;
            modalBody.innerHTML = `<p class="modal-text">${escapeHtml(text)}</p>`;
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeReadMoreModal() {
            if (!modal) return;
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }

        // ========================================
        // RENDER
        // ========================================
        function render() {
            const filtered = getFilteredData();
            const allColumns = getAllColumns();

            let html = '<table><tbody>';

            if (filtered.length === 0) {
                html += `<tr><td colspan="${allColumns.length + 3}" class="empty-state">
                <span class="icon">📭</span>
                <div style="color:var(--text-primary);">No records found</div>
                <div style="font-size:0.85rem; margin-top:8px; color:var(--text-dim);">Adjust your date filter or add new entries</div>
            </td></tr>`;
            } else {
                filtered.forEach(group => {
                            const isSaved = savedDates[group.id] || false;
                            const isEditing = editModes[group.id] || false;
                            const showEditMode = isEditing || !isSaved;

                            html += `<tr class="date-header-row"><td colspan="${allColumns.length + 3}" style="padding:8px 16px;">`;
                            html += `<div class="date-label">
                    <span class="date-badge">📅 ${escapeHtml(group.date || 'No date')}</span>
                    <button class="add-col-btn-header" title="Add a new custom expenditure column">➕ Add Expenditure</button>
                </div>`;
                            html += `</td></tr>`;

                            html += `<tr class="date-column-header">`;
                            html += `<td style="min-width:80px; font-weight:700; color:var(--accent-brass); text-align:center; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; background:var(--table-header);"></td>`;
                            allColumns.forEach(col => {
                                        const isCustom = col.isCustom || false;
                                        const isSavedCol = col.isSaved || false;
                                        const colLabel = getColumnLabel(col);

                                        html += `<td style="min-width:120px; text-align:center; background:var(--table-header); ${isCustom ? 'background: rgba(200,154,91,0.05);' : ''}" data-col-key="${col.key}">
                        <div class="col-header-with-edit">
                            <span class="col-label" data-col-key="${col.key}" data-label="${escapeHtml(colLabel)}">${escapeHtml(colLabel)}</span>
                            ${isCustom ? `<span style="font-weight:400; font-size:0.55rem; color:#c89a5b;">${isSavedCol ? '(saved)' : '(temp)'}</span>` : ''}
                            <div class="col-edit-actions">
                                <button class="edit-name-btn" data-col-key="${col.key}" title="Edit column name">✏️</button>
                                ${isCustom ? `<button class="remove-col-btn" data-col-key="${col.key}" title="Delete this column">🗑️</button>` : ''}
                            </div>
                        </div>
                    </td>`;
                });
                html += `<td style="min-width:70px; text-align:center; font-weight:700; color:var(--accent-brass); background:var(--table-header);">TOTAL</td>`;
                html += `<td style="min-width:40px; background:var(--table-header);"></td>`;
                html += `</tr>`;

                if (group.rows.length === 0) {
                    html += `<tr><td colspan="${allColumns.length + 3}" style="text-align:center; padding:16px; color:var(--text-dim); background:var(--bg-card);">
                        No transactions — click "Add Row" to add
                    </td></tr>`;
                } else {
                    group.rows.forEach((row, index) => {
                        if (index > 0) {
                            html += `<tr class="transaction-separator"><td colspan="${allColumns.length + 3}" style="padding:0;"></td></tr>`;
                        }

                        html += `<tr>`;
                        html += `<td style="background:var(--bg-card); text-align:center; color:var(--text-dim); font-size:0.7rem;" data-label="">▸</td>`;

                        allColumns.forEach(col => {
                            const isCustom   = col.isCustom || false;
                            const isSavedCol = col.isSaved || false;
                            const descKey    = col.key + '_desc';
                            const transKey   = col.key + '_transaction';
                            const amountKey  = col.key + '_amount';
                            const colLabel   = getColumnLabel(col);

                            const descVal    = row[descKey]   || '';
                            const transVal   = row[transKey]  || '';
                            const amountVal  = row[amountKey] || '';

                            let descDisplay = '';
                            if (showEditMode) {
                                descDisplay = `<textarea class="desc-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${descKey}" placeholder="Description" rows="1">${escapeHtml(descVal)}</textarea>`;
                            } else {
                                const truncated = truncateText(descVal, 3);
                                if (truncated.needsReadMore) {
                                    descDisplay = `<div class="desc-display" data-full-text="${escapeHtml(descVal)}">
                                        <span class="short-text">${escapeHtml(truncated.short)}</span>
                                        <button class="read-more-btn" data-full-text="${escapeHtml(descVal)}">readmore</button>
                                    </div>`;
                                } else {
                                    descDisplay = `<div class="desc-display" data-full-text="${escapeHtml(descVal)}">${escapeHtml(descVal) || '-'}</div>`;
                                }
                            }

                            html += `<td class="expenditure-cell" style="padding:2px 3px; ${isCustom ? 'background: rgba(79,182,168,0.05);' : ''}" data-label="${escapeHtml(colLabel)}">
                                <div class="column-group ${isCustom ? 'custom-column' : ''}">
                                    <span class="field-header">Description</span>
                                    ${descDisplay}
                                    <span class="field-header">Transaction Reference</span>
                                    ${showEditMode
                                        ? `<textarea class="trans-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${transKey}" placeholder="Transaction Reference" rows="1" title="${escapeHtml(transVal)}">${escapeHtml(transVal)}</textarea>`
                                        : `<div class="desc-display" data-full-text="${escapeHtml(transVal)}" data-type="transaction" title="${escapeHtml(transVal)}">${escapeHtml(transVal) || '-'}</div>`}
                                    <span class="field-header">Amount</span>
                                    ${showEditMode
                                        ? `<input type="text" class="amount-input" data-date-id="${group.id}" data-row-id="${row.id}" data-key="${amountKey}" value="${escapeHtml(amountVal)}" placeholder="0">`
                                        : `<div class="amount-display">${formatNumber(amountVal).toFixed(2)}</div>`}
                                    ${isCustom && !isSavedCol
                                        ? `<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                                            <button class="save-col-btn" data-col-key="${col.key}" title="Save this column permanently">💾 Save</button>
                                        </div>`
                                        : ''}
                                </div>
                            </td>`;
                        });

                        html += `<td class="row-total-col" data-label="Total">${getRowTotal(row).toFixed(2)}</td>`;
                        html += `<td><button class="delete-row-btn" data-date-id="${group.id}" data-row-id="${row.id}" title="Delete this transaction">🗑️ Delete</button></td>`;
                        html += `</tr>`;
                    });
                }

                const dateTotal = getDateGroupTotal(group);
                html += `<tr class="date-total-row">`;
                html += `<td colspan="${allColumns.length + 2}" style="padding:8px 16px;" data-label="">`;
                html += `<div class="date-total-content">
                    <div class="date-total-actions">
                        <button class="action-btn save-btn ${isSaved ? 'saved' : ''}" data-date-id="${group.id}">💾 Save</button>
                        <button class="action-btn edit-btn" data-date-id="${group.id}">✏️ Edit</button>
                        <button class="action-btn delete-date-btn" data-date-id="${group.id}">🗑️ Delete</button>
                    </div>
                    <div class="date-total-right">
                        <span class="date-total-label">Date Total Amount:</span>
                        <span class="date-total-amount">${dateTotal.toFixed(2)}</span>
                        <div class="date-total-add-row">
                            <button class="add-row-inline-btn" data-date-id="${group.id}">➕ Add Row</button>
                        </div>
                    </div>
                </div>`;
                html += `</td>`;
                html += `<td></td>`;
                html += `</tr>`;
            });
        }

        const colTotals = computeColumnTotals(filtered);
        html += '<tfoot>';
        html += `<tr class="col-total-row">`;
        html += `<td data-label="COLUMN TOTALS"><span class="col-total-label">COLUMN TOTALS</span></td>`;
        allColumns.forEach(col => {
            const colLabel = getColumnLabel(col);
            if (isNumericColumn(col.key)) {
                html += `<td class="column-total-cell" data-label="${escapeHtml(colLabel)}" style="color:var(--text-primary);">${(colTotals[col.key] || 0).toFixed(2)}</td>`;
            } else {
                html += `<td class="column-total-cell" data-label="${escapeHtml(colLabel)}" style="color:var(--text-primary);">0.00</td>`;
            }
        });
        const totalColSum = Object.values(colTotals).reduce((a, b) => a + b, 0);
        html += `<td class="column-total-cell grand-column-total" data-label="Total" style="font-weight:700; color:var(--accent-teal);">${totalColSum.toFixed(2)}</td>`;
        html += `<td></td>`;
        html += `</tr>`;
        html += '</tfoot></tbody></table>';

        wrapper.innerHTML = html;

        if (grandTotalEl) {
            grandTotalEl.textContent = computeGrandTotal(filtered).toFixed(2);
        }

        document.querySelectorAll('.desc-input, .trans-input, .amount-input').forEach(input => {
            input.addEventListener('input', handleInputChange);
        });

        document.querySelectorAll('.desc-input, .trans-input').forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
                if (this.classList.contains('trans-input')) this.title = this.value;
            });
            setTimeout(() => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }, 10);
        });

        document.querySelectorAll('.read-more-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                openReadMoreModal(this.dataset.fullText || '');
            });
        });

        document.querySelectorAll('.desc-display').forEach(el => {
            el.addEventListener('click', function() {
                const t = this.dataset.fullText || '';
                if (t && t !== '-') openReadMoreModal(t);
            });
        });

        document.querySelectorAll('.delete-row-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteRow);
        });

        document.querySelectorAll('.date-total-row .save-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                saveDateEntry(parseInt(e.currentTarget.dataset.dateId));
            });
        });

        document.querySelectorAll('.date-total-row .edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                editDateEntry(parseInt(e.currentTarget.dataset.dateId));
            });
        });

        document.querySelectorAll('.date-total-row .delete-date-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteDate);
        });

        document.querySelectorAll('.date-total-row .add-row-inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                addTransactionRow(parseInt(e.currentTarget.dataset.dateId));
            });
        });

        document.querySelectorAll('.add-col-btn-header').forEach(btn => {
            btn.addEventListener('click', addCustomColumn);
        });

        document.querySelectorAll('.save-col-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                saveCustomColumn(e.currentTarget.dataset.colKey);
            });
        });

        document.querySelectorAll('.remove-col-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCustomColumn(e.currentTarget.dataset.colKey);
            });
        });

        setupColumnNameEditListeners();

        setTimeout(() => {
            updateTotalsOnly();
        }, 50);

        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            setTimeout(() => performSearch(searchInput.value.trim()), 60);
        }
    }

    function setupColumnNameEditListeners() {
        document.querySelectorAll('.edit-name-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                editColumnName(this.dataset.colKey);
            });
        });
    }

    // ========================================
    // FILTERS
    // ========================================
    function applyDateFilter() {
        dateFrom = dateFromInput.value || '';
        dateTo   = dateToInput.value || '';
        render();
    }

    function clearDateFilter() {
        dateFromInput.value = '';
        dateToInput.value = '';
        dateFrom = '';
        dateTo = '';
        render();
    }

    // ========================================
    // PDF EXPORT
    // ========================================
    function exportPdf() {
        const filtered   = getFilteredData();
        const allColumns = getAllColumns();

        let filterInfo = '';
        if (dateFrom && dateTo) filterInfo = ` (${dateFrom} to ${dateTo})`;
        else if (dateFrom) filterInfo = ` (from ${dateFrom})`;
        else if (dateTo) filterInfo = ` (up to ${dateTo})`;

        let printHtml = `
        <html>
        <head><meta charset="UTF-8"><title>Expenditure Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; padding: 20px 30px; background: #ffffff; color: #1a1a1d; }
            h1 { color: #0a2a44; border-bottom: 3px solid #c89a5b; padding-bottom: 10px; text-align: center; font-size: 24px; }
            .subtitle { color: #4a5a7a; margin: 10px 0 20px; text-align: center; font-size: 14px; }
            .filter-info { color: #6b6860; margin-bottom: 20px; font-size: 13px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th { background: #e8e0d4; padding: 10px 8px; border: 1px solid #b8b0a4; text-align: center; font-weight: 700; font-size: 10px; text-transform: uppercase; }
            td { padding: 6px 8px; border: 1px solid #c8c0b4; text-align: center; vertical-align: middle; }
            .date-header { background: #f0ece4; font-weight: 700; }
            .date-header td { padding: 10px 16px; text-align: left; font-size: 13px; }
            .grand-total { background: #0a2a44; color: #ffffff; font-weight: 800; }
            .grand-total td { padding: 12px 8px; font-size: 14px; }
            .footer { margin-top: 30px; color: #6b6860; font-size: 12px; text-align: center; border-top: 1px solid #e0d8cc; padding-top: 15px; }
        </style>
        </head>
        <body>
        <h1>📡 EXPENDITURE SYSTEM</h1>
        <div class="subtitle">Expenditure Report</div>
        <div class="filter-info"><strong>Date Range:</strong> ${escapeHtml(filterInfo || 'All records')}</div>
        `;

        if (filtered.length === 0) {
            printHtml += `<div style="text-align:center; padding:40px; color:#6b6860;">📭 No expenditure records found.</div>`;
        } else {
            printHtml += `<table>`;
            printHtml += `<tr><th>DATE</th>`;
            allColumns.forEach(col => printHtml += `<th>${escapeHtml(getColumnLabel(col))}</th>`);
            printHtml += `<th>TOTAL</th></tr>`;

            filtered.forEach(group => {
                printHtml += `<tr class="date-header"><td colspan="${allColumns.length + 2}">📅 ${escapeHtml(group.date)}</td></tr>`;
                if (group.rows.length > 0) {
                    group.rows.forEach(row => {
                        printHtml += `<tr><td>${escapeHtml(row[allColumns[0].key + '_desc'] || '-')}</td>`;
                        allColumns.forEach(col => {
                            printHtml += `<td style="text-align:right;">${formatNumber(row[col.key + '_amount']).toFixed(2)}</td>`;
                        });
                        printHtml += `<td style="font-weight:700;">${getRowTotal(row).toFixed(2)}</td></tr>`;
                    });
                }
            });

            printHtml += `<tr class="grand-total"><td colspan="${allColumns.length + 1}" style="text-align:right; padding-right:20px;">GRAND TOTAL</td><td>${computeGrandTotal(filtered).toFixed(2)}</td></tr>`;
            printHtml += `</table>`;
        }

        printHtml += `<div class="footer">Generated: ${new Date().toLocaleString()} | Expenditure System (Demo)</div>`;
        printHtml += `</body></html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(printHtml);
            win.document.close();
            win.focus();
            win.print();
        } else {
            alert('Please allow pop-ups to export PDF.');
        }
    }

    // ========================================
    // STORAGE
    // ========================================
    function saveToStorage() {
        try {
            data = sortDataByDate(data);
            const store = {
                data, nextDateId, nextRowId, nextColId,
                customColumns, savedCustomColumns, savedDates, editModes,
                dateFrom, dateTo,
                columnNameEdits, transactionFees, totalTransactionFees
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (e) {}
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const store = JSON.parse(raw);
            if (store.data && Array.isArray(store.data)) {
                data = sortDataByDate(store.data);
                nextDateId = store.nextDateId || 1;
                nextRowId  = store.nextRowId  || 1;
                nextColId  = store.nextColId  || 1;
                customColumns      = store.customColumns      || [];
                savedCustomColumns = store.savedCustomColumns || [];
                savedDates = store.savedDates || {};
                editModes  = store.editModes  || {};
                dateFrom   = store.dateFrom || '';
                dateTo     = store.dateTo   || '';

                if (store.columnNameEdits) {
                    columnNameEdits = store.columnNameEdits;
                    saveColumnNameEdits();
                }
                if (store.transactionFees) {
                    transactionFees = store.transactionFees || {};
                    totalTransactionFees = store.totalTransactionFees || 0;
                }
                if (dateFrom && dateFromInput) dateFromInput.value = dateFrom;
                if (dateTo && dateToInput)     dateToInput.value   = dateTo;
                return true;
            }
        } catch (e) {}
        return false;
    }

    // ========================================
    // MAIN APP INIT
    // ========================================
    function initMainApp() {
        applyTheme(getStoredTheme());
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

        const loaded = loadFromStorage();

        if (!loaded) {
            customColumns = [];
            savedCustomColumns = [];
            savedDates = {};
            editModes = {};
            dateFrom = '';
            dateTo = '';
            transactionFees = {};
            totalTransactionFees = 0;

            // Sample demo data (static, editable)
            const today = new Date().toISOString().split('T')[0];
            data = [{
                id: nextDateId++,
                date: today,
                rows: [
                    {
                        id: nextRowId++,
                        starlinkGeneral_desc: 'Office supplies',
                        starlinkGeneral_transaction: 'QGH7X8K2LM',
                        starlinkGeneral_amount: '2500',
                        commonInvestment_desc: 'Internet bundle',
                        commonInvestment_transaction: 'QGH8Y9K3MN',
                        commonInvestment_amount: '1000',
                        commonExpenditure_desc: 'Transport',
                        commonExpenditure_transaction: 'QGH9Z0K4OP',
                        commonExpenditure_amount: '800',
                        tokens_desc: '',
                        tokens_transaction: '',
                        tokens_amount: '',
                        fuelBike_desc: '',
                        fuelBike_transaction: '',
                        fuelBike_amount: '',
                        routers_desc: 'Router purchase',
                        routers_transaction: 'QGI0A1K5PQ',
                        routers_amount: '3500'
                    }
                ]
            }];
        }

        rebuildFeesFromData();
        data = sortDataByDate(data);
        render();
        setupSearchFunctionality();

        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeReadMoreModal);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) closeReadMoreModal();
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeReadMoreModal();
            });
        }

        if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyDateFilter);
        if (clearFilterBtn) clearFilterBtn.addEventListener('click', clearDateFilter);
        if (printBtn)       printBtn.addEventListener('click', exportPdf);
        if (addDateBtn)     addDateBtn.addEventListener('click', addDateEntry);

        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => {
                if (data.length === 0) {
                    alert('Please add a date entry first');
                    return;
                }
                addTransactionRow(data[data.length - 1].id);
            });
        }

        window.addEventListener('beforeunload', function() {
            clearTimeout(saveTimeout);
            saveToStorage();
        });
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMainApp);
        } else {
            initMainApp();
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    }

})();
