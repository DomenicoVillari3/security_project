
// Parametri dalla pagina
const TX_ID = document.getElementById('tx').innerText.trim();
const BLOCKCHAIN = document.getElementById('blockchain').innerText.trim();
console.log("TX_ID:", TX_ID);
console.log("BLOCKCHAIN:", BLOCKCHAIN);


// Funzione per formattare la data
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// Funzione per ottenere l'icona del tipo di step
function getTypeIcon(type) {
    const icons = {
        'production': '',
        'processing': '',
        'transport': '',
        'retail': '',
        'certification': '',
        'harvest': '',
        'packaging': ''
    };
    return icons[type.toLowerCase()] || '';
}

// Funzione per ottenere il colore del tipo
function getTypeColor(type) {
    const colors = {
        'production': '#4CAF50',
        'processing': '#FF9800',
        'transport': '#2196F3',
        'retail': '#9C27B0',
        'certification': '#FFC107',
        'harvest': '#8BC34A',
        'packaging': '#607D8B'
    };
    return colors[type.toLowerCase()] || '#4CAF50';
}

// Carica i dati della filiera
async function loadSupplyChainData() {
    try {
        console.log("TX_ID:", TX_ID);
        console.log("BLOCKCHAIN:", BLOCKCHAIN);

        const response = await fetch(`/api/filiera/chain/${TX_ID}?blockchain=${BLOCKCHAIN}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Mostra le informazioni del prodotto corrente
        displayProductInfo(data.current_transaction);
        
        // Mostra la timeline
        displayTimeline(data.supply_chain_timeline);
        console.log(data.supply_chain_timeline)
        
        // Nascondi loading e mostra contenuto
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
    } catch (error) {
        console.error('Errore nel caricamento:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
    }
}

// Mostra le informazioni del prodotto
function displayProductInfo(transaction) {
    const productInfoContainer = document.getElementById('product-info');
    const payload = transaction.Response.DecodedPayload || {};
    
    const productCard = `
        <div class="info-card">
            <h3> Informazioni Prodotto</h3>
            <div class="info-item">
                <span class="info-label">Prodotto:</span>
                <span class="info-value">${payload.product || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Lotto/Batch:</span>
                <span class="info-value">${payload.batch_id || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Quantità:</span>
                <span class="info-value">${payload.quantity || 'N/A'} ${payload.unit || ''}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Tipo Step:</span>
                <span class="info-value">${payload.type || 'N/A'}</span>
            </div>
        </div>
        
        <div class="info-card">
            <h3> Informazioni Logistiche</h3>
            <div class="info-item">
                <span class="info-label">Ubicazione:</span>
                <span class="info-value">${payload.location || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Data/Ora:</span>
                <span class="info-value">${formatDate(payload.timestamp)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Certificazione:</span>
                <span class="info-value">${payload.certification || 'Nessuna'}</span>
            </div>
        </div>
        
        <div class="info-card">
            <h3> Informazioni Blockchain</h3>
            <div class="info-item">
                <span class="info-label">Transaction ID:</span>
                <span class="info-value" style="word-break: break-all; font-family: monospace;">${transaction.Response.ID}</span>
            </div>
            <div class="info-item">
                <span class="info-label">BlockId:</span>
                <span class="info-value">${transaction.Response.BlockID}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value"> Confermata</span>
            </div>
        </div>
    `;
    
    if (payload.notes) {
        productInfoContainer.innerHTML += `
            <div class="info-card" style="grid-column: 1 / -1;">
                <h3> Note Aggiuntive</h3>
                <p style="color: #2c3e50; line-height: 1.6;">${payload.notes}</p>
            </div>
        `;
    }
    
    productInfoContainer.innerHTML = productCard;
}

// Mostra la timeline
function displayTimeline(timeline) {
    const timelineContainer = document.getElementById('timeline-items');
    
    if (!timeline || timeline.length === 0) {
        timelineContainer.innerHTML = '<p style="text-align: center; color: #666;">Nessun dato di timeline disponibile</p>';
        return;
    }
    
    const timelineHTML = timeline.map(item => {
        const typeColor = getTypeColor(item.type);
        const typeIcon = getTypeIcon(item.type);
        
        return `
            <div class="timeline-item">
                <div class="timeline-type" style="background-color: ${typeColor};">
                    ${typeIcon} ${item.type.toUpperCase()}
                </div>
                <div class="timeline-content">
                    <div class="info-item">
                        <span class="info-label">Block ID:</span>
                        <span class="info-value">${item.block_id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">TX ID:</span>
                        <span class="info-value">${item.tx_id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Prodotto:</span>
                        <span class="info-value">${item.product}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ubicazione:</span>
                        <span class="info-value">${item.location}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Data/Ora:</span>
                        <span class="info-value">${formatDate(item.timestamp)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Quantità:</span>
                        <span class="info-value">${item.quantity} ${item.unit}</span>
                    </div>
                    ${item.notes ? `
                        <div class="info-item" style="grid-column: 1 / -1;">
                            <span class="info-label">Note:</span>
                            <span class="info-value">${item.notes}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    timelineContainer.innerHTML = timelineHTML;
}

// Carica i dati quando la pagina è pronta
document.addEventListener('DOMContentLoaded', loadSupplyChainData);


