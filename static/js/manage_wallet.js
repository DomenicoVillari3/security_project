var elem = document.getElementById("privateKeyDisplay");
var wallet_address_elem= document.getElementById("currentWalletAddress");
var publicKeyElem = document.getElementById("currentPublicKey");


checkPKExists();

async function checkPKExists() {
  try {
    
    var wallet=await checkWalletExists();
    console.log("Wallet address:", wallet);
    if (!wallet) {
      elem.innerHTML = "<h6>Non hai ancora creato un wallet, <a href='https://circularlabs.io/page?page=Transactions'>richiedine uno</a>.</h6>";
      return false;
    }


    const db = await openDB();
    const tx = db.transaction("encrypted_keys", "readonly");
    const store = tx.objectStore("encrypted_keys");
    const request = store.get(wallet);

    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject("Errore nel recupero della chiave");
    });

    if (!result) {
      elem.innerHTML = "<h6>Nessuna chiave trovata per questo wallet</h6>";
      return false;
    } else {
      elem.innerHTML = "<h6>Chiave trovata per questo wallet</h6>";
      return true;
    }
  } catch (error) {
    elem.innerHTML = `<h6>Errore ${error}</h6>`;
    return false;
  }
}

async function checkWalletExists() {
    try {
        const profile = await getProfile();
        const walletAddress = normalizeWalletAddress(profile.utente.wallet_addr);
        console.log("Wallet address recuperato:", walletAddress);

        if (!walletAddress) {
        wallet_address_elem.innerHTML = "Wallet address non disponibile, Se non hai ancora creato un wallet <a href='https://circularlabs.io/page?page=Transactions'>richiedine uno</a>.";

        return ;
        }
        else{
        wallet_address_elem.innerHTML = `Wallet address: <strong>${walletAddress}</strong>`;
        publicKeyElem.innerHTML = `Public Key: <strong>${profile.utente.public_key}</strong>`;
        return walletAddress;
        }
    } catch (error) {
        console.error("Errore nel recupero del wallet:", error);
    }

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


function normalizeWalletAddress(addr) {
    if (!addr) return "";
    return addr.trim().toLowerCase();
}