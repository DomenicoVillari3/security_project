document.getElementById("walletForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const walletAddress = document.getElementById("walletAddressInput").value.trim();
    if (!walletAddress) {
        alert("Inserisci un indirizzo wallet valido.");
        return;
    }
    const public_key = document.getElementById("publicKeyInput").value.trim();
    if (!public_key) {
        alert("Inserisci una chiave pubblica valida.");
        return;
    }

    try {
        const profile = await getProfile();
        const response = await authenticatedFetch(`${API_BASE}/user/update_wallet`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${profile.token}`
            },
            body: JSON.stringify({ wallet_addr: walletAddress, public_key: public_key })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Errore sconosciuto durante l'aggiornamento del wallet");
        }
        const data = await response.json();
        alert("Wallet aggiornato con successo!");
        wallet_address_elem.innerHTML = `Wallet address: <strong>${data.wallet_addr}</strong>`;
        publicKeyElem.innerHTML = `Public Key: <strong>${data.public_key}</strong>`;
    } catch (error) {
        console.error("Errore durante l'aggiornamento del wallet:", error);
        alert("Errore: " + error.message);
    }
    
});

    
