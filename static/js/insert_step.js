
// IMPORTANTE: CircularProtocolAPI è un OGGETTO, non una funzione!
// Non fare: new CircularProtocolAPI() 
// Fai semplicemente: CircularProtocolAPI
function setLoading(isLoading, message = 'Elaborazione in corso...') {
    const loadingElem = document.getElementById('loading');
    const submitButton = document.getElementById('submitButton');
    
    if (loadingElem) {
        loadingElem.style.display = isLoading ? 'block' : 'none';
        // Aggiorna il messaggio di loading
        const loadingText = loadingElem.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
    
    if (submitButton) {
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading ? message : 'Invia Step';
    }
}


// Funzione di firma usando CircularProtocolAPI
function signTransaction(hashid, privateKeyHex) {
    try {
        console.log('Hash per firma:', hashid);
        console.log('Private key (primi 10 char):', privateKeyHex.substring(0, 10) + '...');
        
        // Usa la funzione signMessage di CircularProtocolAPI
        // Rimuovi 0x se presente
        const cleanHash = CircularProtocolAPI.hexFix(hashid);
        const cleanPrivateKey = CircularProtocolAPI.hexFix(privateKeyHex);
        
        // Firma usando CircularProtocolAPI (ritorna DER format)
        const signature = CircularProtocolAPI.signMessage(cleanHash, cleanPrivateKey);
        
        console.log(' Firma generata (DER format):', signature.substring(0, 20) + '...');
        console.log(' Lunghezza firma:', signature.length);
        
        return signature;
        
    } catch (error) {
        console.error(' Errore nella firma:', error);
        throw new Error('Errore nella firma: ' + error.message);
    }
}

// Funzione per firmare con chiave memorizzata
async function signWithStoredKey(walletAddress, hashid, passphrase) {
    try {
        console.log('Cercando chiave per wallet:', walletAddress);
        
        // Recupera chiave cifrata da IndexedDB
        const db = await openDB();
        const tx = db.transaction("encrypted_keys", "readonly");
        const store = tx.objectStore("encrypted_keys");
        const request = store.get(walletAddress);
        
        const result = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Errore nel recupero della chiave");
        });
        
        if (!result) {
            throw new Error("Chiave non trovata per questo wallet");
        }
        
        console.log(' Chiave trovata per wallet:', walletAddress, !!result);
        
        // Decifratura
        console.log(' Decifratura chiave privata...');
        const salt = base64ToUint8Array(result.salt);
        const iv = base64ToUint8Array(result.iv);
        const ciphertext = base64ToUint8Array(result.ciphertext);
        
        console.log(' Firma in corso...');
        const aesKey = await deriveKey(passphrase, salt);
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            ciphertext
        );
        
        const privateKeyBytes = new Uint8Array(decryptedBuffer);
        // Converti i bytes in hex per CircularProtocolAPI
        const privateKeyHex = Array.from(privateKeyBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        // Usa la funzione di firma di CircularProtocolAPI
        const signature = signTransaction(hashid, privateKeyHex);
        
        // Pulizia memoria
        privateKeyBytes.fill(0);
        console.log(' Memoria privata azzerata');
        
        return signature;
        
    } catch (error) {
        console.error(' Errore in signWithStoredKey:', error);
        throw new Error('Errore nella firma: ' + error.message);
    }
}

