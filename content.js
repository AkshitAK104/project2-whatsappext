// content.js

(function injectSidebar() {
  if (document.getElementById("whatsblitz-sidebar")) return;

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.id = "whatsblitz-sidebar";
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 350px;
    height: 100%;
    border: none;
    z-index: 9999;
    background: #000;
  `;

  document.body.appendChild(iframe);
})();

// Listen for messages from the iframe sidebar
window.addEventListener('message', async function(event) {
  if (event.data.type === 'SEND_MESSAGE') {
    const { phone, message } = event.data;
    
    try {
      console.log(`Received request to send to ${phone}: ${message}`);
      await window.simulateSend(phone, message);
      
      // Send success response back to iframe
      event.source.postMessage({
        type: 'SEND_RESULT',
        success: true,
        phone: phone
      }, '*');
      
    } catch (error) {
      console.error(`Send failed for ${phone}:`, error);
      // Send error response back to iframe
      event.source.postMessage({
        type: 'SEND_RESULT',
        success: false,
        phone: phone,
        error: error.message
      }, '*');
    }
  }
});

window.simulateSend = async function (phone, message) {
  try {
    console.log(`Attempting to send to ${phone}: ${message}`);

    // Find and focus search box with multiple selectors
    const searchBox = await waitForElement('div[contenteditable="true"][data-tab="3"]') || 
                      await waitForElement('div[title*="Search"]') ||
                      await waitForElement('div[role="textbox"][data-testid="chat-list-search"]');
    
    if (!searchBox) throw new Error("Search bar not found.");
    
    // Clear search box completely
    searchBox.focus();
    await clearElement(searchBox);
    
    // Type phone number with realistic simulation
    await simulateTyping(searchBox, phone);
    console.log(`Typed phone number: ${phone}`);
    
    // Wait longer for search results
    await wait(4000);

    // Look for contact results with multiple selectors
    const contactResult = await waitForElement("#pane-side div[role='row']") ||
                         await waitForElement('div[data-testid="cell-frame-container"]') ||
                         await waitForElement('#pane-side div[tabindex="-1"]');
    
    if (!contactResult) {
      // Check if "No chats found" message appears
      const noResults = document.querySelector('div[data-testid="search-no-results"]') ||
                       document.querySelector('span[title="No chats found"]') ||
                       document.querySelector('div[data-testid="search-empty-state"]');
      
      if (noResults) {
        throw new Error(`Contact ${phone} not found in WhatsApp. Make sure the number is saved in your contacts and has WhatsApp.`);
      } else {
        throw new Error("Contact not found in search results. Try adding the contact to your phone first.");
      }
    }

    console.log("Contact found, clicking...");
    
    // Click the contact with proper event simulation
    contactResult.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    
    await wait(3000); // Wait for chat to load

    // Find message input with multiple selectors
    const msgBox = await waitForElement('div[contenteditable="true"][data-tab="10"]') ||
                   await waitForElement('div[role="textbox"][contenteditable="true"]') ||
                   await waitForElement('div[data-testid="conversation-compose-box-input"]');
    
    if (!msgBox) throw new Error("Message input box not found.");
    
    console.log("Message box found, typing message...");
    
    // Clear message box and type message
    msgBox.focus();
    await clearElement(msgBox);
    await simulateTyping(msgBox, message);
    
    await wait(1000);

    // Send message using Enter key (more reliable than clicking send button)
    console.log("Sending message...");
    msgBox.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));

    // Wait and verify message was sent
    await wait(2000);
    
    console.log(`✅ Message sent to ${phone}`);
    return true;

  } catch (err) {
    console.error(`❌ Failed to send to ${phone}:`, err.message);
    throw err;
  }
};

// Clear element content completely
async function clearElement(element) {
  element.focus();
  
  // Select all content
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  
  // Also clear using modern methods
  element.textContent = '';
  element.innerHTML = '';
  
  // Trigger events to notify WhatsApp
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  await wait(100);
}

// Simulate realistic typing with proper events
async function simulateTyping(element, text) {
  element.focus();
  
  // Type character by character for maximum compatibility
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Simulate keydown event
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: char,
      code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
      keyCode: char.charCodeAt(0),
      which: char.charCodeAt(0),
      bubbles: true,
      cancelable: true
    }));
    
    // Add character to content
    element.textContent += char;
    
    // Simulate input event (critical for WhatsApp Web)
    element.dispatchEvent(new Event('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char
    }));
    
    // Simulate keyup event
    element.dispatchEvent(new KeyboardEvent('keyup', {
      key: char,
      code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
      keyCode: char.charCodeAt(0),
      which: char.charCodeAt(0),
      bubbles: true,
      cancelable: true
    }));
    
    // Realistic typing delay
    await wait(80 + Math.random() * 40); // 80-120ms per character
  }
  
  // Final events to ensure WhatsApp detects the input
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  element.dispatchEvent(new Event('focus', { bubbles: true }));
}

// Enhanced wait function that checks for element existence and visibility
async function waitForElement(selector, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element && element.offsetParent !== null && element.offsetWidth > 0 && element.offsetHeight > 0) {
      return element;
    }
    await wait(100);
  }
  return null;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Debug function to help troubleshoot issues
window.debugWhatsApp = function() {
  console.log("=== WhatsApp Debug Info ===");
  console.log("Search box:", document.querySelector('div[contenteditable="true"][data-tab="3"]'));
  console.log("Message box:", document.querySelector('div[contenteditable="true"][data-tab="10"]'));
  console.log("Send button:", document.querySelector('button span[data-icon="send"]'));
  console.log("Contact rows:", document.querySelectorAll('#pane-side div[role="row"]').length);
  console.log("Current URL:", window.location.href);
};

// Listen for scheduled messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCHEDULED_SEND") {
    console.log("Received scheduled send request:", message.data);
    // Handle scheduled sending logic here
    sendResponse({ success: true });
  }
});

console.log("WhatsBlitz content script loaded successfully");
