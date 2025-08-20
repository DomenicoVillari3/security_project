
// IMPORTANTE: CircularProtocolAPI è un OGGETTO, non una funzione!
// Non fare: new CircularProtocolAPI() 
// Fai semplicemente: CircularProtocolAPI

// Funzione di firma usando CircularProtocolAPI
function signTransaction(hashid, privateKeyHex) {
    try {
        console.log('🔢 Hash per firma:', hashid);
        console.log('🔑 Private key (primi 10 char):', privateKeyHex.substring(0, 10) + '...');
        
        // Usa la funzione signMessage di CircularProtocolAPI
        // Rimuovi 0x se presente
        const cleanHash = CircularProtocolAPI.hexFix(hashid);
        const cleanPrivateKey = CircularProtocolAPI.hexFix(privateKeyHex);
        
        // Firma usando CircularProtocolAPI (ritorna DER format)
        const signature = CircularProtocolAPI.signMessage(cleanHash, cleanPrivateKey);
        
        console.log('✅ Firma generata (DER format):', signature.substring(0, 20) + '...');
        console.log('🔍 Lunghezza firma:', signature.length);
        
        return signature;
        
    } catch (error) {
        console.error('❌ Errore nella firma:', error);
        throw new Error('Errore nella firma: ' + error.message);
    }
}

// Funzione per firmare con chiave memorizzata
async function signWithStoredKey(walletAddress, hashid, passphrase) {
    try {
        console.log('🔍 Cercando chiave per wallet:', walletAddress);
        
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
        
        console.log('🔍 Chiave trovata per wallet:', walletAddress, !!result);
        
        // Decifratura
        console.log('🔓 Decifratura chiave privata...');
        const salt = base64ToUint8Array(result.salt);
        const iv = base64ToUint8Array(result.iv);
        const ciphertext = base64ToUint8Array(result.ciphertext);
        
        console.log('✍️ Firma in corso...');
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
        console.log('🧹 Memoria privata azzerata');
        
        return signature;
        
    } catch (error) {
        console.error('❌ Errore in signWithStoredKey:', error);
        throw new Error('Errore nella firma: ' + error.message);
    }
}

// Gestione submit form
document.getElementById('stepForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
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
        certification: form.certification.value.trim(),
        notes: form.notes.value.trim()
    };

    try {
        // 1) Build transaction
        console.log('📝 Preparazione transazione...');
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
        console.log('✅ Transazione preparata, hashid:', hashid);

        // 2) Chiedi passphrase
        const passphrase = prompt("Inserisci la passphrase per firmare la transazione:");
        if (!passphrase) {
            alert("Passphrase richiesta per firmare");
            return;
        }

        // 3) Ottieni wallet address
        console.log('👤 Recupero profilo utente...');
        const data = await getProfile();
        const profile = data.utente || data;
        const walletAddress = normalizeWalletAddress(profile.wallet_addr);
        console.log('🔑 Wallet address:', walletAddress);

        // 4) Firma con chiave decifrata
        console.log('✍️ Firma della transazione...');
        var signature = await signWithStoredKey(walletAddress, hashid, passphrase);
        console.log('✅ Firma completata:', signature.substring(0, 20) + '...');

        // 5) Submit della transazione firmata
        console.log('📡 Invio transazione...');
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
            document.getElementById('result').innerHTML = `
                <div class="alert alert-success">
                    <h4>✅ Transazione inviata con successo!</h4>
                    <p><strong>TxID:</strong> ${result.Response?.TxID || 'N/A'}</p>
                    <p><strong>Timestamp:</strong> ${result.Response?.Timestamp || 'N/A'}</p>
                    <p><strong>Node:</strong> ${result.Node || 'N/A'}</p>
                </div>
            `;
        } else {
            const errorData = await submitResponse.json();
            throw new Error(errorData.detail || "Errore durante l'invio");
        }

    } catch (error) {
        console.error('❌ Errore:', error);
        document.getElementById('result').innerHTML = `
            <div class="alert alert-danger">
                <h4>❌ Errore</h4>
                <p>${error.message}</p>
            </div>
        `;
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
