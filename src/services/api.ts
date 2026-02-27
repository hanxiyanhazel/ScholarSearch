import axios from "axios";
import { Paper } from "../types";

export async function searchPapers(query: string, limit: number = 50): Promise<Paper[]> {
  const response = await axios.get("/api/search/semantic-scholar", {
    params: { query, limit }
  });
  return response.data.data || [];
}

export async function downloadZip(papers: { title: string; pdfUrl: string }[]) {
  const response = await axios.post("/api/download-zip", { papers }, {
    responseType: "blob"
  });
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "papers.zip");
  document.body.appendChild(link);
  link.click();
  link.remove();
}
