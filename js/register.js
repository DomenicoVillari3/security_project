const API_BASE = "http://127.0.0.1:8000";


//variabili associate agli elementi del form
const emailInput = document.getElementById('reg-email');
const passwordInput = document.getElementById('reg-password');
const repeatPassword = document.getElementById('reg-password-confirm');
const form = document.getElementById('register');


//validazione in tempo reale della mail
emailInput.addEventListener('input', function(event) {
  const email = event.target.value;
  if (validateEmail(email)) {
    // Email valida
    emailInput.style.border = '1px solid #d1d3e2';
  } else {
    // Email non valida
    emailInput.style.border = '2px solid red';
  }
});

//funzione per la validazione della mail
function validateEmail(email) {
  // Utilizza un'espressione regolare per la validazione dell'email
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})$/;
  return emailRegex.test(email);
}

//controllo sul campo repeatpassword per vedere che sia uguale al campo password
repeatPassword.addEventListener('input', function(event) {
    const passw = event.target.value;
    const mainPassword = passwordInput.value;

    if (passw !== mainPassword) {
        repeatPassword.style.border = '2px solid red';
    } else {
        repeatPassword.style.border = '1px solid #d1d3e2';
    }
});

passwordInput.addEventListener('input', function(event) {
    const passw = event.target.value;
    const mainPassword = repeatPassword.value;

    if (passw !== mainPassword) {
        repeatPassword.style.border = '2px solid red';
    } else {
        repeatPassword.style.border = '1px solid #d1d3e2';
    }
});

//funzione di validazione della password
function validatePassword(password, repeatPass) {
    return password == repeatPass;
}

async function register() {
    const cognome = document.getElementById("reg-lastname").value;
    const nome = document.getElementById("reg-firstname").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const repeatPass = document.getElementById("reg-password-confirm").value;
    const ruolo = document.getElementById("reg-ruolo").value.toLowerCase();
    console.log(ruolo)
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
        
        console.log(res);

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
