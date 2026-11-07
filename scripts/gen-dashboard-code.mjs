import fs from "node:fs";
import cp from "node:child_process";

const commit = cp.execSync("git rev-parse --short HEAD").toString().trim();
const files = [
  ["src/app/dashboard/page.tsx", "tsx", "الصفحة التي تجمع اللوحة الحية مع قسم المحاكاة"],
  ["src/lib/energy/live.ts", "ts", "عقد القراءة + قرار النظام + حالة البطارية"],
  ["src/components/dashboard/LiveDashboard.tsx", "tsx", "الأقسام التسعة (Tailwind) — كامل المكوّن"],
  ["src/components/dashboard/SolarProvider.tsx", "tsx", "القنوات (USB/BLE/Cloud) + القراءة الموحّدة + السجل + الريليه"],
];

let out = `# ملحق الكود — لوحة التحكم الحية

> **مولَّد آليًا** من الملفات الفعلية عند commit \`${commit}\` — لا تعدّله يدويًا.
> لإعادة التوليد: \`node scripts/gen-dashboard-code.mjs\`
>
> الغرض: تسليم كود المكوّنات والصفحات كما هو في المستودع، دون نسخ يدوي.
> الشرح المعماري في \`docs/DASHBOARD.md\`، وتقرير المطابقة في \`docs/REPORT-FOR-MARIA.md\`.

---

`;

for (const [path, lang, desc] of files) {
  const code = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  out += `## \`${path}\`\n\n${desc}\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n---\n\n`;
}

fs.writeFileSync("docs/DASHBOARD-CODE-APPENDIX.md", out, "utf8");
console.log("written lines=" + out.split("\n").length + " from commit " + commit);
