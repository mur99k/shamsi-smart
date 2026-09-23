/* Assistant benchmark: 100+ scenarios against POST /api/ai/chat.
 * Run: node scripts/assistant-benchmark.mjs [baseUrl]
 * Output: console score report + scripts/assistant-benchmark-report.json
 */
const BASE = process.argv[2] || "http://localhost:3000";
const CONCURRENCY = 8;
const TIMEOUT_MS = 75000;

const STATE = {
  solarProductionW: 1500, consumptionW: 300, excessEnergyW: 1200,
  battery: { available: true, capacityWh: 5000, levelPercent: 20 },
  ev: { available: false, charging: false },
  loads: { available: true, totalCapacityW: 800 },
};

const AR = /[؀-ۿ]/;
const MD = /(\*\*|__|`|#{1,6}\s|\[.*\]\(.*\))/;
const TEMP_RE = /\d+\.?\d*\s*(°م|°C|C)/;
const PCT_RE = /\d+\s*[%٪]/;
const GREET = /^(السلام عليكم|كيف حالك|صباح الخير|مساء النور|شكرًا لك|Hello|Hello there|How are you|Good morning)\s*[؟?!…\.]*$/;
const ENERGY_WORDS = /(طار|بطار|شمس|فائض|عجز|استهلاك|إنتاج|كهرب|تكييف|شحن|battery|solar|surplus|shortage|consum|energy|charge|kW|W\b|AC\b)/i;
const STIFF = /(مخصص لمساعدتك|dedicated to helping you manage solar energy)/;

const Q = [];
const add = (cat, checks, list) => list.forEach((q) => Q.push({ cat, checks, q }));

add("ar-energy", ["lang-ar", "no-md", "no-stiff"], [
  "هل عندي فائض الآن؟", "لماذا اخترت شحن البطارية؟", "وش أسوي لو امتلأت البطارية؟",
  "كم إنتاج الألواح الحين؟", "استهلاك بيتي كثير؟", "البطارية 20% تكفي لليل؟",
  "لو شغلت المكيف وش يصير للفائض؟", "أبغى أشحن السيارة من الشمس، ينفع؟",
  "ما هي أفضل وجهة للفائض حاليًا؟", "اشرح لي حالة النظام بكلام بسيط",
  "هل أطفي السخان عشان أوفر؟", "كم صافي الطاقة عندي؟",
  "عندي عجز ولا فائض؟", "وش الأحمال اللي شغالة؟",
  "إذا زاد الاستهلاك لـ 2000 وش القرار؟", "هل التخزين أفضل من البيع للشبكة؟",
  "كيف أقلل فاتورة الكهرباء بالطاقة الشمسية؟", "البطارية تنشحن بسرعة؟",
  "وش يصير لو طفت كل الأحمال؟", "نصيحة سريعة لإدارة الطاقة اليوم",
  "الفائض يكفي لشحن جوالي وسيارتي معًا؟", "متى أفضل وقت لتشغيل الغسالة؟",
]);
add("ar-weather", ["lang-ar", "no-md", "has-temp"], [
  "كم الحرارة في جدة؟", "وش جو الرياض اليوم؟", "هل فيه مطر في أبها بكرة؟",
  "درجة الحرارة في مكة كم؟", "هل الغيوم تأثر على الألواح اليوم؟",
  "وش توقع المطر في جدة؟", "الجو حار في الدمام؟", "هل الرطوبة عالية في جدة؟",
  "تنصح أشغل المكيف اليوم؟", "الحرارة تأثر على إنتاج الألواح؟",
  "كيف الطقس في الطائف؟", "هل بكرة مناسب لغسيل الألواح؟",
]);
add("ar-chitchat", ["lang-ar", "no-md", "no-stiff", "bridge"], [
  "وش رأيك في الشمام؟", "من يفوز بالدوري السنة دي؟", "احكي لي نكتة",
  "السلام عليكم", "كيف حالك؟", "وش أفضل مطعم في جدة؟",
  "تكلم عن نفسك", "تحب كرة القدم؟", "وش هواياتك؟",
  "عطني حكمة عن الحياة", "تتوقع الهلال يفوز؟", "أنا طفشان، سواليف",
  "صباح الخير", "مساء النور", "شكرًا لك",
]);
add("ar-complex", ["lang-ar", "no-md"], [
  "لو البطارية 90% والسيارة موجودة والشمس قوية وش القرار وليش؟",
  "قارن بين تخزين الفائض وتشغيل المكيف وأيهما أفضل ولماذا؟",
  "إذا انقطع الإنترنت هل تستمر التوصيات؟ وكيف؟",
  "اشرح لي الفرق بين الفائض والعجز بمثال من حالتي الحالية",
  "البطاريه منخفضه وش الحل؟؟؟", "uuuوشششش الوضعععع؟؟؟",
  "تكلم عن البطارية والسيارة والطقس في جدة كلها مع بعض",
  "لو عندي لوحين وبطارية تاخذ 3 أيام شحن، وين المشكلة؟",
]);
add("en-energy", ["lang-en", "no-md", "no-stiff"], [
  "Do I have surplus right now?", "Why did you choose battery charging?",
  "What if the battery gets full?", "How much solar am I producing?",
  "Is my consumption too high?", "Will 20% battery last the night?",
  "What happens if I turn on the AC?", "Can I charge my EV from solar?",
  "What is the best destination for surplus?", "Explain my system simply",
  "Should I turn off the heater to save?", "What is my net power?",
  "Is solar enough to run my whole house?", "Good morning!",
]);
add("en-weather", ["lang-en", "no-md", "has-temp"], [
  "What is the temperature in Jeddah?", "How is the weather in Riyadh?",
  "Will it rain in Abha tomorrow?", "Is it humid in Jeddah today?",
  "Does heat affect my panels?", "Should I run the AC today?",
  "Rain forecast for Makkah?", "Is tomorrow good for panel cleaning?",
]);
add("en-chitchat", ["lang-en", "no-md", "no-stiff", "bridge"], [
  "What do you think about rainy weekends?", "Who will win the league?",
  "Tell me a joke", "Hello there", "How are you?", "Do you like football?",
  "Talk about yourself", "Give me life advice",
]);
add("en-complex", ["lang-en", "no-md"], [
  "If battery is 90%, EV present, strong sun — decision and why?",
  "Compare storing surplus vs running AC — which is better and why?",
  "Explain surplus vs shortage using my current numbers",
  "Battery low, what to do???", "What about battery, EV and Jeddah weather together?",
  "Summarize my whole system state in plain words",
]);
add("edge", ["no-md"], [
  "؟", "...", "بطارية", "1500", "Battery 20% وش الحل؟",
  "WHAT IS MY SURPLUS??", "   ", "السلام", "ok",
  "السسسسسلام عليكم ورحمة الله",
]);

console.log(`Running ${Q.length} scenarios against ${BASE} (x${CONCURRENCY})...`);
const results = new Array(Q.length);
let done = 0;
async function ask(item) {
  const lang = AR.test(item.q) ? "ar" : "en";
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(`${BASE}/api/ai/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ state: STATE, lang, messages: [{ role: "user", content: item.q }] }),
    });
    clearTimeout(to);
    const j = await r.json();
    return { ...item, lang, reply: j.reply || "", source: j.source || "error", ms: Date.now() - t0, ok: true };
  } catch (e) {
    return { ...item, lang, reply: "", source: "error", ms: Date.now() - t0, ok: false, err: String(e).slice(0, 80) };
  }
}
async function worker(queue) {
  while (queue.length) {
    const idx = queue.pop();
    results[idx] = await ask(Q[idx]);
    if (++done % 20 === 0) console.log(`...${done}/${Q.length}`);
  }
}
const queue = Q.map((_, i) => i).reverse();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

