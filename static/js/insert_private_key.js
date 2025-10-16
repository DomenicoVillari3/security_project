//const API_BASE = "http://localhost:8000"; // URL backend

//Converte un ArrayBuffer (bytes) in base64 per poterlo salvare/serializzare facilmente
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Converte una stringa base64 in un Uint8Array (bytes)
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Converte una stringa esadecimale (con o senza "0x") in Uint8Array
function hexToUint8Array(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const length = hex.length / 2;
  const uint8 = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    uint8[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return uint8;
}

// Deriva chiave AES da passphrase e salt con PBKDF2
// Derivazione chiave con PBKDF2
// Dato passphrase (stringa) + salt (bytes) deriva una chiave AES-GCM 256.
// Iterazioni alte (200k) per rallentare gli attacchi a forza bruta.
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 200000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return key;
}

// Cifra la chiave privata con AES-GCM
// Cifratura della private key con AES-GCM
// Restituisce: ciphertext (base64), salt (base64), iv (base64), version, created_at
async function encryptPrivateKey(privateKeyUint8, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    privateKeyUint8
  );
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    version: "1.0",
    created_at: new Date().toISOString()
  };
}

// IndexedDB: apertura connessione e store
// --- IndexedDB: apertura DB e object store ---
// Crea "wallet-db" (v1) e uno store "encrypted_keys" con keyPath "id"
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("wallet-db", 1);
        request.onerror = () => reject("Errore apertura IndexedDB");
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("encrypted_keys")) {
                // CAMBIA DA "id" A "walletId"
                db.createObjectStore("encrypted_keys", { keyPath: "walletId" });
            }
        };
    });
}



// Salvataggio dell’oggetto in IndexedDB
// Salva/aggiorna (put) la chiave cifrata nello store, usando il walletId come primary key
// In insert_private_key.js
async function saveEncryptedKey(walletId, encryptedObj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("encrypted_keys", "readwrite");
        const store = tx.objectStore("encrypted_keys");
        const dataToSave = { walletId: walletId, ...encryptedObj };  // walletId, non id
        const request = store.put(dataToSave);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject("Errore durante il salvataggio");
    });
}



// Gestione submit form
// --- Gestione submit del form di import ---
// 1) blocca il submit classico
// 2) valida input
// 3) converte la private key in bytes (hex o base64)
// 4) cifra con AES-GCM (passphrase -> PBKDF2 -> chiave AES)
// 5) salva tutto in IndexedDB
document.getElementById("importKeyForm").addEventListener("submit", async function (event) {
  event.preventDefault();
  
  const privateKeyInput = document.getElementById("privateKeyInput").value.trim();
  const passphraseInput = document.getElementById("passphrase").value;

  if (!privateKeyInput) {
    document.getElementById("privateKeyHelp").textContent = "Inserisci la private key!";
    return;
  }
  if (!passphraseInput || passphraseInput.length < 8) {
    document.getElementById("privateKeyHelp").textContent = "La passphrase deve avere almeno 8 caratteri!";
    return;
  }

  try {
    // Converti private key da hex o base64 a Uint8Array
    let privateKeyUint8;
    if (/^(?:0x)?[0-9a-fA-F]+$/.test(privateKeyInput)) {
      privateKeyUint8 = hexToUint8Array(privateKeyInput);
    } else {
      // Assume base64 se non hex
      privateKeyUint8 = base64ToUint8Array(privateKeyInput);
    }

    // Cifra la chiave
    const encryptedObj = await encryptPrivateKey(privateKeyUint8, passphraseInput);

  
    const profile = await getProfile();
    const walletAddress = normalizeWalletAddress(profile.utente.wallet_addr);
    console.log("Salvataggio chiave per wallet:", walletAddress);// AGGIUNGI QUESTO LOG

    // Salva cifrato in IndexedDB
    await saveEncryptedKey(walletAddress, encryptedObj);

    // Azzeramento chiave in memoria
    privateKeyUint8.fill(0);

    document.getElementById("privateKeySuccess").style.display = "block";
    console.log("Private key cifrata e salvata con successo per wallet:", walletAddress);
    document.getElementById("privateKeyError").style.display = "none";
    
  } catch (error) {
    document.getElementById("privateKeySuccess").style.display = "none";
    document.getElementById("privateKeyError").textContent = "Errore: " + error.message;
    document.getElementById("privateKeyError").style.display = "block";
    
  }

});


// Recupera solo i dati profilo 
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


// Wrapper per fetch autenticato
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


function normalizeWalletAddress(addr) {
    if (!addr) return "";
    return addr.trim().toLowerCase();
}
