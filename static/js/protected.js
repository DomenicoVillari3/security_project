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
    const profile_section = document.getElementById("profile-data");

    if (profile_section) {
        const userData = data.utente || data;
        
        // Funzione per formattare la data
        function formatDate(dateString) {
            if (!dateString) return '<span class="text-muted">Non disponibile</span>';
            const date = new Date(dateString);
            return date.toLocaleString('it-IT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        

        

        profile_section.innerHTML = `
            <div class="row no-gutters">
                <!-- Colonna sinistra - Informazioni base -->
                <div class="col-md-6">
                    <div class="p-4 border-right">
                        <h6 class="text-primary font-weight-bold mb-3">
                            <i class="fas fa-info-circle mr-1"></i>
                            Informazioni generali
                        </h6>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">ID Utente</label>
                            <div class="h6 mb-0">#${userData.id || 'N/A'}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">Nome</label>
                            <div class="h6 mb-0">${userData.nome || '<span class="text-muted">Non specificato</span>'}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">Ruolo</label>
                            <div>
                                <span class="h6 mb-0">
                                    <i class="fas fa-user-tag mr-1"></i>
                                    ${userData.ruolo || 'Non specificato'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">Email</label>
                            <div class="h6 mb-0">
                                ${userData.email ? `<i class="fas fa-envelope mr-1 text-muted"></i>${userData.email}` : '<span class="text-muted">Non disponibile</span>'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Colonna destra - Informazioni blockchain -->
                <div class="col-md-6">
                    <div class="p-4">
                        <h6 class="text-primary font-weight-bold mb-3">
                            <i class="fab fa-ethereum mr-1"></i>
                            Informazioni Blockchain
                        </h6>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">Wallet Address</label>
                            <div class="small bg-light p-2 rounded border" style="word-break: break-all; font-family: monospace;">
                                ${userData.wallet_addr || '<span class="text-muted">Non disponibile</span>'}
                            </div>
                           
                        </div>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">Public Key</label>
                            <div class="small bg-light p-2 rounded border" style="word-break: break-all; font-family: monospace;">
                                ${userData.public_key || '<span class="text-muted">Non disponibile</span>'}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="text-gray-600 small font-weight-bold text-uppercase">Data registrazione utente</label>
                            <div class="h6 mb-0">
                                <i class="fas fa-calendar mr-1 text-muted"></i>
                                ${formatDate(userData.data_creazione_wallet)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Sezione autenticazione -->
            <div class="border-top bg-light px-4 py-3">
                <h6 class="text-primary font-weight-bold mb-2">
                    <i class="fas fa-shield-alt mr-1"></i>
                    Autenticazione
                </h6>
                <div class="row">
                    <div class="col-md-6">
                        <small class="text-gray-600 font-weight-bold text-uppercase">Google ID</small>
                        <div class="small">${userData.google_id || '<span class="text-muted">Non collegato</span>'}</div>
                    </div>
                    <div class="col-md-6">
                        <small class="text-gray-600 font-weight-bold text-uppercase">Foto profilo</small>
                        <div class="small">${userData.profile_picture ? '<span class="text-success">Impostata</span>' : '<span class="text-muted">Non impostata</span>'}</div>
                    </div>
                </div>
            </div>
        `;
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
