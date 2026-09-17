"use client";

import ProjectSaif from "@/components/dashboard/ProjectSaif";
import ArchitectureViz from "@/components/dashboard/ArchitectureViz";
import { useSolar } from "@/components/dashboard/SolarProvider";

export default function ProjectPage() {
  const { lang } = useSolar();
  return <><div className="page-heading"><div><h1>{lang === "ar" ? "المشروع ومعمارية النظام" : "Project & Architecture"}</h1><p>{lang === "ar" ? "دراسة نموذج برمجي لإدارة فائض الطاقة الشمسية." : "A software prototype for solar surplus management."}</p></div></div><ProjectSaif lang={lang} /><ArchitectureViz lang={lang} /></>;
}
