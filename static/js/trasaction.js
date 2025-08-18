const API_BASE = "http://127.0.0.1:8000";

    // Funzione per ottenere i parametri dall'URL (query string)
    function getQueryParams() {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        blockchain: urlParams.get('blockchain'),
        tx_id: urlParams.get('tx_id')
      };
    }

    // Mostra i dati ben formattati
    function displayTransactionData(data) {
      document.getElementById("loading").style.display = "none";
      const container = document.getElementById("main-data");
      container.style.display = "block";

      // Puoi personalizzare questa struttura!
      container.innerHTML = `
        <strong>Transazione ID:</strong> <span>${data.ID || data.TxID}</span><br>
        <strong>Tipo:</strong> <span>${data.Type || '-'}</span><br>
        <strong>Mittente:</strong> <span>${data.From || '-'}</span><br>
        <strong>Destinatario:</strong> <span>${data.To || '-'}</span><br>
        <strong>Timestamp:</strong> <span>${data.Timestamp || '-'}</span><br>
        <strong>Signature:</strong> <span>${data.Signature || '-'}</span><br>
        <strong>Blockchain:</strong> <span>${data.Blockchain || '-'}</span><br>
        <strong>Version:</strong> <span>${data.Version || '-'}</span><br>
        <hr>
        <h3>Dettaglio payload</h3>
        <pre>${typeof data.Payload === "string" && data.Payload ? JSON.stringify(JSON.parse(data.Payload), null, 2) : JSON.stringify(data.Payload, null, 2)}</pre>
      `;
    }

    // Entry point
    async function loadTransaction() {
      const params = getQueryParams();
      if (!params.blockchain || !params.tx_id) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("error").textContent = "Parametro blockchain o tx_id mancante!";
        return;
      }
      try {
        const url = `${API_BASE}/filiera/tx/${params.blockchain}/${params.tx_id}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          displayTransactionData(data);
        } else {
          const errData = await res.json();
          document.getElementById("loading").style.display = "none";
          document.getElementById("error").textContent = "Transazione non trovata: " + (errData.detail || "");
        }
      } catch (error) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("error").textContent = "Errore di rete: " + error.message;
      }
    }

    loadTransaction();