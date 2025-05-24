// ui.js
let contacts = [];
let sentCount = 0;
let failCount = 0;
let isProcessing = false;

document.getElementById("fileInput").addEventListener("change", handleFileUpload);
document.getElementById("previewBtn").addEventListener("click", previewMessages);
document.getElementById("sendBtn").addEventListener("click", startSending);
document.getElementById("scheduleBtn").addEventListener("click", scheduleMessages);

// Listen for send results from parent window (WhatsApp Web page)
window.addEventListener('message', function(event) {
  if (event.data.type === 'SEND_RESULT') {
    const { success, phone, error } = event.data;
    
    if (success) {
      sentCount++;
      console.log(`✅ Successfully sent to ${phone}`);
      updateStats(`✅ Sent to ${phone}`);
    } else {
      failCount++;
      console.error(`❌ Failed to send to ${phone}: ${error}`);
      updateStats(`❌ Failed: ${phone} - ${error}`);
    }
  }
});

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return alert("Please select a CSV file.");

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");

    if (lines.length <= 1) {
      alert("The CSV file has no data.");
      return;
    }

    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const phoneIndex = header.indexOf("phone");
    const nameIndex = header.indexOf("name");
    const messageIndex = header.indexOf("message");

    if (phoneIndex === -1 || nameIndex === -1 || messageIndex === -1) {
      alert("CSV must have 'phone', 'name', and 'message' columns.");
      return;
    }

    contacts = lines.slice(1).map(line => {
      const cols = line.split(",");
      return {
        phone: cols[phoneIndex]?.trim(),
        name: cols[nameIndex]?.trim(),
        message: cols[messageIndex]?.trim()
      };
    }).filter(c => c.phone && c.message);

    console.log("Parsed contacts:", contacts);
    alert(`Parsed ${contacts.length} contacts successfully.`);
    updateStats(`Loaded ${contacts.length} contacts`);
  };

  reader.readAsText(file);
}

function previewMessages() {
  const preview = document.getElementById("previewArea");
  if (!contacts.length) {
    preview.innerHTML = "<p>No contacts found. Upload a valid CSV first.</p>";
    return;
  }

  preview.innerHTML = contacts.map((c, i) => {
    const msg = c.message.replace(/{{name}}/gi, c.name);
    return `<p><strong>${i + 1}:</strong> To ${c.phone} — ${msg}</p>`;
  }).join("");

  console.log("Preview rendered.");
  updateStats("Messages previewed");
}

async function startSending() {
  if (!contacts.length) return alert("No contacts loaded.");
  if (isProcessing) return alert("Already processing messages. Please wait...");

  isProcessing = true;
  sentCount = 0;
  failCount = 0;
  updateStats("Starting to send messages...");

  const minDelay = parseInt(document.getElementById("minDelay").value) || 5;
  const maxDelay = parseInt(document.getElementById("maxDelay").value) || 15;

  // Disable send button during processing
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;
  sendBtn.textContent = "🔄 Sending...";

  try {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const msg = contact.message.replace(/{{name}}/gi, contact.name);
      
      updateStats(`Sending to ${contact.phone} (${i + 1}/${contacts.length})`);
      
      // Send message to parent window (WhatsApp Web page)
      simulateSend(contact.phone, msg);
      
      // Wait for delay between messages (except for last message)
      if (i < contacts.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
        updateStats(`Waiting ${Math.round(delay/1000)}s before next message...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    updateStats(`Completed! Sent: ${sentCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error("Error during sending:", error);
    updateStats(`Error: ${error.message}`);
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "🚀 Start Sending";
  }
}

function scheduleMessages() {
  if (!contacts.length) return alert("No contacts loaded.");
  
  const delay = prompt("Enter delay in minutes to start sending:");
  if (!delay || isNaN(delay)) return;

  const timeInMs = Date.now() + parseInt(delay) * 60000;
  const alarmName = "send_message_" + JSON.stringify({ when: timeInMs });
  
  chrome.runtime.sendMessage({ 
    type: "SCHEDULE_ALARM", 
    alarmName, 
    delay: parseInt(delay) 
  });
  
  alert(`Messages scheduled to start in ${delay} minutes.`);
  updateStats(`Scheduled for ${delay} minutes from now`);
}

function updateStats(msg) {
  document.getElementById("sentCount").textContent = sentCount;
  document.getElementById("failCount").textContent = failCount;
  document.getElementById("statusMsg").textContent = msg;
}

// Send message to parent window (WhatsApp Web page)
function simulateSend(phone, message) {
  console.log(`Requesting send to ${phone}: ${message}`);
  
  // Send message to parent window via postMessage
  window.parent.postMessage({
    type: 'SEND_MESSAGE',
    phone: phone,
    message: message
  }, '*');
}

// Add some utility functions for better UX
function clearLogs() {
  sentCount = 0;
  failCount = 0;
  updateStats("Logs cleared");
}

function exportResults() {
  if (sentCount === 0 && failCount === 0) {
    alert("No results to export.");
    return;
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    totalContacts: contacts.length,
    sentCount: sentCount,
    failCount: failCount,
    successRate: ((sentCount / (sentCount + failCount)) * 100).toFixed(2) + '%'
  };
  
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whatsblitz-results-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Initialize UI
document.addEventListener('DOMContentLoaded', function() {
  updateStats("Ready - Upload CSV to begin");
  console.log("WhatsBlitz UI loaded successfully");
});

// Handle extension errors
window.addEventListener('error', function(event) {
  console.error('UI Error:', event.error);
  updateStats(`Error: ${event.error.message}`);
});

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
  if (event.ctrlKey || event.metaKey) {
    switch(event.key) {
      case 'p':
        event.preventDefault();
        previewMessages();
        break;
      case 'Enter':
        event.preventDefault();
        if (!isProcessing) startSending();
        break;
    }
  }
});
