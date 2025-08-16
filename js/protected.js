const API_BASE = "http://127.0.0.1:8000"; // Cambia con URL del tuo backend


console.log("TOKEN IN LOCALSTORAGE: ", localStorage.getItem("token"));



// Funzione per effettuare fetch autenticato con token JWT

async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!options.headers) options.headers = {}; 
  options.headers["Authorization"] = "Bearer " + token; // aggiungi header Authorization
  return await fetch(url, options); // effettua la richiesta fetch
}


// Funzione per controllare se l'utente è autenticato, se ha il token salvato
function checkAuth() {
    const token = localStorage.getItem("token"); // legge il token JWT salvato nel browser
    if (!token) {
        window.location.href = "login.html";
        return false;
    }
    return token;
}

// Funzione logout
function logout() {
    localStorage.removeItem("token"); // cancella il token dal browser
    window.location.href = "login.html";
}


// Funzione per caricare il profilo utente
async function loadProfile() {
    const token = checkAuth();
    if (!token) return; // se non è autenticato esce

    try {
         // Chiama l'API protetta /profilo
        const res = await authenticatedFetch(`${API_BASE}/profilo`);
        if (!res) return; // se non c'è risposta, esci

        const data = await res.json();
        if (res.ok) {
            // Popola il contenuto e mostra dashboard
            document.getElementById("profile-data").textContent =
                JSON.stringify(data.utente || data, null, 2);
            
        } else {
            
        }
    } catch (error) {
        showAccessDenied();
    }
}

// Al caricamento pagina: nascondi dashboard e carica dati
window.addEventListener('load', function () {
    loadProfile();
});