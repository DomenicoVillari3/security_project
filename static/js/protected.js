const API_BASE = "http://localhost:8000"; // URL backend

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

/// Funzione per validare il token con il backend
async function validateToken() {
    const token = localStorage.getItem("token");
    if (!token) return false;
    
    try {
        const response = await fetch(`${API_BASE}/auth/validate_token`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        
        return response.ok; // true se 200, false se 401 o altro errore
    } catch (error) {
        console.error("Errore validazione token:", error);
        return false;
    }
}

// Controllo autenticazione migliorato
async function checkAuth() {
    const isValid = await validateToken();
    if (!isValid) {
        // Token mancante o non valido - rimuovi e reindirizza
        localStorage.removeItem("token");
        window.location.href = `${API_BASE}/login`;
        return false;
    }
    return true;
}



// Logout
// Logout
async function logout() {
  try {
    const response = await authenticatedFetch(`${API_BASE}/auth/logout`, {
      method: "POST"
    });

    if (!response.ok) {
      console.error("Errore durante il logout:", response.statusText);
      return;
    }

    // Rimuovi il token e reindirizza al login
    localStorage.removeItem("token");
    window.location.href = `${API_BASE}/login`;
  } catch (error) {
    console.error("Errore di rete durante il logout:", error);
  }
}

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

// Mostra dati nel DOM
async function loadProfile() {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        console.error("Token non valido o mancante");
        return;
    }


  try {
    const data = await getProfile();
    profile_section=document.getElementById("profile-data")
    if (profile_section){
        profile_section.textContent = JSON.stringify(data.utente || data, null, 2);
    }
    
    document.getElementById("dashboard-content").style.display = "block";
    console.log("Dati profilo caricati:", data.utente.nome);
  
    document.getElementById("span_user").innerHTML = data.utente.nome|| 'Utente';
    document.getElementById("userimg").src = data.utente.profile_picture || "static/css/undraw_profile.svg";

    
  } catch (err) {
    console.error("Errore profilo:", err);
    alert(err.message);
    if (err.message.includes("Non autorizzato")) {
      logout();
    }
  }
}

// All’avvio

window.addEventListener("load", loadProfile);
