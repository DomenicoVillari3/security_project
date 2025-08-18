const API_BASE = "http://127.0.0.1:8000"; // URL backend
const base_url = "http://localhost:8000"; // URL base per reindirizzamenti

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

// Controllo autenticazione
function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Accesso negato. Effettua il login.");
    window.location.href = `${base_url}/login`;
    return null;
  }
  return token;
}

// Logout
function logout() {
  localStorage.removeItem("token");
  window.location.href = `${base_url}/login`;
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
  if (!checkAuth()) {
    console.error("Token mancante o non valido");
    return;
  }

  try {
    const data = await getProfile();
    profile_section=document.getElementById("profile-data")
    if (profile_section){
        profile_section.textContent = JSON.stringify(data.utente || data, null, 2);
    }
    
    document.getElementById("dashboard-content").style.display = "block";
    
    
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
