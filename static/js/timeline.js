
let currentWalletAddress = '';

// Carica le transazioni all'avvio della pagina
document.addEventListener('DOMContentLoaded', function() {
    loadTransactions();
});

async function loadTransactions(startBlock = '0', endBlock = 'latest') {
    try {
        showLoading();
        hideError();
        hideEmpty();
        
        const response = await fetch(`/api/wallet/transactions?start=${startBlock}&end=${endBlock}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Aggiorna indirizzo wallet
        currentWalletAddress = data.wallet_address;
        document.getElementById('wallet-address').textContent = currentWalletAddress;
        
        hideLoading();
        
        if (data.success) {
            if (data.transactions.length > 0) {
                displayTransactions(data.transactions);
                updateStatistics(data.total);
            } else {
                showEmpty();
                updateStatistics(0);
            }
        } else {
            showError(data.error || 'Errore nel caricamento delle transazioni');
            updateStatistics(0);
        }
        
    } catch (error) {
        console.error('Errore nel caricamento:', error);
        hideLoading();
        showError('Errore di connessione: ' + error.message);
        updateStatistics(0);
    }
}

function displayTransactions(transactions) {
    const timeline = document.getElementById('transactions-timeline');
    timeline.innerHTML = '';
    
    if (transactions.length === 0) {
        showEmpty();
        return;
    }
    
    transactions.forEach((tx, index) => {
        const txElement = createTransactionElement(tx, index);
        timeline.appendChild(txElement);
    });
}

// Crea l'elemento HTML per una singola transazione
function createTransactionElement(tx, index) {
    tx.ID = tx.ID.startsWith('0x') ? tx.ID : '0x' + tx.ID;
    decodedPayload = tx.Payload ? decodeHexPayload(tx.Payload) : null;
    if (decodedPayload) {
        tx.Payload = JSON.stringify(decodedPayload, null, 2);
    }

    const div = document.createElement('div');
    div.className = 'border-bottom';
    
    // Determina il tipo di transazione e colore
    const isOutgoing = tx.From === currentWalletAddress;
    const statusColor = getStatusColor(tx.Status);
    const typeInfo = getTransactionTypeInfo(tx);
    
    // Formatta timestamp
    const timestamp = formatTimestamp(tx.Timestamp);
    
    // Formatta fees
    const totalFees = (parseFloat(tx.BroadcastFee) + parseFloat(tx.NagFee) + parseFloat(tx.ProcessingFee) + parseFloat(tx.ProtocolFee)).toFixed(4);
    
    div.innerHTML = `
        <div class="p-4">
            <div class="row align-items-center">
                <!-- Icon e Status -->
                <div class="col-md-1 text-center">
                    <div class="icon-circle bg-${statusColor}">
                        <i class="fas ${isOutgoing ? 'fa-times' : 'fa-check'} text-white"></i>
                    </div>
                </div>
                
                <!-- Transaction Info -->
                <div class="col-md-8">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="mb-1 text-gray-800">
                                
                                <span class="badge badge-${statusColor} font-weight-bold">${tx.Status}</span>
                            </h6>
                            <small class="text-gray-600">${timestamp}</small>
                        </div>
                        
                    </div>
                    
                    <!-- Indirizzi -->
                    <div class="small mb-2">
                        <div class="mb-1">
                            <strong class="text-gray-600">Da:</strong>
                            <span class="ml-1" style="font-family: monospace;">${tx.From}</span>
                            ${tx.From === currentWalletAddress ? '<span class="badge badge-primary badge-sm ml-1">Tu</span>' : ''}
                        </div>
                        <div class="mb-1">
                            <strong class="text-gray-600">A:</strong>
                            <span class="ml-1" style="font-family: monospace;">${tx.To}</span>
                            ${tx.To === currentWalletAddress ? '<span class="badge badge-primary badge-sm ml-1">Tu</span>' : ''}
                        </div>
                    </div>
                    
                    <!-- Dettagli tecnici collassabili -->
                    <div class="small">
                        <a class="text-primary" data-toggle="collapse" href="#details-${index}" aria-expanded="false">
                            <i class="fas fa-chevron-down mr-1"></i>
                            Visualizza dettagli
                        </a>
                    </div>
                </div>
                
                <!-- Fees e Block -->
                <div class="col-md-3 text-right">
                    <div class="mb-1">
                        <small class="text-gray-600">Blocco</small>
                        <div class="font-weight-bold text-primary">#${tx.BlockID}</div>
                    </div>
                    <div>
                        <small class="text-gray-600">Fees Totali</small>
                        <div class="font-weight-bold text-danger">${totalFees}</div>
                    </div>
                </div>
            </div>
            
            <!-- Dettagli collassabili -->
            <div class="collapse mt-3" id="details-${index}">
                <div class="card bg-light">
                    <div class="card-body p-3">
                        <div class="row small">
                            <div class="col-md-6">
                                <div class="mb-2">
                                    <strong>Transaction ID:</strong>
                                    <div style="font-family: monospace; word-break: break-all;">${'0x'+tx.ID}</div>
                                    <button class="btn btn-xs btn-outline-secondary mt-1" onclick="copyToClipboard('${tx.ID}')">
                                        <i class="fas fa-copy"></i> Copia
                                    </button>
                                </div>
                                <div class="mb-2">
                                    <strong>Gas Limit:</strong> ${tx.GasLimit}
                                </div>
                                <div class="mb-2">
                                    <strong>Nonce:</strong> ${tx.Nonce}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-2">
                                    <strong>Node ID:</strong>
                                    <div style="font-family: monospace; word-break: break-all;">${tx.NodeID}</div>
                                </div>
                                <div class="mb-2">
                                    <strong>Breakdown Fees:</strong>
                                    <ul class="list-unstyled ml-2 mt-1">
                                        <li>Broadcast: ${tx.BroadcastFee}</li>
                                        <li>NAG: ${tx.NagFee}</li>
                                        <li>Processing: ${tx.ProcessingFee}</li>
                                        <li>Protocol: ${tx.ProtocolFee}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        ${tx.Payload ? `
                        <div class="mt-3">
                            <strong>Payload:</strong>
                            <div class="mt-3">
                                <textarea class="form-control form-control-sm" rows="10" readonly style="font-family: monospace; font-size: 11px;">${tx.Payload.substring(0, 500)}${tx.Payload.length > 500 ? '...' : ''}</textarea>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return div;
}

// Utility functions
function getStatusColor(status) {
    const statusColors = {
        'Executed': 'success',
        'Pending': 'warning', 
        'Failed': 'danger'
    };
    return statusColors[status] || 'secondary';
}

function getTransactionTypeInfo(tx) {
    // Puoi personalizzare questo basandoti sui tuoi tipi di transazione
    if (tx.type_tr) {
        const types = {
            'C_TYPE_CERTIFICATE': { label: 'Certificato', color: 'info' },
            'C_TYPE_TRANSFER': { label: 'Trasferimento', color: 'primary' },
            'C_TYPE_CONTRACT': { label: 'Contratto', color: 'warning' }
        };
        return types[tx.type_tr] || { label: tx.type_tr, color: 'secondary' };
    }
    return { label: 'Standard', color: 'secondary' };
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    // Format: "20250824-095532" -> "24/08/2025 09:55:32"
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(9, 11);
    const minute = timestamp.substring(11, 13);
    const second = timestamp.substring(13, 15);
    
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}



function updateStatistics(total) {
    document.getElementById('total-transactions').textContent = total;
    document.getElementById('transaction-count').textContent = total;
}

function showLoading() {
    document.getElementById('loading-section').style.display = 'block';
    document.getElementById('transactions-timeline').innerHTML = '';
}

function hideLoading() {
    document.getElementById('loading-section').style.display = 'none';
}

function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-section').style.display = 'block';
}

function hideError() {
    document.getElementById('error-section').style.display = 'none';
}

function showEmpty() {
    document.getElementById('empty-section').style.display = 'block';
}

function hideEmpty() {
    document.getElementById('empty-section').style.display = 'none';
}

// Event handlers
function refreshTransactions() {
    const startBlock = document.getElementById('start-block').value || '0';
    const endBlock = document.getElementById('end-block').value || 'latest';
    loadTransactions(startBlock, endBlock);
}

function applyFilters() {
    refreshTransactions();
}

function copyWalletAddress() {
    copyToClipboard(currentWalletAddress);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copiato negli appunti!', 'success');
    }).catch(err => {
        console.error('Errore nella copia: ', err);
        showToast('Errore nella copia', 'error');
    });
}

function showToast(message, type = 'info') {
    // Implementazione semplice con alert
    alert(message);
}

function getToken() {
    return localStorage.getItem('token') || getCookie('token');
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
}
// Funzione per decodificare payload esadecimale
function decodeHexPayload(hexString) {
    try {
        // Rimuovi spazi e prefisso 0x se presente
        let hexClean = hexString.replace(/\s/g, '').replace(/^0x/, '');
        
        // Converti hex in string
        let decoded = '';
        for (let i = 0; i < hexClean.length; i += 2) {
            decoded += String.fromCharCode(parseInt(hexClean.substr(i, 2), 16));
        }
        
        // Prova a parsare come JSON
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Errore nella decodifica hex:', error);
        return null;
    }
}