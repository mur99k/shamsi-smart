"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Menu, X, Sun, Cable } from "lucide-react";
import { useSolar } from "./SolarProvider";

const routes = [
  ["/dashboard", "Overview", "نظرة عامة"], ["/simulator", "Simulator", "المحاكي"],
  ["/assistant", "Assistant", "المساعد"], ["/evaluation", "Evaluation", "التقييم"],
  ["/project", "Project", "المشروع"], ["/hardware", "Hardware", "العتاد"],
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, dataMode, serialStatus, connectSerial, disconnectSerial } = useSolar();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const ar = lang === "ar";
  return <>
    <a className="skip-link" href="#main">{ar ? "انتقل إلى المحتوى" : "Skip to content"}</a>
    <header className="site-header" onKeyDown={event => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } }}>
      <div className="header-inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}><Sun size={23} aria-hidden="true" /><span>{ar ? "شمسي الذكي" : "Solar AI"}</span></Link>
        <nav id="primary-nav" aria-label={ar ? "التنقل الرئيسي" : "Main navigation"} className={`navigation ${open ? "is-open" : ""}`}>
          {routes.map(([href, en, arabic]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{ar ? arabic : en}</Link>)}
        </nav>
        <div className="header-actions">
          <button className={`mode-switch ${dataMode === "hardware" ? "is-hardware" : ""}`} onClick={dataMode === "hardware" ? disconnectSerial : connectSerial} title={dataMode === "hardware" ? (ar ? "العودة للمحاكاة" : "Return to simulation") : (ar ? "الاتصال بـ ESP32" : "Connect ESP32") }>
            <Cable size={14} aria-hidden="true" /><span className="status-dot" aria-hidden="true" />{dataMode === "hardware" ? (ar ? "ESP32 مباشر" : "ESP32 live") : serialStatus === "unsupported" ? (ar ? "المحاكاة" : "Simulation") : (ar ? "المحاكاة" : "Simulation")}
          </button>
          <button className="language-button" onClick={() => setLang(ar ? "en" : "ar")} aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}>{ar ? "EN" : "عربي"}</button>
          <button ref={toggle} className="icon-button menu-button" aria-controls="primary-nav" aria-expanded={open} aria-label={ar ? "القائمة" : "Menu"} title={ar ? "القائمة" : "Menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
    <main id="main" className="page-container" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><span>{ar ? "نموذج محاكاة برمجي. لا توجد أجهزة متصلة." : "Software simulation prototype. No hardware connected."}</span><Link href="/project">{ar ? "عن المشروع" : "About the project"}</Link></footer>
  </>;
}
