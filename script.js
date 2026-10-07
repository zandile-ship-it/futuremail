  /* ---------- 0. Scheduled delivery: paste your Apps Script web app URL (ends in /exec) ---------- */
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

  // earliest date = tomorrow (local time)
  const t = new Date(); t.setDate(t.getDate() + 1);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  $("date").min = iso(t);

  if (scheduled) {
    // letters always go to the script owner's inbox, so no email field is needed
    $("email").closest(".field").hidden = true;
    $("sendBtn").textContent = "Seal it for later";
  }

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
      message: $("message").value.trim()
    };
    if (!data.message) { show("Write a few words in your letter first.", "err"); return null; }
    if (!data.date)    { show("Pick the day you want to open it.", "err"); return null; }
    return data;
  }

  const prettyDate = s => new Date(s + "T12:00:00").toLocaleDateString(undefined,
    { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  /* ---------- 2. Send / schedule the letter ---------- */
  $("sendBtn").addEventListener("click", async () => {
    const d = readForm(); if (!d) return;

    if (scheduled) {
      const btn = $("sendBtn"); btn.disabled = true;
      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ name: d.name, date: d.date, message: d.message })
        });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error);
        $("card").classList.add("sealed");
        show(`Sealed! It will land in your inbox on ${prettyDate(d.date)}.`, "ok");
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
        open_date: prettyDate(d.date),
        subject: `💌 Don't open until ${prettyDate(d.date)}`,
        message: d.message
      });
      $("card").classList.add("sealed");
      show(`Sealed and sent! Your letter is in your inbox. Save it for ${prettyDate(d.date)}.`, "ok");
    } catch (err) {
      show("Couldn't send it. Check your EmailJS keys and try again.", "err");
      console.error(err);
    } finally { btn.disabled = false; }
  });

  /* ---------- 3. Calendar reminder (.ics) that carries your letter ---------- */
  const esc = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  $("calBtn").addEventListener("click", () => {
    const d = readForm(); if (!d) return;
    const start = d.date.replace(/-/g, "");
    const [y, m, day] = d.date.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, day + 1));
    const end = next.toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Future Mail//EN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@future-mail`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      "SUMMARY:💌 Open your letter from past you",
      `DESCRIPTION:${esc(`Dear ${d.name},\n\n${d.message}`)}`,
      "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", "DESCRIPTION:A letter from past you!", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "letter-to-future-me.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    show(`Reminder saved. Open the file to add it to your calendar for ${prettyDate(d.date)}.`, "ok");
  });