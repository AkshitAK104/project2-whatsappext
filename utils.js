// utils.js

export function replacePlaceholders(template, data) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || "");
}

export function logMessage(contact, status) {
  const logs = JSON.parse(localStorage.getItem("messageLogs") || "[]");
  logs.push({
    phone: contact.phone,
    name: contact.name,
    status,
    time: new Date().toISOString()
  });
  localStorage.setItem("messageLogs", JSON.stringify(logs));
}

export function exportLogsAsCSV() {
  const logs = JSON.parse(localStorage.getItem("messageLogs") || "[]");
  if (!logs.length) return alert("No logs to export.");

  const header = "Phone,Name,Status,Time";
  const rows = logs.map(log => `${log.phone},${log.name},${log.status},${log.time}`);
  const csvContent = [header, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "whatsblitz_logs.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function getStats() {
  const logs = JSON.parse(localStorage.getItem("messageLogs") || "[]");
  const sent = logs.filter(l => l.status === "Success").length;
  const failed = logs.filter(l => l.status === "Failed").length;
  return { sent, failed, total: logs.length };
}
