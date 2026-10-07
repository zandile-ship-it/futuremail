const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzuEqmH4ACEdPxxXcfxSyUjTYT3VL_VPwLUeV-28hU7TKyvoyI0cWRXwn1w_dx9nXsK/exec";
const scheduled = !SCRIPT_URL.startsWith("YOUR_");

  /* ---------- 1. Optional: send-right-now via EmailJS (emailjs.com), used only if SCRIPT_URL is empty ---------- */
const EMAILJS = {
  publicKey:  "YOUR_PUBLIC_KEY",
  serviceId:  "YOUR_SERVICE_ID",
  templateId: "YOUR_TEMPLATE_ID"
};
/* Template variables to use in EmailJS: {{to_name}}, {{to_email}}, {{subject}}, {{open_date}}, {{message}} */

const $ = id => document.getElementById(id);
const statusBox = $("status");
const pad = n => String(n).padStart(2, "0");
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

$("date").min = isoDate(new Date());      // today is allowed, as long as the time is later

if (scheduled) $("sendBtn").textContent = "Seal it for later";

$("message").addEventListener("input", e => $("chars").textContent = e.target.value.length);

function show(msg, type) {
  statusBox.textContent = msg;
  statusBox.className = "status show " + (type || "");
}

function readForm() {
  const data = {
    name: $("name").value.trim() || "friend",
    email: $("email").value.trim(),
    date: $("date").value,
    time: $("time").value || "09:00",
    message: $("message").value.trim()
  };
  if (!data.message) { show("Write a few words in your letter first.", "err"); return null; }
  if (!data.date)    { show("Pick the day you want it to arrive.", "err"); return null; }
  data.when = new Date(`${data.date}T${data.time}`);     // read in the visitor's own time zone
  if (isNaN(data.when) || data.when.getTime() < Date.now() + 5 * 60 * 1000) {
    show("Pick a date and time in the future.", "err"); return null;
  }
  return data;
}

const prettyWhen = d => d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });

/* ---------- 2. Send / schedule the letter ---------- */
$("sendBtn").addEventListener("click", async () => {
  const d = readForm(); if (!d) return;

  if (scheduled) {
    if (!d.email) { show("Add the email address to send it to.", "err"); return; }
    const btn = $("sendBtn"); btn.disabled = true;
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          name: d.name, email: d.email, message: d.message,
          deliverAt: d.when.toISOString(),                           // exact moment, in UTC
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,      // e.g. "Africa/Johannesburg"
          website: $("website").value                                // bot trap, stays empty for real people
        })
      });
      const out = await res.json();
      if (!out.ok) { show(out.error || "Something went wrong.", "err"); return; }
      $("card").classList.add("sealed");
      show(`Almost sealed! Check ${d.email} for a confirmation link (look in Spam too). Click it and your letter will arrive on ${prettyWhen(d.when)}.`, "ok");
    } catch (err) {
      show("Couldn't save your letter. Check the web app URL and that access is set to Anyone.", "err");
      console.error(err);
    } finally { btn.disabled = false; }
    return;
  }

  if (!d.email) { show("Add the email address to send to.", "err"); return; }
  if (EMAILJS.publicKey.startsWith("YOUR_")) {
    show("Add your EmailJS keys at the top of the script to turn on sending.", "err"); return;
  }
  const btn = $("sendBtn"); btn.disabled = true;
  try {
    emailjs.init({ publicKey: EMAILJS.publicKey });
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      to_name: d.name,
      to_email: d.email,
      open_date: prettyWhen(d.when),
      subject: `💌 Don't open until ${prettyWhen(d.when)}`,
      message: d.message
    });
    $("card").classList.add("sealed");
    show(`Sealed and sent! Your letter is in your inbox. Save it for ${prettyWhen(d.when)}.`, "ok");
  } catch (err) {
    show("Couldn't send it. Check your EmailJS keys and try again.", "err");
    console.error(err);
  } finally { btn.disabled = false; }
});

/* ---------- 3. Calendar reminder (.ics) that carries your letter ---------- */
const esc = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsLocal = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

$("calBtn").addEventListener("click", () => {
  const d = readForm(); if (!d) return;
  const end = new Date(d.when.getTime() + 15 * 60 * 1000);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Future Mail//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@future-mail`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsLocal(d.when)}`,        // floating local time, so it shows at the time you chose
    `DTEND:${icsLocal(end)}`,
    "SUMMARY:💌 Open your letter from past you",
    `DESCRIPTION:${esc(`Dear ${d.name},\n\n${d.message}`)}`,
    "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY", "DESCRIPTION:A letter from past you!", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "letter-to-future-me.ics";
  a.click();
  URL.revokeObjectURL(a.href);
  show(`Reminder saved. Open the file to add it to your calendar for ${prettyWhen(d.when)}.`, "ok");
});
