// URL base API
const API_BASE = "http://127.0.0.1:8000";



// Gestione submit form (gestisce solo il body della richiesta)
document.getElementById('stepForm').addEventListener('submit', async function(event) {

    // Blocca il comportamento predefinito dell'evento (es. submit di un form che ricaricherebbe la pagina).
    // Serve per gestire manualmente l'azione con JavaScript (es. inviare i dati via fetch senza refresh).
    event.preventDefault();

    // Prepara i dati dal form
    const selected_blockchain = document.getElementById("blockchain").value;
    const form = event.target;
    const batch_id = form.batch_id.value.trim();
    const type = form.type.value.trim();
    const product = form.product.value.trim();
    const quantity = parseInt(form.quantity.value, 10);
    const unit = form.unit.value.trim();
    const location = form.location.value.trim();
    

    // Converti local datetime a formato ISO8601 con Z timezone (UTC)
    const timestampLocal = form.timestamp.value;
    const timestampISO = new Date(timestampLocal).toISOString();

    const parentsRaw = form.parents.value.trim();
    const parents = parentsRaw ? parentsRaw.split(",").map(s => s.trim()) : [];

    const certification = form.certification.value.trim();
    const notes = form.notes.value.trim();

    const bodyData = {
        batch_id,
        type,
        product,
        quantity,
        unit,
        location,
        timestamp: timestampISO,
        parents,
        certification,
        notes
    };

    try {
        // Invio POST a backend /filiera/step con JSON
        // blockchain è passato come query parameter per tenere pulito il body della richiesta
        /*const response = await authenticatedFetch(`${API_BASE}/filiera/add_step?blockchain=${selected_blockchain}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
        });


        const data = await response.json();

        if (response.ok) {
        document.getElementById('result').textContent = JSON.stringify(data, null, 2);
        } else {
        document.getElementById('result').textContent = "Errore: " + (data.detail || JSON.stringify(data));
        }*/
        console.log(`Invio dati: ${JSON.stringify(bodyData, null, 2)}`);
    } 
    catch (error) {
        document.getElementById('result').textContent = "Errore di rete: " + error.message;
    }
        
    
    
})