// Gestione submit form
document.getElementById('stepForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    // Mostra animazione di loading
    setLoading(true);
    
    // Prepara i dati dal form
    const selected_blockchain = document.getElementById("blockchain").value;
    const form = event.target;
    const bodyData = {
        batch_id: form.batch_id.value.trim(),
        type: form.type.value.trim(),
        product: form.product.value.trim(),
        quantity: parseInt(form.quantity.value, 10),
        unit: form.unit.value.trim(),
        location: form.location.value.trim(),
        timestamp: new Date(form.timestamp.value).toISOString(),
        parents: form.parents.value.trim() ? form.parents.value.trim().split(",").map(s => s.trim()) : [],
        notes: form.notes.value.trim()
    };

    try {
        // 1) Build transaction
        setLoading(true, ' Preparazione transazione...');
        console.log('Preparazione transazione...');
        const buildResponse = await authenticatedFetch(`${API_BASE}/tx/build?blockchain=${selected_blockchain}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData)
        });

        if (!buildResponse.ok) {
            const errorData = await buildResponse.json();
            throw new Error(errorData.detail || "Errore nella preparazione transazione");
        }

        var { unsigned_tx, hashid } = await buildResponse.json();
        console.log('Transazione preparata, hashid:', hashid);

        // 2) Chiedi passphrase
        const passphrase = prompt("Inserisci la passphrase per firmare la transazione:");
        if (!passphrase) {
            alert("Passphrase richiesta per firmare");
            return;
        }

        // 3) Ottieni wallet address
        setLoading(true, ' Recupero profilo utente...');
        console.log('Recupero profilo utente...');
        const profile_data = await getProfile();
        const profile = profile_data.utente || profile_data;
        const walletAddress = normalizeWalletAddress(profile.wallet_addr);
        console.log(' Wallet address:', walletAddress);

        // 4) Firma con chiave decifrata
        setLoading(true, ' Firma della transazione...');
        console.log('Firma della transazione...');
        var signature = await signWithStoredKey(walletAddress, hashid, passphrase);
        console.log(' Firma completata:', signature.substring(0, 20) + '...');

        // 5) Submit della transazione firmata
        setLoading(true, ' Invio transazione...');
        console.log('Invio transazione...');
        const submitResponse = await authenticatedFetch(`${API_BASE}/tx/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                signed_signature: signature,
                unsigned_tx: unsigned_tx
            })
        });

        if (submitResponse.ok) {
            const result = await submitResponse.json();
            
            

            console.log("TXID: ","0x"+result.Response.TxID,"BKC",selected_blockchain)
            //DOWLOAD PDF
            txid="0x"+result.Response.TxID
            
            setLoading(true, 'Generazione certificato PDF...'); 
            await pdfDownload(txid,selected_blockchain);


            document.getElementById('result').innerHTML = `
                <div class="alert alert-success">
                    <h4> Transazione inviata con successo!</h4>
                    <p><strong>TxID:</strong> ${"0x"+result.Response?.TxID || 'N/A'}</p>
                    <p><strong>Timestamp:</strong> ${result.Response?.Timestamp || 'N/A'}</p>
                    <p><strong>Node:</strong> ${result.Node || 'N/A'}</p>
                    <p><strong>  BlockID: </strong> ${result.Response?.BlockID || 'N/A'}</p>
                </div>
            `;
            

            // SVUOTA TUTTI I CAMPI DEL FORM
            form.reset();
            console.log('Campi del form svuotati');

            
        } else {
            const errorData = await submitResponse.json();
            throw new Error(errorData.detail || "Errore durante l'invio");
        }

    } catch (error) {
        console.error('Errore:', error);
        document.getElementById('result').innerHTML = `
            <div class="alert alert-danger">
                <h4>Errore</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
    finally {
        // Nascondi animazione di loading in ogni caso
        setLoading(false);
    }
});

// Funzioni helper
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Token mancante!");
    return fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
        },
    });
}

async function getProfile() {
    const response = await authenticatedFetch(`${API_BASE}/profilo`);
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Non autorizzato. Il token non è valido.");
        }
        const data = await response.json();
        throw new Error(data.detail || "Errore sconosciuto");
    }
    return response.json();
}

function normalizeWalletAddress(addr) {
    if (!addr) return "";
    return addr.trim().toLowerCase();
}

function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        "raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 200000, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("wallet-db", 1);
        request.onerror = () => reject("Errore apertura IndexedDB");
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("encrypted_keys")) {
                db.createObjectStore("encrypted_keys", { keyPath: "walletId" });
            }
        };
    });
}




async function pdfDownload(tx_id, blockchain) {
    try {
        const response = await authenticatedFetch(`${API_BASE}/certificate/${blockchain}/${tx_id}`);
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        // Download logic...
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate_${tx_id}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        console.log(' PDF scaricato con successo');
        
    } catch (error) {
        console.error(' Errore nel download PDF:', error);
        throw error;
    }
}


// Configurazione PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Funzione per estrarre campi dal testo PDF 
function extractFieldsFromPDF(text) {
    const patterns = {
        'ID': /ID:\s*([a-f0-9\s]+?)(?=\s*BlockID:|$)/i,
        'BlockID': /BlockID:\s*(\d+)/i,
        'From': /From:\s*([a-f0-9\s]+?)(?=\s*To:|$)/i,
        'To': /To:\s*([a-f0-9\s]+?)(?=\s*NodeID:|$)/i,
        'NodeID': /NodeID:\s*([a-f0-9\s]+?)(?=\s*Timestamp:|$)/i,
        'Timestamp': /Timestamp:\s*([\d:\-]+)/i,
        'Type': /Type:\s*([A-Z_]+)/i,
        'Status': /Status:\s*(\w+)/i,
        'Payload': /Payload:\s*([a-f0-9\s]+?)(?=\s*OSignature:|$)/i,
        'OSignature': /OSignature:\s*([a-f0-9\s]+?)(?=\s*Page|$)/i
    };
    
    const fields = {};
    const cleanText = text.replace(/\n/g, ' ');
    
    for (const [field, pattern] of Object.entries(patterns)) {
        const match = cleanText.match(pattern);
        if (match) {
            const value = field !== 'Timestamp' 
                ? match[1].replace(/\s+/g, '') 
                : match[1];
            fields[field] = value;
        }
    }
    
    return fields;
}

// Funzione per estrarre testo da PDF usando PDF.js
async function extractTextFromPDF(file) {
    try {
        // Converti file in ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Carica il PDF con PDF.js
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        let fullText = '';
        
        // Estrai testo da tutte le pagine
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Combina tutti gli elementi di testo
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + ' ';
        }
        
        return fullText.trim();
    } catch (error) {
        console.error('Errore nell\'estrazione del testo dal PDF:', error);
        throw error;
    }
}


// Gestione upload file PDF
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('parentFiles');
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    const fileListDiv = document.getElementById('fileList');
    const extractedIdsDiv = document.getElementById('extractedIds');
    const idListDiv = document.getElementById('idList');
    const useIdsButton = document.getElementById('useExtractedIds');
    const parentsTextarea = document.getElementById('parents');
    
    let extractedTransactionIds = [];

    fileInput.addEventListener('change', async function(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) {
            uploadedFilesDiv.style.display = 'none';
            extractedIdsDiv.style.display = 'none';
            return;
        }

        // Mostra sezione file caricati
        uploadedFilesDiv.style.display = 'block';
        fileListDiv.innerHTML = '';
        extractedTransactionIds = [];

        console.log(`Elaborazione di ${files.length} file PDF...`);

        for (const file of files) {
            await processFile(file);
        }

        // Mostra ID estratti se ce ne sono
        if (extractedTransactionIds.length > 0) {
            displayExtractedIds();
        }
    });

    async function processFile(file) {
        try {
            // Aggiungi file alla lista
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item mb-2 p-2 border rounded';
            fileItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <span> ${file.name}</span>
                    <span class="badge badge-info" id="status-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}">Elaborazione...</span>
                </div>
            `;
            fileListDiv.appendChild(fileItem);

            // Estrai testo dal PDF usando PDF.js
            console.log(`Estrazione testo da ${file.name}...`);
            const text = await extractTextFromPDF(file);
            
            console.log(` Testo estratto da ${file.name} (primi 200 caratteri):`, text.substring(0, 200) + '...');
            
            // Estrai campi usando le regex
            const fields = extractFieldsFromPDF(text);
            
            const statusId = `status-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const statusSpan = document.getElementById(statusId);
            
            if (fields.ID) {
                const transactionId = fields.ID;
                const BlockID= fields.BlockID ;
                const certificate= transactionId+"-"+BlockID;
                extractedTransactionIds.push(certificate);
                
                // Aggiorna status
                statusSpan.textContent = ' ID estratto';
                statusSpan.className = 'badge badge-success';
                
                console.log(`✅ ID estratto da ${file.name}: ${certificate}`);
            } else {
                // Aggiorna status - errore
                statusSpan.textContent = ' ID non trovato';
                statusSpan.className = 'badge badge-danger';
                
                console.warn(` Nessun ID trovato in ${file.name}`);
                console.log('Testo completo per debug:', text);
            }

        } catch (error) {
            console.error(`Errore nell'elaborazione di ${file.name}:`, error);
            
            const statusId = `status-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const statusSpan = document.getElementById(statusId);
            if (statusSpan) {
                statusSpan.textContent = ' Errore';
                statusSpan.className = 'badge badge-danger';
            }
        }
    }

    function displayExtractedIds() {
        extractedIdsDiv.style.display = 'block';
        
        // Aggiungi prefisso 0x se non presente
        const formattedIds = extractedTransactionIds.map(id => 
            id.startsWith('0x') ? id : `0x${id}`
        );
        
        idListDiv.innerHTML = `
            <strong>Transaction ID trovati (${formattedIds.length}):</strong><br>
            ${formattedIds.map(id => `<code>${id}</code>`).join('<br>')}
        `;
    }

    // Gestione click "Usa questi ID"
    useIdsButton.addEventListener('click', function() {
        const formattedIds = extractedTransactionIds.map(id => 
            id.startsWith('0x') ? id : `0x${id}`
        );
        
        // Ottieni valore corrente del textarea
        const currentValue = parentsTextarea.value.trim();
        
        if (currentValue) {
            // Se c'è già del contenuto, aggiungi virgola
            parentsTextarea.value = currentValue + ', ' + formattedIds.join(', ');
        } else {
            // Se è vuoto, aggiungi solo gli ID
            parentsTextarea.value = formattedIds.join(', ');
        }
        
        // Mostra messaggio di conferma
        const button = useIdsButton;
        const originalText = button.textContent;
        button.textContent = 'ID aggiunti!';
        button.className = 'btn btn-sm btn-success';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.className = 'btn btn-sm btn-success';
        }, 2000);
        
        console.log(`Aggiunti ${formattedIds.length} Transaction ID al campo parents`);
    });
});
