const API_BASE = "http://127.0.0.1:8000";

// Bind event al caricamento pagina
window.onload = function () {
    document.getElementById("login_button").addEventListener("click", loginProcedure);
};

// Funzione di login
async function loginProcedure() {
    // Recupero valori form
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // In questo backend, la password viene hashata lato server,
    // quindi la inviamo in chiaro via HTTPS (non serve la parte sha256 qui).
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            // Salva token JWT in localStorage
            localStorage.setItem("token", data.access_token);
            // Reindirizza alla dashboard
            window.location.href = "dashboard.html";
        } else {
            // Mostra errore API nella pagina
            const divElement = document.getElementById("messaggio_errore");
            divElement.className = "alert alert-danger";
            divElement.textContent = data.detail || "Credenziali non valide";
        }
    } catch (error) {
        // Mostra eventuali errori di rete
        const divElement = document.getElementById("messaggio_errore");
        divElement.className = "alert alert-danger";
        divElement.textContent = "Errore di rete: " + error.message;
    }
}