const hasAr = (t) => AR.test(t);
const checks = {
  "lang-ar": (r) => hasAr(r.reply),
  "lang-en": (r) => !hasAr(r.reply),
  "no-md": (r) => !MD.test(r.reply),
  "no-stiff": (r) => !STIFF.test(r.reply),
  "bridge": (r) => GREET.test(r.q.trim()) ? true : ENERGY_WORDS.test(r.reply),
  "has-temp": (r) => TEMP_RE.test(r.reply) || PCT_RE.test(r.reply),
};
const scores = {};
for (const name of Object.keys(checks)) {
  const rel = results.filter((r) => r.ok && r.checks.includes(name));
  const pass = rel.filter((r) => { try { return checks[name](r); } catch { return false; } });
  scores[name] = { pass: pass.length, total: rel.length, pct: rel.length ? Math.round((pass.length / rel.length) * 100) : 100, fails: pass.length === rel.length ? [] : rel.filter((r) => !checks[name](r)).slice(0, 8).map((r) => r.q) };
}
const aiN = results.filter((r) => r.source === "ai").length;
const lat = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
const grams = {};
for (const r of results) {
  if (!r.ok) continue;
  const words = r.reply.split(/\s+/).filter((w) => w.length > 2);
  for (let i = 0; i + 3 < words.length; i++) {
    const g = words.slice(i, i + 4).join(" ");
    grams[g] = (grams[g] || 0) + 1;
  }
}
const topGrams = Object.entries(grams).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log("\n===== SCORE REPORT =====");
console.log(`total=${Q.length} ok=${results.filter((r) => r.ok).length} ai=${aiN} fallback=${results.filter((r) => r.source === "fallback").length}`);
console.log(`latency p50=${lat[Math.floor(lat.length / 2)]}ms p95=${lat[Math.floor(lat.length * 0.95)]}ms`);
for (const [k, v] of Object.entries(scores)) console.log(`${k}: ${v.pass}/${v.total} = ${v.pct}%`);
console.log("top repeated 4-grams (>=4x):", JSON.stringify(topGrams.map(([g, n]) => `${n}x:${g.slice(0, 60)}`), null, 1));
for (const [k, v] of Object.entries(scores)) if (v.fails.length) console.log(`FAIL SAMPLE [${k}]:`, JSON.stringify(v.fails, null, 0));

const fs = await import("fs");
fs.writeFileSync("scripts/assistant-benchmark-report.json", JSON.stringify({ at: new Date().toISOString(), scores, aiN, topGrams, results: results.map((r) => ({ cat: r.cat, q: r.q, lang: r.lang, source: r.source, ms: r.ms, reply: r.reply.slice(0, 400) })) }, null, 1));
console.log("report saved.");
