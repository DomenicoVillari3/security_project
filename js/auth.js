
// ----- VALIDAZIONE FORM REGISTRAZIONE -----

// Variabili campi form registrazione
const emailInput = document.getElementById('reg-email');
const passwordInput = document.getElementById('reg-password');
const repeatPassword = document.getElementById('reg-password-confirm');

// Validazione email in tempo reale
emailInput?.addEventListener('input', function (event) {
    const email = event.target.value;
    if (validateEmail(email)) {
        emailInput.style.border = '1px solid #d1d3e2';
    } else {
        emailInput.style.border = '5px solid red';
    }
});

// Funzione di validazione email con regex
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})$/;
    return emailRegex.test(email);
}

// Controllo che repeatPassword corrisponda alla password principale
repeatPassword?.addEventListener('input', function (event) {
    const passw = event.target.value;
    const mainPassword = passwordInput.value;

    if (passw !== mainPassword) {
        repeatPassword.style.border = '2px solid red';
    } else {
        repeatPassword.style.border = '5px solid #d1d3e2';
    }
});

function validatePassword(password, repeatPass) {
    return password === repeatPass;
}

// ----- FUNZIONE TOGGLE TRA LOGIN E REGISTRAZIONE -----
function toggleForm() {
    document.getElementById("login-container").style.display =
        document.getElementById("login-container").style.display === "none" ? "block" : "none";
    document.getElementById("register-container").style.display =
        document.getElementById("register-container").style.display === "none" ? "block" : "none";
}

// ----- LOGIN -----
async function login() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.access_token);
            window.location.href = "dashboard.html";
        } else {
            document.getElementById("login-error").textContent = data.detail || "Credenziali non valide";
            document.getElementById("login-error").style.display = "block";
        }
    } catch (error) {
        document.getElementById("login-error").textContent = "Errore di rete: " + error.message;
        document.getElementById("login-error").style.display = "block";
    }
}

// ----- REGISTRAZIONE -----
async function register() {
    const nome = document.getElementById("reg-nome").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const repeatPass = document.getElementById("reg-password-confirm").value;
    const ruolo = document.getElementById("reg-ruolo").value;
    const wallet_address = document.getElementById("reg-wallet").value;

    // Validazione lato client
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password, repeatPass);

    if (!isEmailValid || !isPasswordValid) {
        document.getElementById("register-error").textContent = "Controlla i dati inseriti";
        document.getElementById("register-error").style.display = "block";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, password, ruolo, wallet_address })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.access_token);
            window.location.href = "dashboard.html";
        } else {
            document.getElementById("register-error").textContent = data.detail || "Errore nella registrazione";
            document.getElementById("register-error").style.display = "block";
        }
    } catch (error) {
        document.getElementById("register-error").textContent = "Errore di rete: " + error.message;
        document.getElementById("register-error").style.display = "block";
    }
}
