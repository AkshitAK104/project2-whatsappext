// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("WhatsBlitz installed and ready.");
});

// Listen for scheduled alarms to trigger sending
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("send_message_")) {
    const messageData = JSON.parse(alarm.name.replace("send_message_", ""));
    // Message sending logic will be injected from content script
    chrome.runtime.sendMessage({ type: "SCHEDULED_SEND", data: messageData });
  }
});
