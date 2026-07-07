import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getApprovedTransactionsForReport } from "../services/reportService";
import { submitBorang, getBorangByUser } from "../services/formService";
import { getTransactionsByUser } from "../services/transactionService";
import { submitPdfBorang } from "../services/pdfSubmissionService";
import { useAuth } from "../context/AuthContext";
import { FORMS_CONFIG } from "../config/formsConfig";
import { MALAYSIA_STATES_CITIES } from "../config/malaysiaCities";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/config";
import { SignaturePanel, resolveToDataUrl } from "../components/SignatureCapture";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatIcNumber = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

// Lets a date be typed as plain digits (YYYYMMDD), auto-formatting to YYYY-MM-DD as you go
const formatDateTyped = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

// Strips anything that isn't a digit or a single decimal point (blocks letters entirely)
const filterMoneyInput = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
};

// Best-effort split of a joined "alamat_1, alamat_2, poskod, bandar, negeri" string
// (the exact format AddressField.build() produces) back into parts, so a row-popout
// address editor can be re-opened for editing without losing prior structure.
function parseAlamatPenuh(str) {
  if (!str) return { baris1: "", baris2: "", poskod: "", bandar: "", negeri: "" };
  const parts = str.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 4) {
    const negeri = parts[parts.length - 1];
    const bandar = parts[parts.length - 2];
    const poskod = parts[parts.length - 3];
    if (/^\d{4,5}$/.test(poskod)) {
      const rest = parts.slice(0, parts.length - 3);
      return { baris1: rest[0] || "", baris2: rest.slice(1).join(", "), poskod, bandar, negeri };
    }
  }
  return { baris1: str, baris2: "", poskod: "", bandar: "", negeri: "" };
}

const draftKey = (formId, uid) => `sfms_draft_${formId}_${uid}`;
function saveDraft(formId, uid, formData, rows) {
  try { localStorage.setItem(draftKey(formId, uid), JSON.stringify({ formData, rows, savedAt: Date.now() })); } catch {}
}
function loadDraft(formId, uid) {
  try { const r = localStorage.getItem(draftKey(formId, uid)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearDraft(formId, uid) {
  try { localStorage.removeItem(draftKey(formId, uid)); } catch {}
}

// ─── Shared PDF styles ────────────────────────────────────────────────────────
const TS = { fontSize: 9, cellPadding: 2.5, textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.2 };
const HS = { fillColor: [210,210,210], textColor: [0,0,0], fontStyle: "bold", lineColor: [0,0,0], lineWidth: 0.2 };
const LC = { cellWidth: 52, fontStyle: "bold", fillColor: [220,220,220], textColor: [0,0,0] };
const fmtRM = (v) => { const n = Number(v); return (isNaN(n)||v===""||v==null) ? "RM 0.00" : `RM ${n.toFixed(2)}`; };

// Downloads the PDF once — no extra blank tab
function openPdf(doc, filename = "borang.pdf") {
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addFooter(doc, num, date, rev = "0") {
  const pc = doc.internal.getNumberOfPages(), pw = doc.internal.pageSize.getWidth(), m = 14;
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i); doc.setTextColor(0,0,0);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.text(`Nombor Dokumen : ${num}`, m, ph-12);
    doc.text(`Tarikh    : ${date}`, m, ph-8);
    doc.text(`Pindaan   : ${rev}`, m, ph-4);
    doc.text(`Muka surat : ${i}/${pc}`, pw-m, ph-8, { align:"right" });
  }
}

// ─── PDF 1: Akuan Penerimaan Wang Tunai ──────────────────────────────────────
function generateAkuanWangTunaiPdf(formData, _rows, sig) {
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const pw = doc.internal.pageSize.getWidth(), m = 14;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.rect(m,10,pw-2*m,36);
  doc.setFontSize(8.5); doc.setFont("helvetica","bold");
  doc.text("BAHAGIAN AKTIVITI & PEMBANGUNAN PELAJAR", pw/2,18,{align:"center"});
  doc.text("JABATAN TIMBALAN NAIB CANSELOR HAL EHWAL PELAJAR DAN ALUMNI", pw/2,23,{align:"center"});
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA", pw/2,28,{align:"center"});
  doc.text("81310 JOHOR BAHRU", pw/2,33,{align:"center"});
  doc.setFontSize(11); doc.text("BORANG AKUAN PENERIMAAN WANG TUNAI", pw/2,42,{align:"center"});
  let y=52;
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(0,0,0);
  doc.text("A.    BUTIRAN PENERIMA", m, y); y+=2;
  autoTable(doc,{ startY:y, margin:{left:m,right:m}, theme:"grid", styles:TS, headStyles:HS, columnStyles:{0:LC},
    body:[["NAMA PENUH",formData.namapenuh_penerima||""],["NO. KAD PENGENALAN",formData.no_kp_penerima||""],
          ["ORGANISASI",formData.organisasi||""],[{content:"ALAMAT",styles:{minCellHeight:18}},{content:formData.alamat||"",styles:{minCellHeight:18}}]] });
  y=doc.lastAutoTable.finalY+6;
  doc.setTextColor(0,0,0); doc.text("B.    BUTIRAN PENERIMAAN WANG", m, y); y+=2;
  autoTable(doc,{ startY:y, margin:{left:m,right:m}, theme:"grid", styles:TS, headStyles:HS, columnStyles:{0:LC},
    body:[["JUMLAH",formData.jumlah?`RM ${Number(formData.jumlah).toFixed(2)}`:""],
          ["TUJUAN",formData.tujuan||""],["PROGRAM",formData.program||""],
          ["ANJURAN",formData.anjuran||""],["TARIKH TERIMA",formData.tarikh_terima||""]] });
  y=doc.lastAutoTable.finalY+6;
  doc.setTextColor(0,0,0); doc.text("C.    PENGESAHAN", m, y); y+=2;
  autoTable(doc,{ startY:y, margin:{left:m,right:m}, theme:"grid", styles:TS, headStyles:HS, columnStyles:{0:LC},
    body:[[{content:"TANDATANGAN",styles:{minCellHeight:24}},{content:"",styles:{minCellHeight:24}}],
          ["NAMA PENUH",formData.diterima_nama||""],
          ["TARIKH",formData.diterima_tarikh||""],
          ["NO. TELEFON",formData.diterima_tel||""]],
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===1&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+2,c.width-4,c.height-4);
      }
    }});
  if(formData.ulasan){ y=doc.lastAutoTable.finalY+2;
    autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,columnStyles:{0:LC},
      body:[["ULASAN (Jika berkaitan)",formData.ulasan]]}); }
  // Filled by the reviewer at approval time (config.reviewerSection) — only
  // rendered once a reviewer has actually signed off.
  if (formData.tandatangan_diserah || formData.nama_penuh_diserah) {
    y=doc.lastAutoTable.finalY+6;
    doc.setTextColor(0,0,0); doc.text("PENGESAHAN (DISERAHKAN OLEH)", m, y); y+=2;
    autoTable(doc,{ startY:y, margin:{left:m,right:m}, theme:"grid", styles:TS, headStyles:HS, columnStyles:{0:LC},
      body:[[{content:"TANDATANGAN",styles:{minCellHeight:24}},{content:"",styles:{minCellHeight:24}}],
            ["NAMA PENUH",formData.nama_penuh_diserah||""],
            ["TARIKH",formData.tarikh_diserah||""],
            ["NO. TELEFON",formData.no_tel_diserah||""]],
      didDrawCell:(data)=>{
        if(formData.tandatangan_diserah&&data.section==="body"&&data.column.index===1&&data.row.index===0){
          const c=data.cell; doc.addImage(formData.tandatangan_diserah,"PNG",c.x+2,c.y+2,c.width-4,c.height-4);
        }
      }});
  }
  doc.addPage(); doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("D.    PENGESAHAN AKUAN SUMPAH (Hanya untuk terimaan melebihi RM 200,000)", m, 20);
  autoTable(doc,{startY:24,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,columnStyles:{0:LC},
    head:[["MAKLUMAT","COP AKUAN SUMPAH"]],
    body:[[{content:"TANDATANGAN",styles:{minCellHeight:22}},{content:"",styles:{minCellHeight:22}}],
          ["TARIKH",""],["ULASAN (Jika berkaitan)",""]]});
  addFooter(doc,"B.HEP.BAPP(UA).02.01/04(04)","1 Oktober 2020");
  return doc;
}

// ─── PDF 2: Baucer Bayaran ────────────────────────────────────────────────────
function generateBaucerBayaranPdf(formData, _rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14, tw=pw-2*m;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("KEW/AP/03",pw-m,15,{align:"right"});
  doc.text("JABATAN TIMBALAN NAIB CANSELOR HAL EHWAL PELAJAR DAN ALUMNI",pw/2,12,{align:"center"});
  doc.text("(UNIT KEWANGAN)",pw/2,17,{align:"center"});
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA",pw/2,22,{align:"center"});
  doc.setFontSize(12); doc.text("BAUCER BAYARAN",pw/2,30,{align:"center"});
  let y=36;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",
    styles:{...TS,fontSize:7.5},headStyles:{...HS,fontSize:7.5},
    head:[["TARIKH","NAMA AKAUN","NO. BAUCER","BAKI TABUNG (RM)","JUMLAH PENGELUARAN (RM)","BAKI TABUNG TERAKHIR (RM)","CATATAN"]],
    body:[[formData.tarikh||"",formData.nama_akaun||"",formData.no_baucer||"",
           formData.baki_tabung?fmtRM(formData.baki_tabung):"",
           formData.jumlah_pengeluaran?fmtRM(formData.jumlah_pengeluaran):"",
           formData.baki_tabung_terakhir?fmtRM(formData.baki_tabung_terakhir):"",formData.catatan||""]]});
  y=doc.lastAutoTable.finalY+1;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,
    headStyles:{...HS,halign:"left"},
    columnStyles:{0:{cellWidth:tw*0.55},1:{cellWidth:tw*0.45}},
    head:[["NAMA/ALAMAT PENERIMA:","TANDATANGAN PENERIMA:"]],
    body:[[{content:[formData.nama_penerima,formData.alamat].filter(Boolean).join("\n\n"),styles:{minCellHeight:38,valign:"top"}},
           {content:"\n\n\n\nNAMA:\n\n\nTARIKH:\n",styles:{minCellHeight:38,valign:"top"}}]]});
  y=doc.lastAutoTable.finalY+1;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    body:[[{content:"TUJUAN:",styles:{fontStyle:"bold",fillColor:[220,220,220],cellWidth:22}},{content:formData.tujuan||"",styles:{minCellHeight:14}}]]});
  y=doc.lastAutoTable.finalY+1;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    body:[[{content:"CATITAN:",styles:{fontStyle:"bold",fillColor:[220,220,220],cellWidth:22}},{content:formData.catitan||"",styles:{minCellHeight:12}}]]});
  y=doc.lastAutoTable.finalY+4;
  // CEK NO. | BAUCER DISEDIAKAN OLEH (with signature space)
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",
    styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:`CEK NO.   ${formData.cek_no||"________________________________"}`,styles:{fontStyle:"bold"}},
           {content:`BAUCER DISEDIAKAN OLEH:\n\n\n\nNama  : ${formData.disediakan_nama||""}\nTarikh : ${formData.disediakan_tarikh||""}`,styles:{fontStyle:"bold",minCellHeight:34}}]],
    columnStyles:{0:{cellWidth:tw/2},1:{cellWidth:tw/2}},
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===1&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+7,Math.min(c.width-4,52),c.height-9);
      }
    }});
  y=doc.lastAutoTable.finalY+3;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:"BAYARAN DILULUSKAN OLEH:\n\n\n......................................................",styles:{fontStyle:"bold",minCellHeight:20}},
           {content:"CEK DITANDANGANI OLEH:\n\n\n......................................................",styles:{fontStyle:"bold",minCellHeight:20}}]],
    columnStyles:{0:{cellWidth:tw/2},1:{cellWidth:tw/2}}});
  // Reviewer sign-off (config.reviewerSection, kind "choice") — only rendered
  // for whichever box(es) the reviewer actually picked and signed at approval.
  {
    const reviewerBoxes = [
      { label: "Baucer Disediakan Oleh (Disahkan)", sigKey: "sig_baucer_disediakan" },
      { label: "Bayaran Diluluskan Oleh",            sigKey: "sig_bayaran_diluluskan" },
      { label: "Cek Ditandatangani Oleh",            sigKey: "sig_cek_ditandatangani" },
    ].filter(b => formData[b.sigKey]);
    if (reviewerBoxes.length) {
      y=doc.lastAutoTable.finalY+4;
      doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(0,0,0);
      doc.text("PENGESAHAN (DISERAHKAN OLEH)", m, y); y+=2;
      const cw = tw / reviewerBoxes.length;
      autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
        body:[reviewerBoxes.map(b=>({content:`${b.label}:\n\n\n\n`,styles:{fontStyle:"bold",minCellHeight:34}}))],
        columnStyles:Object.fromEntries(reviewerBoxes.map((_,i)=>[i,{cellWidth:cw}])),
        didDrawCell:(data)=>{
          const b = reviewerBoxes[data.column.index];
          if (b && data.section==="body") {
            const c=data.cell; doc.addImage(formData[b.sigKey],"PNG",c.x+2,c.y+7,Math.min(c.width-4,45),c.height-9);
          }
        }});
    }
  }
  addFooter(doc,"B.HEP.BAPP(UA).02.01/04(04)","1 Oktober 2020");
  return doc;
}

// ─── PDF 3: Tuntutan Bayaran Balik Mendahulukan Wang ─────────────────────────
function generateTuntutanBayaranBalikPdf(formData, _rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(8); doc.setFont("helvetica","italic");
  doc.text("Borang Pelajar",pw-m,12,{align:"right"});
  doc.setFont("helvetica","bold"); doc.setFontSize(13);
  doc.text("TUNTUTAN BAYARAN BALIK MENDAHULUKAN WANG",pw/2,20,{align:"center"});
  let y=28;
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("A.  Maklumat Pemohon*",m,y); y+=3;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    columnStyles:{0:{cellWidth:72,fontStyle:"bold",fillColor:[220,220,220]}},
    body:[["1.  Nama Pemohon\n    (Kelab/Persatuan/JKM/Badan Beruniform/Pelajar)",formData.nama_pemohon||""],
          [{content:"2.  Tujuan Pembelian\n    (Nama Program, Tarikh & Tempat)",styles:{minCellHeight:18}},{content:formData.tujuan_pembelian||"",styles:{minCellHeight:18}}],
          ["3.  Vot Pembayaran (Chargeline)",""],
          ["4.  Jumlah Tuntutan (RM)",formData.jumlah_tuntutan?fmtRM(formData.jumlah_tuntutan):""]],
  });
  y=doc.lastAutoTable.finalY+3;
  doc.setFontSize(7.5); doc.setFont("helvetica","italic");
  const nl=doc.splitTextToSize("(Sila lampirkan SENARAI RESIT BAYARAN, RESIT ASAL, SALINAN SURAT KELULUSAN, BORANG TUKAR TARIKH, TENTATIF DAN PENYATA KEWANGAN)",pw-2*m);
  doc.text(nl,m,y); y+=nl.length*4+5;
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("B.  Perakuan Bayaran",m,y); y+=4;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  ["1. Saya mengaku bahawa tuntutan ini adalah benar dan telah membuat bayaran menggunakan wang sendiri.",
   "2. Sekiranya tuntutan yang dikemukakan adalah tidak benar dan berlaku penyalahgunaan, saya boleh disiasat dan",
   "   dikenakan tindakan di bawah Kaedah-kaedah Universiti Teknologi Malaysia (Tatatertib Pelajar-Pelajar) 1999 atau",
   "   Akta Badan-badan Berkanun (Tertib dan Surcaj) Akta 605.",
   "3. Barang/Perkhidmatan telah diterima dengan sempurna mengikut spesifikasi yang ditetapkan.",
   "4. Tuntutan ini telah disemak dan belum dibayar.","5. Semua Peraturan Universiti telah dipatuhi."
  ].forEach(l=>{ doc.text(l,m,y); y+=4.5; });
  y+=3;
  const hw=(pw-2*m)/2;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:"Pengakuan Pemohon:",styles:{fontStyle:"bold"}},{content:"Pengesahan Pegawai:",styles:{fontStyle:"bold"}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}}});
  y=doc.lastAutoTable.finalY+2;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:`\n\n______________________\nNama Penuh : ${formData.nama_penuh||""}\nNo. Matrik : ${formData.no_matrik||""}\nNo. Tel    : ${formData.no_tel||""}\nTarikh     : ${formData.tarikh||""}`,styles:{minCellHeight:30}},
           {content:"\n\n______________________\nCop & Tandatangan\nTarikh :",styles:{minCellHeight:30}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===0&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+2,Math.min(c.width-4,52),14);
      }
    }});
  y=doc.lastAutoTable.finalY+6;
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("C.  Pengesahan Ketua / Pengarah / Pegawai yang diturunkan kuasa menguruskan kewangan PTJ",m,y); y+=5;
  doc.setFont("helvetica","normal"); doc.text("Pembayaran diluluskan:",m,y); y+=3;
  // Filled by the reviewer at approval time (config.reviewerSection)
  if (formData.tandatangan_pengesahan_reviewer) { doc.addImage(formData.tandatangan_pengesahan_reviewer,"PNG",m,y,50,14); }
  y+=14;
  doc.text("______________________",m,y); y+=5;
  doc.text("Cop & Tandatangan",m,y); y+=5;
  doc.text(`Tarikh: ${formData.tarikh_pengesahan_reviewer||""}`,m,y); y+=8;
  doc.text("Ulasan:",m,y); y+=5;
  doc.line(m,y,pw-m,y); y+=5; doc.line(m,y,pw-m,y);
  addFooter(doc,"B.HEP.BP.(KEW). 01.02/01(01)","1 Oktober 2020");
  return doc;
}

// ─── PDF 4: Senarai Invois, Bil dan Tuntutan untuk Dibayar ───────────────────
function generateSenraiInvoisPdf(formData, rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14, tw=pw-2*m;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("JABATAN TIMBALAN NAIB CANSELOR HAL EHWAL PELAJAR DAN ALUMNI",pw/2,12,{align:"center"});
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA",pw/2,17,{align:"center"});
  doc.setFontSize(11); doc.text("SENARAI INVOIS, BIL DAN TUNTUTAN UNTUK DIBAYAR",pw/2,24,{align:"center"});
  let y=30;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    columnStyles:{0:{cellWidth:tw*0.55,fontStyle:"bold",fillColor:[220,220,220]},1:{cellWidth:tw*0.45}},
    body:[["NO SIRI  :   "+(formData.no_siri||""),{content:"COP PENERIMAAN HEPA",styles:{fontStyle:"bold",fillColor:[220,220,220],halign:"center",rowSpan:3}}],
          ["PERSATUAN / KELAB / JKM  :   "+(formData.persatuan_kelab||""),""],
          ["TARIKH  :   "+(formData.tarikh||""),""]],
  });
  y=doc.lastAutoTable.finalY+2;
  const dr=(rows||[]).map(r=>[r.nama_penerima||"",r.no_kp||"",r.jenis_tuntutan||"",r.no_vot||"",r.no_bil_invois||"",r.jumlah_dibayar||"",""]);
  while(dr.length<5) dr.push(["","","","","","",""]);
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:{...TS,fontSize:8},headStyles:{...HS,fontSize:8},
    head:[["NAMA PENERIMA / ALAMAT","NO. K/P","JENIS TUNTUTAN","NO. VOT","NO. BIL / INVOIS","JUMLAH DIBAYAR (RM)","CATATAN HEPA"]],
    body:dr.map(r=>r.map(c=>({content:c,styles:{minCellHeight:10}})))});
  y=doc.lastAutoTable.finalY+5;
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text("TANDATANGAN  :",m,y);
  if(sig){ doc.addImage(sig,"PNG",m+44,y-9,60,12); }
  else { doc.text("  .................................................................................",m+44,y); }
  y+=6; doc.text("NAMA & JAWATAN  :  "+(formData.nama_jawatan||""),m,y); y+=10;
  doc.setFont("helvetica","bold"); doc.text("PANDUAN",m,y); y+=5;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  ["1. Kemukakan dua salinan borang ini dan disimpan salinan Persatuan/ Kelab/ JKM ikut nombor siri.",
   "2. Pertanyaan pembayaran boleh dibuat dengan menyatakan nombor siri rujukan di atas.",
   "3. Semua invois bil tuntutan mestilah disahkan dengan sepatutnya seperti dikehendaki Pekeliling Pejabat Hal Ehwal",
   "   Pelajar Bil. 94 dan kemukakan bersama borang ini.",
   "4. Semua tuntutan hendaklah dikemukakan dalam tempoh tujuh (7) hari selepas program."
  ].forEach(l=>{ doc.text(l,m,y); y+=4.5; });
  y+=4; doc.setFont("helvetica","bold"); doc.text("JENIS TUNTUTAN",m,y); y+=5;
  doc.setFont("helvetica","normal");
  doc.text("A.  Bil (Isikan ruangan 1, 3, 4, 5 & 6 sahaja)",m,y); y+=5;
  doc.text("B.  Pendahuluan (Isikan ruangan 1, 2, 3 & 6 sahaja)",m,y);
  addFooter(doc,"B.HEP.BAPP(UA).02.01/04(04)","1 Oktober 2020");
  return doc;
}

// ─── PDF 5: Tuntutan Bayaran Elaun Penceramah ────────────────────────────────
function generateTuntutanElaunPdf(formData, rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14, hw=(pw-2*m)/2;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(8); doc.setFont("helvetica","italic"); doc.text("Borang Pelajar",pw-m,12,{align:"right"});
  doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text("TUNTUTAN BAYARAN PROGRAM",pw/2,18,{align:"center"});
  doc.setFontSize(11); doc.text("(ELAUN PENCERAMAH / HADIAH PEMENANG / DLL)",pw/2,25,{align:"center"});
  let y=33;
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("A.  Maklumat Penerima*",m,y); y+=3;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    columnStyles:{0:{cellWidth:72,fontStyle:"bold",fillColor:[220,220,220]}},
    body:[["1.  Nama Penerima",formData.nama_penerima||""],
          [{content:"2.  Tujuan Pembelian\n    (Jenis Elaun, Nama Program & Tarikh)",styles:{minCellHeight:16}},{content:[formData.jenis_elaun,formData.nama_program,formData.tarikh_tuntutan].filter(Boolean).join(", "),styles:{minCellHeight:16}}],
          ["3.  Vot Pembayaran (Chargeline)",""],
          ["4.  Jumlah Tuntutan (RM)",formData.jumlah_tuntutan?fmtRM(formData.jumlah_tuntutan):""]],
  });
  y=doc.lastAutoTable.finalY+3;
  doc.setFontSize(7.5); doc.setFont("helvetica","italic");
  const nl=doc.splitTextToSize("(Sila lampirkan SALINAN SURAT KELULUSAN, BORANG TUKAR TARIKH (Jika Berkaitan), TENTATIF, PENYATA KEWANGAN, SALINAN IC, SALINAN PENYATA AKAUN & DOKUMEN SOKONGAN YANG BERKAITAN)",pw-2*m);
  doc.text(nl,m,y); y+=nl.length*4+5;
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("B.  Perakuan Bayaran",m,y); y+=4;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  ["1. Saya mengaku bahawa tuntutan ini adalah benar dan telah membuat bayaran menggunakan wang sendiri.",
   "2. Sekiranya tuntutan yang dikemukakan adalah tidak benar dan berlaku penyalahgunaan, saya boleh disiasat dan",
   "   dikenakan tindakan di bawah Kaedah-kaedah Universiti Teknologi Malaysia (Tatatertib Pelajar-Pelajar) 1999 atau",
   "   Akta Badan-badan Berkanun (Tertib dan Surcaj) Akta 605.",
   "3. Barang/Perkhidmatan telah diterima dengan sempurna mengikut spesifikasi yang ditetapkan.",
   "4. Tuntutan ini telah disemak dan belum dibayar.","5. Semua Peraturan Universiti telah dipatuhi."
  ].forEach(l=>{ doc.text(l,m,y); y+=4.5; });
  y+=3;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:`Disediakan Oleh:\n\n\n______________________\nCop & Tandatangan\nTarikh : ${formData.disediakan_tarikh||""}`,styles:{minCellHeight:30}},
           {content:"Pengesahan Pegawai:\n\n\n______________________\nCop & Tandatangan\nTarikh :",styles:{minCellHeight:30}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===0&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+10,Math.min(c.width-4,52),14);
      }
    }});
  y=doc.lastAutoTable.finalY+6;
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("C.  Pengesahan Ketua / Pengarah / Pegawai yang diturunkan kuasa menguruskan kewangan PTJ",m,y); y+=5;
  doc.setFont("helvetica","normal"); doc.text("Pembayaran diluluskan:",m,y); y+=3;
  // Filled by the reviewer at approval time (config.reviewerSection)
  if (formData.tandatangan_pengesahan_reviewer) { doc.addImage(formData.tandatangan_pengesahan_reviewer,"PNG",m,y,50,14); }
  y+=14;
  doc.text("______________________",m,y); y+=5; doc.text("Cop & Tandatangan",m,y); y+=5;
  doc.text(`Tarikh: ${formData.tarikh_pengesahan_reviewer||""}`,m,y); y+=8; doc.text("Ulasan:",m,y); y+=5;
  doc.line(m,y,pw-m,y); y+=5; doc.line(m,y,pw-m,y);
  // Lampiran A
  doc.addPage(); doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(11); doc.setFont("helvetica","bold");
  doc.text("LAMPIRAN A",pw/2,18,{align:"center"});
  const lr=(rows||[]).map((r,i)=>[String(i+1),r.nama_penerima||"",r.no_ic||"",r.nama_bank||"",r.no_akaun||"",r.jenis_tuntutan||"",r.jumlah?fmtRM(r.jumlah):""]);
  while(lr.length<6) lr.push(["","","","","","",""]);
  autoTable(doc,{startY:22,margin:{left:m,right:m},theme:"grid",styles:{...TS,fontSize:8},headStyles:{...HS,fontSize:8},
    head:[["BIL","NAMA PENERIMA","NO. IC","NAMA BANK","NO. AKAUN","JENIS TUNTUTAN\n(CTH: ELAUN PENCERAMAH)","JUMLAH (RM)"]],
    body:lr.map(r=>r.map(c=>({content:c,styles:{minCellHeight:9}}))),columnStyles:{0:{cellWidth:10}}});
  let ly=doc.lastAutoTable.finalY+8;
  autoTable(doc,{startY:ly,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:"Disediakan Oleh:\n\n\n______________________",styles:{minCellHeight:22}},
           {content:"Disahkan Oleh:\n\n\n______________________",styles:{minCellHeight:22}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    // Reviewer's signature for the Lampiran A sign-off (config.reviewerSection)
    didDrawCell:(data)=>{
      if(formData.tandatangan_lampiran_a_reviewer&&data.section==="body"&&data.column.index===1&&data.row.index===0){
        const c=data.cell; doc.addImage(formData.tandatangan_lampiran_a_reviewer,"PNG",c.x+2,c.y+10,Math.min(c.width-4,52),14);
      }
    }});
  addFooter(doc,"B.HEP.BAPP(UA).02.01/04(04)","1 Oktober 2020");
  return doc;
}

// ─── PDF 6: Pendahuluan Aktiviti ─────────────────────────────────────────────
function generatePendahuluanAktivitiPdf(formData, _rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("JABATAN TIMBALAN NAIB CANSELOR HAL EHWAL PELAJAR DAN ALUMNI",pw/2,12,{align:"center"});
  doc.text("(BAHAGIAN AKTIVITI & PEMBANGUNAN PELAJAR)",pw/2,17,{align:"center"});
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA",pw/2,22,{align:"center"});
  doc.setFontSize(11); doc.text("BORANG PENDAHULUAN AKTIVITI PELAJAR",pw/2,29,{align:"center"});
  let y=35;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    columnStyles:{0:{cellWidth:52,fontStyle:"bold",fillColor:[220,220,220]}},
    body:[
      ["NO. SIRI",                formData.no_siri||""],
      ["PERSATUAN / KELAB / JKM", formData.persatuan_kelab||""],
      ["TARIKH",                  formData.tarikh||""],
      ["NAMA PENERIMA",           formData.nama_penerima||""],
      [{content:"ALAMAT PENERIMA",styles:{minCellHeight:16}},{content:formData.alamat||"",styles:{minCellHeight:16}}],
      ["NO. KAD PENGENALAN",      formData.no_kp||""],
      ["PROGRAM",                 formData.program||""],
      ["AKTIVITI",                formData.aktiviti||""],
      ["JUMLAH PENDAHULUAN (RM)", formData.jumlah_pendahuluan ? `RM ${Number(formData.jumlah_pendahuluan).toFixed(2)}` : ""],
    ]});
  y=doc.lastAutoTable.finalY+6;
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text("TANDATANGAN  :",m,y);
  if(sig){ doc.addImage(sig,"PNG",m+44,y-9,60,12); }
  else { doc.text("  .................................................................................",m+44,y); }
  y+=7;
  doc.text("NAMA         :  "+(formData.nama||""),m,y); y+=6;
  doc.text("JAWATAN      :  "+(formData.jawatan||""),m,y); y+=10;
  doc.setFont("helvetica","bold"); doc.text("PANDUAN",m,y); y+=5;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  ["1. Dokumen Permohonan:","   a. Surat Permohonan Pendahuluan",
   "   b. Lampiran Perincian Kewangan Jumlah Pendahuluan yang dimohon",
   "   c. Borang Pendahuluan Aktiviti Pelajar","   d. Surat Kelulusan @ UTMACAD",
   "   e. Borang permohonan penangguhan/ perubahan maklumat (jika ada)",
   "2. Borang Pendahuluan dikemukakan dalam 2 salinan:",
   "   a. 1 salinan untuk simpanan Persatuan/ Kelab/ JKM",
   "   b. 1 salinan untuk simpanan Bahagian Aktiviti Pembangunan dan Pelajar (BAPP)",
   "3. Borang permohonan perlu dikemukakan satu minggu awal atau selewat-lewatnya 3 hari dari tarikh program/ aktiviti.",
   "4. Jumlah pendahuluan akan diberi mengikut kelulusan Pegawai Aktiviti."
  ].forEach(l=>{ doc.text(l,m,y); y+=4.5; });
  addFooter(doc,"B.HEP.BAPP(UA).02.01/04(04)","1 Oktober 2020");
  return doc;
}

// ─── PDF 7: Borang Permohonan Pengecualian Cukai ─────────────────────────────
function generatePermohonancukaiPdf(formData, rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("BORANG PERMOHONAN PENGECUALIAN CUKAI SUBSEKSYEN 44(6)",pw-m,12,{align:"right"});
  doc.setFont("helvetica","normal");
  doc.text("Rujukan Permohonan  :  _______________________________________________",m,20);
  const div=(y)=>{ doc.setDrawColor(0,0,0); doc.line(m,y,pw-m,y); };
  let y=26; div(y); y+=6;
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("A)  SYARAT PERMOHONAN",m,y); y+=5;
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
  ["a)  Hendaklah diisi dalam 2 salinan.",
   "b)  Dikemukakan bersama 1 salinan Surat Kelulusan Program / Surat Kelulusan Penajaan Pihak Luar / Dalam Kampus UTM.",
   "c)  Senarai 5 penaja yang berpotensi untuk permohonan sumbangan / kutipan / penajaan dari pihak luar."
  ].forEach(l=>{ doc.text(l,m,y); y+=5; });
  y+=2; div(y); y+=6;
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("B)  MAKLUMAT PEMOHON",m,y); y+=5;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[`a)  Nama            :  ${formData.nama||""}`],[`b)  No. Matrik      :  ${formData.no_matrik||""}`],
          [`c)  No. KP          :  ${formData.no_kp||""}`],[`d)  No. Telefon     :  ${formData.no_telefon||""}`],
          [`e)  Jawatan         :  ${formData.jawatan||""}`]]});
  y=doc.lastAutoTable.finalY+2; div(y); y+=6;
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("C)  MAKLUMAT PROGRAM",m,y); y+=5;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[`a)  Nama Program     :  ${formData.nama_program||""}`],
          [`b)  Persatuan / JKM  :  ${formData.persatuan_jkm||""}`],
          [`c)  Tarikh Program   :  ${formData.tarikh_program_dari||""}  hingga  ${formData.tarikh_program_hingga||""}`],
          [`d)  Tarikh Kutipan   :  ${formData.tarikh_kutipan_dari||""}  hingga  ${formData.tarikh_kutipan_hingga||""}`]]});
  y=doc.lastAutoTable.finalY+2; div(y); y+=6;
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("SENARAI PENAJA BERPOTENSI",m,y); y+=5;
  const sponsorRows=(rows||[]).map((r,i)=>[String(i+1),r.nama_penaja||"",r.alamat_penaja||"",r.no_telefon_penaja||""]);
  while(sponsorRows.length<5) sponsorRows.push(["","","",""]);
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:{...TS,fontSize:8},headStyles:{...HS,fontSize:8},
    head:[["BIL","NAMA SYARIKAT / PENAJA BERPOTENSI","ALAMAT PENAJA","NO. TELEFON"]],
    body:sponsorRows.map(r=>r.map(c=>({content:c,styles:{minCellHeight:10}}))),columnStyles:{0:{cellWidth:10}}});
  y=doc.lastAutoTable.finalY+4;
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.text("Tandatangan Pemohon :",m,y);
  if(sig){ doc.addImage(sig,"PNG",m+47,y-9,48,12); }
  else { doc.text(" ___________________",m+47,y); }
  doc.text(`Tarikh : ${formData.tarikh_tandatangan||""}`,m+100,y);
  y+=6; div(y); y+=6;
  doc.setFont("helvetica","bold"); doc.text("D)  PENGESAHAN JABATAN TIMBALAN NAIB CANSELOR (HEP)",m,y); y+=5;
  doc.setFont("helvetica","normal");
  // Filled by the reviewer at approval time (config.reviewerSection)
  doc.text(`Permohonan ini   ${formData.keputusan_reviewer ? formData.keputusan_reviewer.toUpperCase() : "*DISOKONG   /   TIDAK DISOKONG"}`,m,y); y+=6;
  doc.text("Ulasan:",m,y); y+=5;
  if (formData.ulasan_reviewer) {
    const ul = doc.splitTextToSize(formData.ulasan_reviewer, pw-2*m);
    doc.text(ul,m,y); y += ul.length*4.5;
  } else {
    doc.line(m,y,pw-m,y); y+=5; doc.line(m,y,pw-m,y);
  }
  y+=8;
  doc.text("Tandatangan  :",m,y);
  if (formData.tandatangan_reviewer) { doc.addImage(formData.tandatangan_reviewer,"PNG",m+25,y-9,40,12); }
  else { doc.text(" ___________________",m+25,y); }
  doc.text(`Tarikh  :  ${formData.tarikh_reviewer||"___________________"}`,m+100,y); y+=5;
  doc.text("Cop Rasmi    :  ___________________",m,y);
  y+=6; div(y); y+=6;
  doc.setFont("helvetica","bold"); doc.text("E)  KELULUSAN JABATAN BENDAHARI UTM",m,y); y+=5;
  doc.setFont("helvetica","normal"); doc.text("Permohonan ini   *DISOKONG   /   TIDAK DISOKONG",m,y); y+=6;
  doc.text("Ulasan:",m,y); y+=5; doc.line(m,y,pw-m,y); y+=5; doc.line(m,y,pw-m,y); y+=8;
  doc.text("Tandatangan      :  ___________________   Tarikh  :  ___________________",m,y); y+=5;
  doc.text("Cop Rasmi        :  ___________________",m,y); y+=5;
  doc.text("Rujukan Kelulusan :  ___________________",m,y);
  return doc;
}

// ─── PDF 8: Penyata Kewangan + Senarai Resit ─────────────────────────────────
function generatePenyataKewanganPdf(formData, rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14, hw=(pw-2*m)/2;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("KEW/AP/01",pw-m,12,{align:"right"});
  doc.text("BAHAGIAN AKTIVITI & PEMBANGUNAN PELAJAR",pw/2,12,{align:"center"});
  doc.text("JABATAN TIMBALAN NAIB CANSELOR HAL EHWAL PELAJAR DAN ALUMNI",pw/2,17,{align:"center"});
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA",pw/2,22,{align:"center"});
  doc.setFontSize(12); doc.text("PENYATA KEWANGAN",pw/2,29,{align:"center"});
  let y=35;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:TS,headStyles:HS,
    columnStyles:{0:{cellWidth:48,fontStyle:"bold",fillColor:[220,220,220]}},
    body:[["NO. RUJ. PERSATUAN",formData.no_ruj_persatuan||""],
          ["PERSATUAN / KELAB / JKM",formData.persatuan_kelab||""],
          ["AKTIVITI / PROGRAM",formData.aktiviti_program||""],
          ["TARIKH PROGRAM",formData.tarikh_program||""],
          ["TEMPAT PROGRAM",formData.tempat_program||""]]});
  y=doc.lastAutoTable.finalY+3;
  const p0=Number(formData.peruntukan_hepa_pendahuluan||0), p1=Number(formData.peruntukan_hepa_baki||0);
  const hepa=p0+p1,tab=Number(formData.tabung_persatuan||0),yur=Number(formData.yuran_penyertaan||0);
  const pen=Number(formData.penajaan||0),sum=Number(formData.sumbangan_lain||0);
  const jpend=hepa+tab+yur+pen+sum;
  const mk=Number(formData.makan_minum||0),per=Number(formData.peralatan||0),png=Number(formData.pengangkutan||0);
  const prh=Number(formData.perhubungan||0),cen=Number(formData.cenderamata||0),at=Number(formData.alat_tulis||0);
  const jperb=mk+per+png+prh+cen+at, bal=jpend-jperb, r=(v)=>`RM ${v.toFixed(2)}`;
  const inc=[
    "PENDAPATAN","",`1) Peruntukan HEPA`,`     i.  Pendahuluan       : ${r(p0)}`,`     ii. Baki              : ${r(p1)}`,
    `   Jumlah Peruntukan HEPA  : ${r(hepa)}`,"",`2) Tabung Persatuan   : ${r(tab)}`,
    `3) Yuran Penyertaan   : ${r(yur)}`,`4) Penajaan           : ${r(pen)}`,`5) Sumbangan          : ${r(sum)}`,"",
    `Jumlah Pendapatan (A) : ${r(jpend)}`,"",`Jumlah Besar          : ${r(jpend)}`].join("\n");
  const exp=[
    "PERBELANJAAN","",`1) Makan / Minum   : ${r(mk)}`,`2) Peralatan       : ${r(per)}`,
    `3) Pengangkutan    : ${r(png)}`,`4) Perhubungan     : ${r(prh)}`,`5) Cenderamata     : ${r(cen)}`,
    `6) Alat tulis      : ${r(at)}`,"",`Jumlah Perbelanjaan (B)  : ${r(jperb)}`,
    `Jumlah Pendapatan (A-B)  : ${r(bal)}`,"",`Jumlah Besar             : ${r(jperb)}`].join("\n");
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:{...TS,fontSize:8.5},
    headStyles:{...HS,halign:"center",fontSize:9},
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    head:[["WANG MASUK","WANG KELUAR"]],
    body:[[{content:inc,styles:{valign:"top",minCellHeight:80}},{content:exp,styles:{valign:"top",minCellHeight:80}}]]});
  y=doc.lastAutoTable.finalY+4;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:"Disediakan oleh Bendahari Program",styles:{fontStyle:"bold"}},
           {content:"Disemak & Disahkan oleh Bendahari Persatuan",styles:{fontStyle:"bold"}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}}});
  y=doc.lastAutoTable.finalY+2;
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:`\n\n______________________\nNama        : ${formData.nama_bendahari||""}\nNo. Telefon : ${formData.no_telefon_bendahari||""}\nTarikh      : ${formData.tarikh_penyediaan||""}`,styles:{minCellHeight:30}},
           {content:`\n\n______________________\nNama        : ${formData.nama_bendahari_kelab||""}\nNo. Telefon : ${formData.no_tel_bendahari_kelab||""}\nTarikh      : ${formData.tarikh_bendahari_kelab||""}`,styles:{minCellHeight:30}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===0&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+2,Math.min(c.width-4,52),14);
      }
      // Filled by the reviewer (Bendahari Kelab) at approval time (config.reviewerSection)
      if(formData.tandatangan_bendahari_kelab&&data.section==="body"&&data.column.index===1&&data.row.index===0){
        const c=data.cell; doc.addImage(formData.tandatangan_bendahari_kelab,"PNG",c.x+2,c.y+2,Math.min(c.width-4,52),14);
      }
    }});
  // Page 2
  doc.addPage(); doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(12); doc.setFont("helvetica","bold");
  doc.text("SENARAI RESIT BAYARAN",pw/2,16,{align:"center"});
  let py=22;
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text(`Program   :  ${formData.nama_program||formData.aktiviti_program||""}`,m,py); py+=6;
  doc.text(`Anjuran   :  ${formData.anjuran||formData.persatuan_kelab||""}`,m,py); py+=5;
  const rr=(rows||[]).map((r,i)=>[String(i+1),r.tarikh_resit||"",r.perkara||"",r.no_resit||"",r.jumlah||"",r.tujuan_pembelian||""]);
  while(rr.length<10) rr.push(["","","","","",""]);
  const jres=(rows||[]).reduce((s,r)=>s+Number(r.jumlah||0),0);
  autoTable(doc,{startY:py,margin:{left:m,right:m},theme:"grid",styles:{...TS,fontSize:8},headStyles:{...HS,fontSize:8},
    head:[["BIL","TARIKH","PERKARA","NO. RESIT","JUMLAH (RM)","TUJUAN PEMBELIAN"]],
    body:[...rr.map(r=>r.map(c=>({content:c,styles:{minCellHeight:8}}))),
          [{content:"",colSpan:4,styles:{fillColor:[220,220,220]}},
           {content:`JUMLAH PERBELANJAAN (RM): ${r(jres)}`,colSpan:2,styles:{fontStyle:"bold",fillColor:[220,220,220]}}]],
    columnStyles:{0:{cellWidth:10}}});
  let qy=doc.lastAutoTable.finalY+6;
  autoTable(doc,{startY:qy,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:`DISEDIAKAN OLEH (BENDAHARI PROGRAM):\n\n______________________\nNama        : ${formData.nama_bendahari||""}\nNo. Telefon : ${formData.no_telefon_bendahari||""}\nPersatuan   : ${formData.persatuan_kelab||""}`,styles:{minCellHeight:30}},
           {content:"PENGESAHAN PEGAWAI HEPA:\n\n______________________",styles:{minCellHeight:30}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===0&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+10,Math.min(c.width-4,52),14);
      }
    }});
  addFooter(doc,"B.HEP.BAPP(UA).02.01/04(04)","1 Oktober 2020");
  return doc;
}

// ─── PDF 9: Borang Penyerahan Cek / Wang Tunai ───────────────────────────────
function generatePenyerahanCekPdf(formData, rows, sig) {
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth(), m=14, hw=(pw-2*m)/2;
  doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
  doc.setFontSize(8.5); doc.setFont("helvetica","bold");
  doc.text("BORANG PENYERAHAN CEK / WANG TUNAI",pw/2,13,{align:"center"});
  doc.text("BAGI TUJUAN PERMOHONAN PENGECUALIAN CUKAI SUBSEKSYEN 44(6)",pw/2,19,{align:"center"});
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  doc.text("(DIISI DALAM 2 SALINAN)",pw/2,24,{align:"center"});
  let y=30; doc.setFontSize(9);
  doc.text(`Nama JKM / Persatuan / Kelab                       :  ${formData.nama_persatuan||""}`,m,y); y+=6;
  doc.text(`Nama Program                                         :  ${formData.nama_program||""}`,m,y); y+=6;
  doc.text(`No. Rujukan Surat Kelulusan Pengecualian Cukai :  ${formData.no_rujukan||""}`,m,y); y+=6;
  const dr=(rows||[]).map((r,i)=>[String(i+1),r.nama_penyumbang||"",r.alamat_penuh||"",r.tarikh_sumbangan||"",r.jumlah_sumbangan||"",r.no_cek_bank||""]);
  while(dr.length<5) dr.push(["","","","","",""]);
  autoTable(doc,{startY:y,margin:{left:m,right:m},theme:"grid",styles:{...TS,fontSize:8},headStyles:{...HS,fontSize:8},
    head:[["BIL","NAMA PENYUMBANG","ALAMAT PENUH PENYUMBANG","TARIKH SUMBANGAN","JUMLAH SUMBANGAN (RM)","NO. CEK / BANK TUNAI / EFT"]],
    body:dr.map(r=>r.map(c=>({content:c,styles:{minCellHeight:14}}))),columnStyles:{0:{cellWidth:10}}});
  let sy=doc.lastAutoTable.finalY+6;
  autoTable(doc,{startY:sy,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:"Disediakan oleh:",styles:{fontStyle:"bold"}},{content:"Disahkan oleh:",styles:{fontStyle:"bold"}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}}});
  sy=doc.lastAutoTable.finalY+2;
  autoTable(doc,{startY:sy,margin:{left:m,right:m},theme:"plain",styles:{fontSize:9,textColor:[0,0,0]},
    body:[[{content:`\n\n______________________\nNama    : ${formData.disediakan_nama||""}\nJawatan : ${formData.disediakan_jawatan||""}\nTarikh  : ${formData.disediakan_tarikh||""}`,styles:{minCellHeight:30}},
           {content:`\n\n______________________\nNama    : ${formData.disahkan_nama||""}\nJawatan : ${formData.disahkan_jawatan||""}\nTarikh  : ${formData.disahkan_tarikh||""}`,styles:{minCellHeight:30}}]],
    columnStyles:{0:{cellWidth:hw},1:{cellWidth:hw}},
    didDrawCell:(data)=>{
      if(sig&&data.section==="body"&&data.column.index===0&&data.row.index===0){
        const c=data.cell; doc.addImage(sig,"PNG",c.x+2,c.y+2,Math.min(c.width-4,52),14);
      }
    }});
  return doc;
}

// ─── PDF generator registry ──────────────────────────────────────────────────
const PDF_GENERATORS = {
  "akuan-wang-tunai":              (fd,rows,sig)=>generateAkuanWangTunaiPdf(fd,rows,sig),
  "baucer-bayaran":                (fd,rows,sig)=>generateBaucerBayaranPdf(fd,rows,sig),
  "tuntutan-bayaran-balik":        (fd,rows,sig)=>generateTuntutanBayaranBalikPdf(fd,rows,sig),
  "senarai-invois":                (fd,rows,sig)=>generateSenraiInvoisPdf(fd,rows,sig),
  "tuntutan-elaun-penceramah":     (fd,rows,sig)=>generateTuntutanElaunPdf(fd,rows,sig),
  "pendahuluan-aktiviti":          (fd,rows,sig)=>generatePendahuluanAktivitiPdf(fd,rows,sig),
  "permohonan-pengecualian-cukai": (fd,rows,sig)=>generatePermohonancukaiPdf(fd,rows,sig),
  "penyata-kewangan-resit":        (fd,rows,sig)=>generatePenyataKewanganPdf(fd,rows,sig),
  "penyerahan-cek-wang-tunai":     (fd,rows,sig)=>generatePenyerahanCekPdf(fd,rows,sig),
};

// ─── Misc helpers ─────────────────────────────────────────────────────────────
const statusLabel=(s)=>{
  if(s==="diluluskan") return "Diluluskan";
  if(s==="ditolak") return "Ditolak";
  if(s==="disemak") return "Sedang Disemak";
  if(s==="selesai") return "Selesai";
  return "Sudah Dihantar";
};
const statusBadge=(s)=>{
  const b="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if(s==="diluluskan") return `${b} bg-green-100 text-green-700`;
  if(s==="ditolak") return `${b} bg-red-100 text-red-700`;
  if(s==="disemak") return `${b} bg-blue-100 text-blue-700`;
  if(s==="selesai") return `${b} bg-purple-100 text-purple-700`;
  return `${b} bg-amber-100 text-amber-700`;
};
const typeLabel=(t)=>t==="income"?"Pendapatan":"Perbelanjaan";
const SUBMIT_TO_LABELS = { bendahari_kelab: "Bendahari Kelab", advisor: "Penasihat Kelab", pegawai: "Pegawai Kewangan" };
const emptyRowFor=(config)=>{ const r={}; config.rowColumns.forEach(c=>{r[c.key]=""}); return r; };
const initialRowsFor=(config)=> config.rowColumns ? Array.from({length: config.fixedRowCount || 1}, () => emptyRowFor(config)) : [];

// ─── Address widget ───────────────────────────────────────────────────────────
function AddressField({ formData, onMultiChange, fieldClass, uid }) {
  const [negeriSearch, setNegeriSearch] = useState(formData.alamat_negeri || "");
  const [bandarSearch, setBandarSearch] = useState(formData.alamat_bandar || "");
  const [showNegeri, setShowNegeri] = useState(false);
  const [showBandar, setShowBandar] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  const negeriRef = useRef(null), bandarRef = useRef(null);

  useEffect(() => { setNegeriSearch(formData.alamat_negeri || ""); }, [formData.alamat_negeri]);
  useEffect(() => { setBandarSearch(formData.alamat_bandar || ""); }, [formData.alamat_bandar]);

  useEffect(() => {
    const h = (e) => {
      if (negeriRef.current && !negeriRef.current.contains(e.target)) setShowNegeri(false);
      if (bandarRef.current && !bandarRef.current.contains(e.target)) setShowBandar(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const build = (ov) => {
    const d = { ...formData, ...ov };
    return [d.alamat_1, d.alamat_2, d.alamat_poskod, d.alamat_bandar, d.alamat_negeri].filter(Boolean).join(", ");
  };
  const update = (ov) => onMultiChange({ ...ov, alamat: build(ov) });
  const handleSaveAddress = () => {
    if (!uid) return;
    const payload = {
      alamat_1: formData.alamat_1 || "", alamat_2: formData.alamat_2 || "",
      alamat_negeri: formData.alamat_negeri || "", alamat_bandar: formData.alamat_bandar || "",
      alamat_poskod: formData.alamat_poskod || "", alamat: formData.alamat || "",
    };
    try {
      localStorage.setItem(`sfms_address_${uid}`, JSON.stringify(payload));
      setAddressSaved(true);
      setTimeout(() => setAddressSaved(false), 2500);
    } catch {}
  };
  const fN = Object.keys(MALAYSIA_STATES_CITIES).filter(s => s.toLowerCase().includes(negeriSearch.toLowerCase()));
  const fB = formData.alamat_negeri ? (MALAYSIA_STATES_CITIES[formData.alamat_negeri] || []).filter(c => c.toLowerCase().includes(bandarSearch.toLowerCase())) : [];
  const dC = "absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg";
  const dI = (sel) => `cursor-pointer px-3 py-2 text-sm transition hover:bg-red-50 hover:text-red-800 ${sel ? "bg-red-50 font-semibold text-red-800" : "text-gray-700"}`;
  const req = <span className="ml-0.5 text-red-600">*</span>;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Alamat 1{req}</label>
        <input type="text" value={formData.alamat_1 || ""} onChange={e => update({ alamat_1: e.target.value })} className={fieldClass} placeholder="M42, Kolej Tun Dr Ismail" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Alamat 2 <span className="font-normal text-gray-400">(pilihan)</span></label>
        <input type="text" value={formData.alamat_2 || ""} onChange={e => update({ alamat_2: e.target.value })} className={fieldClass} placeholder="Universiti Teknologi Malaysia" />
      </div>
      <div ref={negeriRef} className="relative">
        <label className="mb-1 block text-xs font-medium text-gray-600">Negeri{req}</label>
        <input type="text" value={negeriSearch}
          onChange={e => { setNegeriSearch(e.target.value); setShowNegeri(true); if (formData.alamat_negeri) { update({ alamat_negeri: "", alamat_bandar: "" }); setBandarSearch(""); } }}
          onFocus={() => setShowNegeri(true)} className={fieldClass} placeholder="Taip untuk mencari negeri..." />
        {showNegeri && fN.length > 0 && (
          <ul className={dC}>{fN.map(s => <li key={s} onMouseDown={() => { update({ alamat_negeri: s, alamat_bandar: "" }); setNegeriSearch(s); setBandarSearch(""); setShowNegeri(false); }} className={dI(formData.alamat_negeri === s)}>{s}</li>)}</ul>
        )}
      </div>
      <div ref={bandarRef} className="relative">
        <label className="mb-1 block text-xs font-medium text-gray-600">Bandar / Daerah{req}</label>
        <input type="text" value={bandarSearch} disabled={!formData.alamat_negeri}
          onChange={e => { setBandarSearch(e.target.value); setShowBandar(true); if (formData.alamat_bandar) update({ alamat_bandar: "" }); }}
          onFocus={() => { if (formData.alamat_negeri) setShowBandar(true); }}
          className={`${fieldClass} ${!formData.alamat_negeri ? "cursor-not-allowed bg-gray-50 text-gray-400" : ""}`}
          placeholder={formData.alamat_negeri ? "Taip untuk mencari bandar..." : "Pilih negeri dahulu"} />
        {showBandar && fB.length > 0 && (
          <ul className={dC}>{fB.map(c => <li key={c} onMouseDown={() => { update({ alamat_bandar: c }); setBandarSearch(c); setShowBandar(false); }} className={dI(formData.alamat_bandar === c)}>{c}</li>)}</ul>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Poskod{req}</label>
        <input type="text" value={formData.alamat_poskod || ""} onChange={e => update({ alamat_poskod: e.target.value.replace(/\D/g,"").slice(0,5) })} className={fieldClass} placeholder="81300" maxLength={5} />
      </div>
      {formData.alamat && <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-xs italic text-gray-600">{formData.alamat}</p></div>}
      {formData.alamat_1 && formData.alamat_negeri && formData.alamat_bandar && formData.alamat_poskod && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSaveAddress} className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-100">
            💾 Simpan Alamat Ini untuk Kegunaan Akan Datang
          </button>
          {addressSaved && <span className="text-xs font-semibold text-green-600">✓ Alamat disimpan</span>}
        </div>
      )}
    </div>
  );
}
// ─── Main component ───────────────────────────────────────────────────────────
export default function ReportPage({ tab: forcedTab }) {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile, refreshProfile } = useAuth();

  const getAutoFillValue = (key, formId) => {
    const uid = currentUser?.uid;
    if (key === "organisasi" || key === "nama_persatuan" || key === "anjuran" || key === "persatuan_jkm") return localStorage.getItem(`sfms_club_${uid}`) || "";
    if (key === "program" || key === "nama_program") { try { return JSON.parse(localStorage.getItem(`sfms_prog_${uid}`)||"null")?.name||""; } catch { return ""; } }
    const formCfg = FORMS_CONFIG.find(f => f.id === formId);
    if (formCfg?.autoFillDisediakanOleh) {
      if (key === "disediakan_nama")    return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "disediakan_jawatan") {
        let progName = "";
        try { progName = JSON.parse(localStorage.getItem(`sfms_prog_${uid}`)||"null")?.name||""; } catch {}
        return progName ? `Bendahari ${progName}` : "Bendahari";
      }
      if (key === "disediakan_tarikh")  return todayISO();
    }
    if (formCfg?.autoFillPemohon) {
      if (key === "nama")       return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "no_matrik")  return userProfile?.matricNumber || "";
      if (key === "no_kp")      return userProfile?.icNumber || "";
      if (key === "no_telefon") return userProfile?.phone || "";
      if (key === "tarikh_tandatangan") return todayISO();
    }
    if (formCfg?.autoFillAkuanWangTunai) {
      if (key === "namapenuh_penerima") return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "no_kp_penerima")     return userProfile?.icNumber || "";
      if (key === "diterima_nama")      return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "diterima_tel")       return userProfile?.phone || "";
      if (key === "diterima_tarikh")    return todayISO();
    }
    // Generic per-field auto-fill map: { fieldKey: "fullName"|"icNumber"|"phone"|"matricNumber"|"today"|"club"|"program" }
    const source = formCfg?.autoFillFields?.[key];
    if (source === "fullName")     return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
    if (source === "icNumber")     return userProfile?.icNumber || "";
    if (source === "phone")        return userProfile?.phone || "";
    if (source === "matricNumber") return userProfile?.matricNumber || "";
    if (source === "today")        return todayISO();
    if (source === "club")         return localStorage.getItem(`sfms_club_${uid}`) || "";
    if (source === "program")      { try { return JSON.parse(localStorage.getItem(`sfms_prog_${uid}`)||"null")?.name||""; } catch { return ""; } }
    return null;
  };

  const [activeTab, setActiveTab]           = useState(() => forcedTab ?? (userRole === "treasurer" ? "borang" : "laporan"));
  const [filterMode, setFilterMode]         = useState("julat"); // "julat" | "keseluruhan"
  const [startDate, setStartDate]           = useState("");
  const [endDate, setEndDate]               = useState("");
  const [records, setRecords]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");
  const [message, setMessage]               = useState("");
  const [progContext, setProgContext]        = useState(null);
  const [openFormId, setOpenFormId]         = useState(null);
  const [formData, setFormData]             = useState({});
  const [rows, setRows]                     = useState([]);
  const [submitting, setSubmitting]         = useState(false);
  const [formMsg, setFormMsg]               = useState({ type:"", text:"" });
  const [submissions, setSubmissions]       = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [hasDraft, setHasDraft]             = useState(false);
  const [draftList, setDraftList]           = useState([]);
  const [showDrafts, setShowDrafts]         = useState(false);
  // e-signature (inline panel in form)
  const [activeSig, setActiveSig]           = useState(null);
  // Destination choice for forms with config.allowSubmitToChoice: null | "advisor" | "pegawai"
  const [submitTo, setSubmitTo]             = useState(null);
  // cellPopout: { ri, key, label, placeholder, tempValue }
  const [cellPopout, setCellPopout]         = useState(null);
  // suratKelulusan: null | { uploading:bool, name:str, url:str|null, path:str }
  const [suratKelulusan, setSuratKelulusan] = useState(null);
  // Generic per-form mandatory attachments (config.mandatoryAttachments):
  // { [attachmentKey]: [{ id, uploading:bool, name:str, url:str|null, path:str }] }
  const [mandatoryFiles, setMandatoryFiles] = useState({});
  // Prompt shown when starting a "new" form that already has an unfinished draft: { config }
  const [existingDraftPrompt, setExistingDraftPrompt] = useState(null);
  // Muat Naik PDF Terus — direct raw-PDF upload bypassing the digital form
  const [directFormType, setDirectFormType]   = useState("");
  const [directFile, setDirectFile]           = useState(null);
  const [directSubmitTo, setDirectSubmitTo]   = useState(null);
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const [directMsg, setDirectMsg]             = useState({ type:"", text:"" });
  // Row confirm/remove popups: { type:"confirm"|"remove", ri, label }
  const [confirmRowAction, setConfirmRowAction] = useState(null);
  const [rowActionSuccess, setRowActionSuccess] = useState("");
  // Confirmation popups shown before actually submitting (digital form / direct PDF upload)
  const [confirmSubmitBorang, setConfirmSubmitBorang] = useState(false);
  const [confirmDirectSubmit, setConfirmDirectSubmit] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    try { setProgContext(JSON.parse(localStorage.getItem(`sfms_prog_${currentUser.uid}`))||null); } catch {}
  }, [currentUser?.uid]);

  const refreshDraftList = useCallback(() => {
    if (!currentUser?.uid) return;
    setDraftList(FORMS_CONFIG.map(cfg => {
      try {
        const raw = localStorage.getItem(draftKey(cfg.id, currentUser.uid));
        if (!raw) return null;
        return { config: cfg, savedAt: JSON.parse(raw).savedAt };
      } catch { return null; }
    }).filter(Boolean));
  }, [currentUser?.uid]);

  const loadSubmissions = async () => {
    if (!currentUser?.uid) return;
    try { setLoadingSubmissions(true); setSubmissions(await getBorangByUser(currentUser.uid)); }
    catch (e) { console.error(e); } finally { setLoadingSubmissions(false); }
  };

  useEffect(() => {
    if (activeTab === "borang" && userRole === "treasurer") { loadSubmissions(); refreshDraftList(); }
  }, [activeTab, currentUser?.uid]);

  // Form 8 (Penyata Kewangan + Senarai Resit): Wang Masuk / Wang Keluar totals and the
  // Senarai Resit Bayaran rows are derived live from the treasurer's own recorded
  // transactions for this programme, not typed in manually — refresh them on open.
  useEffect(() => {
    const cfg = FORMS_CONFIG.find(f => f.id === openFormId);
    if (!cfg?.rowsAutoFromTransactions || !currentUser?.uid) return;
    (async () => {
      try {
        const txns = await getTransactionsByUser(currentUser.uid, progContext?.code);
        const income  = txns.filter(t => t.type === "income");
        const expense = txns.filter(t => t.type === "expense");
        const sumBy = (list, cats) => list.filter(t => cats.includes(t.category)).reduce((s,t)=>s+Number(t.amount||0),0);
        setFormData(prev => ({
          ...prev,
          peruntukan_hepa_baki: sumBy(income, ["Peruntukan HEP"]).toFixed(2),
          tabung_persatuan:     sumBy(income, ["Tabung Persatuan"]).toFixed(2),
          yuran_penyertaan:     sumBy(income, ["Yuran Penyertaan"]).toFixed(2),
          penajaan:             sumBy(income, ["Penajaan"]).toFixed(2),
          sumbangan_lain:       sumBy(income, ["Sumbangan", "Lain-lain"]).toFixed(2),
          makan_minum:          sumBy(expense, ["Makan/Minum"]).toFixed(2),
          peralatan:            sumBy(expense, ["Peralatan"]).toFixed(2),
          pengangkutan:         sumBy(expense, ["Pengangkutan"]).toFixed(2),
          perhubungan:          sumBy(expense, ["Perhubungan"]).toFixed(2),
          cenderamata:          sumBy(expense, ["Cenderamata"]).toFixed(2),
          alat_tulis:           sumBy(expense, ["Alat Tulis", "Lain-lain"]).toFixed(2),
        }));
        setRows(expense
          .slice()
          .sort((a,b)=>(a.date||"").localeCompare(b.date||""))
          .map(t => ({
            tarikh_resit:     t.date || "",
            perkara:          t.category || "",
            no_resit:         (t.receipts||[]).map(r=>r.noResit).filter(Boolean).join(", "),
            jumlah:           t.amount != null ? Number(t.amount).toFixed(2) : "",
            tujuan_pembelian: t.description || "",
          })));
      } catch (e) { console.error(e); }
    })();
  }, [openFormId, currentUser?.uid, progContext?.code]);

  const summary = useMemo(() => {
    const ti = records.filter(i=>i.type==="income").reduce((s,i)=>s+Number(i.amount||0),0);
    const te = records.filter(i=>i.type==="expense").reduce((s,i)=>s+Number(i.amount||0),0);
    return { totalIncome:ti, totalExpense:te, balance:ti-te };
  }, [records]);

  const handleLoadReport = async () => {
    try {
      setLoading(true); setErrorMsg(""); setMessage("");
      const isFullProgramme = filterMode === "keseluruhan";
      const data = await getApprovedTransactionsForReport({
        role: userRole,
        uid: currentUser.uid,
        club: userProfile?.club,
        clubs: userProfile?.clubs,
        startDate: isFullProgramme ? "" : startDate,
        endDate:   isFullProgramme ? "" : endDate,
        programmeCode: userRole === "treasurer" ? progContext?.code : undefined,
      });
      setRecords(data); setMessage("Penyata berjaya dimuatkan.");
    } catch { setErrorMsg("Gagal menjana penyata."); } finally { setLoading(false); }
  };

  const handleDownloadPdf = () => {
    if (!records.length) { setErrorMsg("Tiada data penyata untuk dimuat turun."); return; }
    const doc = new jsPDF(), title = userRole==="advisor"?"Penyata Kewangan Diluluskan":"Penyata Kewangan Saya";
    doc.setFontSize(16); doc.text(title,14,18); doc.setFontSize(10);
    doc.text(`Dijana oleh: ${currentUser.email}`,14,28);
    doc.text(`Julat Tarikh: ${filterMode==="keseluruhan" ? "Keseluruhan Program" : `${startDate||"Semua"} hingga ${endDate||"Semua"}`}`,14,34);
    doc.text(`Jumlah Pendapatan: RM ${summary.totalIncome.toFixed(2)}`,14,42);
    doc.text(`Jumlah Perbelanjaan: RM ${summary.totalExpense.toFixed(2)}`,14,48);
    doc.text(`Baki: RM ${summary.balance.toFixed(2)}`,14,54);
    autoTable(doc,{ startY:62, head:[["Program","Tarikh","Catatan","Kategori","Jenis","Jumlah","Dibuat Oleh"]],
      body:records.map(i=>[i.programmeCode?`${i.programmeCode} — ${i.programmeName}`:"-",i.date||"-",i.description||"-",i.category||"-",typeLabel(i.type),`RM ${Number(i.amount||0).toFixed(2)}`,i.createdByEmail||"-"]),
      styles:{fontSize:8} });
    openPdf(doc);
  };

  const handleBack = () => navigate(-1);

  const ADDRESS_SUB_KEYS = ["alamat_1","alamat_2","alamat_negeri","alamat_bandar","alamat_poskod"];

  const openForm = (config, loadDraftIfExists = true) => {
    const initial = {};
    config.fields.forEach(f => { const av=getAutoFillValue(f.key, config.id); initial[f.key]=av!==null?av:""; });
    if ("alamat" in initial) {
      ADDRESS_SUB_KEYS.forEach(k=>{ initial[k]=""; });
      try {
        const savedAddress = JSON.parse(localStorage.getItem(`sfms_address_${currentUser?.uid}`) || "null");
        if (savedAddress) Object.assign(initial, savedAddress);
      } catch {}
    }
    const draft = loadDraftIfExists ? loadDraft(config.id, currentUser?.uid) : null;
    if (draft) {
      const restored = { ...(draft.formData??initial) };
      if ("alamat" in restored) ADDRESS_SUB_KEYS.forEach(k=>{ if(!(k in restored)) restored[k]=""; });
      config.fields.forEach(f=>{ const av=getAutoFillValue(f.key, config.id); if(av!==null) restored[f.key]=av; });
      setFormData(restored);
      setRows(draft.rows?.length ? draft.rows : initialRowsFor(config));
      setHasDraft(true);
    } else {
      setFormData(initial);
      setRows(initialRowsFor(config));
      setHasDraft(false);
    }
    setOpenFormId(config.id); setFormMsg({type:"",text:""}); setSubmitTo(null);
    if (!loadDraftIfExists) { setActiveSig(null); setSuratKelulusan(null); setMandatoryFiles({}); }
  };

  const closeForm = () => { setOpenFormId(null); setFormData({}); setRows([]); setFormMsg({type:"",text:""}); setHasDraft(false); setActiveSig(null); setSuratKelulusan(null); setMandatoryFiles({}); setSubmitTo(null); };

  // "Isi Borang Baru" click — warn first if an unfinished draft for this exact form already exists,
  // since opening fresh would otherwise silently overwrite it on the next keystroke.
  const handleStartNewForm = (config) => {
    const draft = loadDraft(config.id, currentUser?.uid);
    if (draft) { setExistingDraftPrompt({ config }); return; }
    openForm(config, false);
  };

  const handleContinueExistingDraft = () => {
    if (!existingDraftPrompt) return;
    openForm(existingDraftPrompt.config, true);
    setExistingDraftPrompt(null);
  };

  const handleDiscardExistingDraft = () => {
    if (!existingDraftPrompt) return;
    const { config } = existingDraftPrompt;
    clearDraft(config.id, currentUser?.uid);
    refreshDraftList();
    openForm(config, false);
    setExistingDraftPrompt(null);
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => { const u={...prev,[key]:value}; if(openFormId&&currentUser?.uid) saveDraft(openFormId,currentUser.uid,u,rows); return u; });
  };

  const handleMultiFieldChange = (updates) => {
    setFormData(prev => { const u={...prev,...updates}; if(openFormId&&currentUser?.uid) saveDraft(openFormId,currentUser.uid,u,rows); return u; });
  };

  const handleRowChange = (ri, ck, val) => {
    setRows(prev => { const u=prev.map((r,i)=>i===ri?{...r,[ck]:val}:r); if(openFormId&&currentUser?.uid) saveDraft(openFormId,currentUser.uid,formData,u); return u; });
  };

  const addRow = () => { const cfg=FORMS_CONFIG.find(f=>f.id===openFormId); setRows(p=>[...p,emptyRowFor(cfg)]); };
  const removeRow = (ri) => setRows(p=>p.filter((_,i)=>i!==ri));

  const rowItemLabel = (row, cfg) => {
    const firstKey = cfg?.rowColumns?.[0]?.key;
    return row?.nama_penyumbang || (firstKey ? row?.[firstKey] : "") || "";
  };

  const handleRowConfirmClick = (ri, row, cfg) => {
    const allFilled = cfg.rowColumns.every(col => row[col.key]?.toString().trim());
    if (!allFilled) {
      setFormMsg({type:"error", text:"Sila lengkapkan semua maklumat baris ini sebelum mengesahkan."});
      return;
    }
    setConfirmRowAction({ type: "confirm", ri, label: rowItemLabel(row, cfg) });
  };

  const handleRowRemoveClick = (ri, row, cfg) => {
    setConfirmRowAction({ type: "remove", ri, label: rowItemLabel(row, cfg) });
  };

  const handleRowActionConfirmed = () => {
    if (!confirmRowAction) return;
    const { type, ri, label } = confirmRowAction;
    const noun = activeFormConfig?.id === "penyerahan-cek-wang-tunai" ? "Penyumbang" : "Entri";
    setConfirmRowAction(null);
    if (type === "remove") {
      removeRow(ri);
      setRowActionSuccess(label ? `${noun} "${label}" berjaya dibuang.` : `${noun} berjaya dibuang.`);
    } else {
      setRowActionSuccess(label ? `${noun} "${label}" berjaya ditambah.` : `${noun} berjaya ditambah.`);
    }
  };

  const discardDraft = () => {
    if (!openFormId||!currentUser?.uid) return;
    clearDraft(openFormId,currentUser.uid);
    const cfg=FORMS_CONFIG.find(f=>f.id===openFormId);
    const init={}; cfg.fields.forEach(f=>{init[f.key]="";});
    setFormData(init); setRows(initialRowsFor(cfg));
    setHasDraft(false); setFormMsg({type:"",text:""}); refreshDraftList();
  };

  const handleSuratUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `surat_kelulusan/${currentUser.uid}/${Date.now()}.${ext}`;
    setSuratKelulusan({ uploading: true, name: file.name, url: null });
    try {
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setSuratKelulusan({ uploading: false, name: file.name, url, path });
    } catch {
      setSuratKelulusan(null);
      setFormMsg({ type: "error", text: "Gagal memuat naik surat kelulusan. Sila cuba lagi." });
    }
  };

  // Generic per-form attachment upload, keyed by config.mandatoryAttachments[].key
  // (despite the name, individual entries may be optional via `required: false`)
  const handleMandatoryAttachmentUpload = async (file, attKey) => {
    if (!file) return;
    const cfg = FORMS_CONFIG.find(f => f.id === openFormId);
    const attDef = cfg?.mandatoryAttachments?.find(a => a.key === attKey);
    const current = mandatoryFiles[attKey] ?? [];
    if (attDef?.maxFiles && current.length >= attDef.maxFiles) {
      setFormMsg({ type: "error", text: `Maksimum ${attDef.maxFiles} fail dibenarkan untuk "${attDef.label}".` });
      return;
    }
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `mandatory_attachments/${attKey}/${currentUser.uid}/${Date.now()}-${file.name}`;
    setMandatoryFiles(prev => ({ ...prev, [attKey]: [...(prev[attKey] ?? []), { id: tempId, uploading: true, name: file.name, url: null }] }));
    try {
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setMandatoryFiles(prev => ({ ...prev, [attKey]: (prev[attKey] ?? []).map(f => f.id === tempId ? { id: tempId, uploading: false, name: file.name, url, path } : f) }));
    } catch {
      setMandatoryFiles(prev => ({ ...prev, [attKey]: (prev[attKey] ?? []).filter(f => f.id !== tempId) }));
      setFormMsg({ type: "error", text: "Gagal memuat naik lampiran. Sila cuba lagi." });
    }
  };

  const removeMandatoryAttachment = (attKey, id) => {
    setMandatoryFiles(prev => ({ ...prev, [attKey]: (prev[attKey] ?? []).filter(f => f.id !== id) }));
  };

  const FORM_COOLDOWN_MS = 30_000;

  // Shared pre-submit validation, used by both "Hantar Borang" and "Hantar PDF"
  const validateSubmission = (config) => {
    const needsSig = config?.sections?.some(s=>s.fields?.some(f=>f.type==="signature"));
    if (needsSig && !activeSig) {
      return "Sila pilih atau lukis tandatangan di bahagian 'Disediakan Oleh' sebelum menghantar.";
    }
    if (config?.allowSubmitToChoice && !submitTo) {
      return "Sila pilih ke mana borang ini hendak dihantar.";
    }
    if (config?.rowColumnsAllRequired && config.rowColumns && rows.length > 0 && !config.rowsAutoFromTransactions) {
      let hasCompleteRow = false;
      for (const row of rows) {
        const allFilled = config.rowColumns.every(col => row[col.key]?.toString().trim());
        if (allFilled) { hasCompleteRow = true; continue; }
        const anyFilled = config.rowColumns.some(col => row[col.key]?.toString().trim());
        if (config.requireAllRowsFilled) {
          return `Sila lengkapkan kesemua ${rows.length} baris sebelum menghantar.`;
        }
        if (anyFilled) return "Sila lengkapkan semua medan dalam setiap baris senarai sebelum menghantar.";
      }
      if (config.rowsRequireAtLeastOne && !hasCompleteRow) {
        return "Sila lengkapkan sekurang-kurangnya satu baris penyumbang sepenuhnya.";
      }
    }
    if (config?.enforceRequiredFields) {
      const missing = config.fields.find(f => {
        if (!f.required || f.type === "signature") return false;
        if (f.type === "checkbox") return !formData[f.key];
        return !(formData[f.key]?.toString().trim());
      });
      if (missing) return `Sila lengkapkan medan "${missing.label}" sebelum menghantar.`;
    }
    for (const att of config?.mandatoryAttachments ?? []) {
      if (att.required === false) continue;
      if (!(mandatoryFiles[att.key] ?? []).some(f => f.url)) {
        return `Sila muat naik sekurang-kurangnya satu fail untuk "${att.label}".`;
      }
    }
    return null;
  };

  // Combines the user-selected "jawatan" role with the program name at
  // submit/PDF-generation time only, so the dropdown itself keeps showing
  // just the selected role while editing.
  const buildSubmissionFormData = (data, config) => {
    if (!config?.jawatanCombineWithProgram || !data.jawatan) return data;
    const progName = data.nama_program || data.program || "";
    return { ...data, jawatan: progName ? `${data.jawatan} ${progName}` : data.jawatan };
  };

  const mandatoryAttachmentPayload = (config) => {
    const payload = {};
    (config?.mandatoryAttachments ?? []).forEach(att => {
      payload[`${att.key}Files`] = (mandatoryFiles[att.key] ?? []).filter(f => f.url).map(f => ({ url: f.url, name: f.name, path: f.path }));
    });
    return payload;
  };

  // Validate first so the confirm popup never shows on top of an already-invalid form.
  const handleRequestSubmitBorang = () => {
    const config = FORMS_CONFIG.find(f=>f.id===openFormId);
    const validationError = validateSubmission(config);
    if (validationError) { setFormMsg({type:"error",text:validationError}); return; }
    setConfirmSubmitBorang(true);
  };

  const handleSubmitBorang = async () => {
    setConfirmSubmitBorang(false);
    const config=FORMS_CONFIG.find(f=>f.id===openFormId);
    const validationError = validateSubmission(config);
    if (validationError) { setFormMsg({type:"error",text:validationError}); return; }
    const lastKey = `sfms_last_form_${currentUser?.uid}`;
    const last = Number(localStorage.getItem(lastKey) || 0);
    const elapsed = Date.now() - last;
    if (elapsed < FORM_COOLDOWN_MS) {
      const wait = Math.ceil((FORM_COOLDOWN_MS - elapsed) / 1000);
      setFormMsg({type:"error",text:`Sila tunggu ${wait} saat sebelum menghantar borang lagi.`});
      return;
    }
    try {
      setSubmitting(true); setFormMsg({type:"",text:""});
      localStorage.setItem(`sfms_last_form_${currentUser?.uid}`, String(Date.now()));
      const createdByClub = localStorage.getItem(`sfms_club_${currentUser.uid}`) || "";
      const finalFormData = buildSubmissionFormData(formData, config);
      const needsSig = config?.sections?.some(s=>s.fields?.some(f=>f.type==="signature"));
      // Persisted (not just used ephemerally for the live PDF preview) so a
      // complete PDF — including this signature — can be regenerated later,
      // e.g. once a reviewer has approved and added their own section.
      const submitterSignature = needsSig ? await resolveToDataUrl(activeSig) : null;
      await submitBorang({
        formType:config.id, formName:config.title, formData:finalFormData, ...(config.rowColumns?{rows}:{}),
        createdBy:currentUser.uid, createdByEmail:currentUser.email, createdByClub,
        suratKelulusanUrl:suratKelulusan?.url ?? null, suratKelulusanName:suratKelulusan?.name ?? null,
        submitterSignature,
        ...(config.allowSubmitToChoice ? { submitTo } : {}),
        ...mandatoryAttachmentPayload(config),
      });
      clearDraft(config.id,currentUser.uid); refreshDraftList();
      setFormMsg({type:"success",text:"Borang berjaya dihantar untuk kelulusan."});
      await loadSubmissions(); setTimeout(closeForm,1800);
    } catch (e) { console.error(e); setFormMsg({type:"error",text:`Gagal menghantar borang. ${e?.code ?? e?.message ?? "Sila cuba lagi."}`}); }
    finally { setSubmitting(false); }
  };

  const handleJanaPdf = async () => {
    const genFn = openFormId ? PDF_GENERATORS[openFormId] : null;
    if (!genFn) return;
    const cfg = FORMS_CONFIG.find(f => f.id === openFormId);
    const sig = await resolveToDataUrl(activeSig);
    const doc = genFn(buildSubmissionFormData(formData, cfg), rows, sig);
    if (!doc) return;
    const titleSlug = cfg ? cfg.title.replace(/[^a-zA-Z0-9\s]/g,"").trim().replace(/\s+/g,"-").toLowerCase() : "borang";
    const progCode  = progContext?.code ? progContext.code.toUpperCase() : "";
    const filename  = `${titleSlug}${progCode ? `-${progCode}` : ""}.pdf`;
    openPdf(doc, filename);
  };

  // Once a submission has been approved, the reviewer may have added their
  // own section/signature (config.reviewerSection) — regenerate the PDF with
  // that data merged in so the treasurer can download the complete, final version.
  const handleDownloadUpdatedPdf = async (sub) => {
    const genFn = PDF_GENERATORS[sub.formType];
    const cfg = FORMS_CONFIG.find(f => f.id === sub.formType);
    if (!genFn || !cfg) return;
    const mergedData = { ...sub.formData, ...(sub.reviewerData ?? {}) };
    const doc = genFn(mergedData, sub.rows, sub.submitterSignature ?? null);
    if (!doc) return;
    const titleSlug = cfg.title.replace(/[^a-zA-Z0-9\s]/g,"").trim().replace(/\s+/g,"-").toLowerCase();
    openPdf(doc, `${titleSlug}-kemaskini.pdf`);
  };

  const handleRequestDirectPdfSubmit = () => {
    if (!directFormType) { setDirectMsg({type:"error",text:"Sila pilih jenis borang."}); return; }
    if (!directFile) { setDirectMsg({type:"error",text:"Sila muat naik fail PDF."}); return; }
    if (!directSubmitTo) { setDirectMsg({type:"error",text:"Sila pilih ke mana borang ini hendak dihantar."}); return; }
    setConfirmDirectSubmit(true);
  };

  // Muat Naik PDF Terus — bendahari uploads a pre-made PDF directly, choosing which
  // form type it represents and where it should be reviewed, bypassing the digital form.
  const handleDirectPdfSubmit = async () => {
    setConfirmDirectSubmit(false);
    if (!directFormType) { setDirectMsg({type:"error",text:"Sila pilih jenis borang."}); return; }
    if (!directFile) { setDirectMsg({type:"error",text:"Sila muat naik fail PDF."}); return; }
    if (!directSubmitTo) { setDirectMsg({type:"error",text:"Sila pilih ke mana borang ini hendak dihantar."}); return; }
    const cfg = FORMS_CONFIG.find(f => f.id === directFormType);
    if (!cfg) return;
    const lastKey = `sfms_last_form_${currentUser?.uid}`;
    const last = Number(localStorage.getItem(lastKey) || 0);
    const elapsed = Date.now() - last;
    if (elapsed < FORM_COOLDOWN_MS) {
      const wait = Math.ceil((FORM_COOLDOWN_MS - elapsed) / 1000);
      setDirectMsg({type:"error",text:`Sila tunggu ${wait} saat sebelum menghantar borang lagi.`});
      return;
    }
    setDirectSubmitting(true); setDirectMsg({type:"",text:""});
    localStorage.setItem(lastKey, String(Date.now()));
    try {
      const createdByClub = localStorage.getItem(`sfms_club_${currentUser.uid}`) || "";
      await submitPdfBorang(currentUser.uid, currentUser.email, createdByClub, cfg.id, cfg.title, directFile, {
        submitTo: directSubmitTo,
        directUpload: true,
      });
      setDirectMsg({type:"success",text:"PDF berjaya dihantar kepada pihak berkenaan."});
      setDirectFormType(""); setDirectFile(null); setDirectSubmitTo(null);
    } catch (e) { console.error(e); setDirectMsg({type:"error",text:`Gagal menghantar PDF. ${e?.code ?? e?.message ?? "Sila cuba lagi."}`}); }
    finally { setDirectSubmitting(false); }
  };

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
  const fieldClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-100 placeholder:italic placeholder:text-gray-400";
  const activeFormConfig = FORMS_CONFIG.find(f=>f.id===openFormId);
  const hasPdfGen = openFormId && !!PDF_GENERATORS[openFormId];

  const renderField = (field) => {
    const isAF = getAutoFillValue(field.key, openFormId) !== null;
    const aC = "w-full rounded-lg border border-gray-100 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed";
    // Auto-filled fields don't need the "required" asterisk — they're already filled in.
    const req = (field.required && !isAF) ? <span className="ml-0.5 text-red-600">*</span> : null;
    if (field.type === "signature") {
      const noSavedSig = (userProfile?.signatures ?? []).length === 0;
      return (
      <div key={field.key} className="sm:col-span-2">
        <label className="mb-2 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        {!activeSig && noSavedSig && (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Anda belum mempunyai tandatangan tersimpan. Sila tambah tandatangan di bawah sebelum menghantar borang.
          </p>
        )}
        <SignaturePanel
          savedSignatures={userProfile?.signatures ?? []}
          uid={currentUser?.uid}
          activeSig={activeSig}
          onActiveSig={setActiveSig}
          onRefresh={refreshProfile}
        />
      </div>
      );
    }
    if (field.key === "alamat") return (
      <div key="alamat" className="sm:col-span-2">
        <label className="mb-2 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <AddressField formData={formData} onMultiChange={handleMultiFieldChange} fieldClass={fieldClass} uid={currentUser?.uid} />
      </div>
    );
    if (field.type === "info") return (
      <div key={field.key} className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <ol className="list-decimal space-y-2 pl-4 text-sm text-gray-700">
          {(field.content ?? []).map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      </div>
    );
    if (field.type === "checkbox") return (
      <div key={field.key} className={`sm:col-span-2 flex items-start gap-2 rounded-xl border p-3 ${formData[field.key] ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
        <input
          type="checkbox"
          id={`chk-${field.key}`}
          checked={!!formData[field.key]}
          onChange={e=>handleFieldChange(field.key, e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-red-800 focus:ring-red-500"
        />
        <label htmlFor={`chk-${field.key}`} className="text-sm text-gray-700">{field.label}{req}</label>
      </div>
    );
    if (isAF) return (
      <div key={field.key} className={field.key==="organisasi"?"sm:col-span-2":""}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <input type="text" value={formData[field.key]??""} readOnly className={aC} />
      </div>
    );
    if (field.type === "select") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <select value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value)} className={fieldClass}>
          <option value="">— Pilih {field.label} —</option>
          {(field.options??[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
    if (field.key === "namapenuh_penerima") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req} <span className="font-normal text-gray-400">(seperti di IC)</span></label>
        <input type="text" value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value.toUpperCase())} className={fieldClass} placeholder="ALI BIN ABU" />
      </div>
    );
    if (field.key === "no_kp_penerima") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <input type="text" value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,formatIcNumber(e.target.value))} className={fieldClass} placeholder="XXXXXX-XX-XXXX" maxLength={14} />
      </div>
    );
    if (field.type === "number") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <input
          type="text"
          inputMode="decimal"
          value={formData[field.key]??""}
          onChange={e=>handleFieldChange(field.key,filterMoneyInput(e.target.value))}
          onBlur={e=>{ const v=e.target.value; if(v!==""&&!isNaN(Number(v))) handleFieldChange(field.key,Number(v).toFixed(2)); }}
          className={fieldClass}
          placeholder={field.placeholder??field.label}
        />
      </div>
    );
    return (
      <div key={field.key} className={field.type==="textarea"?"sm:col-span-2":""}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        {field.type==="textarea"
          ? <textarea rows={2} value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value)} className={fieldClass} placeholder={field.placeholder??field.label} />
          : <input type={field.type} value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value)} className={fieldClass} placeholder={field.type!=="date"?(field.placeholder??field.label):undefined} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={
          forcedTab === "borang"  ? "Borang Kewangan UTM" :
          forcedTab === "laporan" ? "Penyata Kewangan" :
          "Penyata & Borang Kewangan"
        }
        action={<button onClick={handleBack} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">Kembali</button>} />

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Tab switcher — only shown when this page is not pinned to a single tab */}
        {!forcedTab && (
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit">
            {userRole==="treasurer" && (
              <button onClick={()=>setActiveTab("borang")} className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab==="borang"?"bg-red-900 text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`}>
                Borang Kewangan UTM
              </button>
            )}
            <button onClick={()=>setActiveTab("laporan")} className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab==="laporan"?"bg-red-900 text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`}>
              Penyata Kewangan
            </button>
          </div>
        )}

        {/* ══ TAB: BORANG ══ */}
        {activeTab==="borang" && userRole==="treasurer" && (
          <>
            {/* Workflow chronology banner */}
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
              <div className="bg-red-900 px-6 py-4">
                <p className="text-base font-bold text-white">Aliran Proses Borang Kewangan UTM</p>
              </div>
              <div className="overflow-x-auto px-5 py-6">
                <div className="flex min-w-[580px] items-start">
                  {[
                    { n:"1", label:"Isi Borang Baru", sub:'Tekan "Isi Borang Baru"',          bg:"bg-red-900" },
                    { n:"2", label:"Sudah Dihantar",  sub:"Hantar untuk semakan",              bg:"bg-amber-500" },
                    { n:"3", label:"Sedang Disemak",  sub:"Penasihat Kelab/Pegawai Kewangan membuka borang",  bg:"bg-blue-500" },
                    { n:"4", label:"Diluluskan/Tolak",sub:"Keputusan Penasihat Kelab/Pegawai Kewangan",       bg:"bg-green-600" },
                    { n:"5", label:"Selesai",          sub:"Proses lengkap",                   bg:"bg-purple-600" },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex flex-1 items-start">
                      <div className="flex flex-col items-center gap-2 w-full">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${step.bg} shadow-sm shrink-0`}>
                          <span className="text-base font-bold text-white">{step.n}</span>
                        </div>
                        <p className="text-center text-sm font-semibold text-gray-800 leading-tight px-1">{step.label}</p>
                        <p className="text-center text-xs text-gray-400 leading-tight px-1">{step.sub}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="flex items-center pt-5 shrink-0 w-7">
                          <span className="text-gray-300 text-xl">›</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Draf Borang section — always on top, email-inbox style */}
            <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
              <button
                onClick={() => setShowDrafts(s => !s)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-amber-50 transition text-left rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7l9 6 9-6" />
                    </svg>
                    {draftList.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white leading-none">
                        {draftList.length}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-amber-800">Draf Borang</h2>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {draftList.length > 0 ? `${draftList.length} draf belum dihantar` : "Tiada draf tersimpan"}
                    </p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-amber-500 transition-transform duration-200 ${showDrafts ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showDrafts && (
                draftList.length === 0 ? (
                  <div className="border-t border-amber-100 px-6 py-6 text-center">
                    <p className="text-sm text-gray-400">Tiada draf tersimpan. Tekan &quot;Isi Borang Baru&quot; untuk mula mengisi.</p>
                  </div>
                ) : (
                  <div className="border-t border-amber-100 divide-y divide-gray-100">
                    {draftList.map(({ config, savedAt }) => (
                      <div key={config.id} className="flex items-center justify-between px-6 py-4 hover:bg-amber-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{config.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Disimpan: {savedAt ? new Date(savedAt).toLocaleString("ms-MY",{dateStyle:"medium",timeStyle:"short"}) : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4">
                          <button onClick={()=>openForm(config)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600">Teruskan</button>
                          <button onClick={()=>{ clearDraft(config.id,currentUser.uid); refreshDraftList(); }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">Buang</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Muat Naik PDF Terus — upload a pre-made PDF directly instead of filling the digital form */}
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-900">Muat Naik PDF Terus</h2>
              <p className="mt-0.5 mb-4 text-xs text-blue-600">
                Sudah ada borang PDF siap diisi? Muat naik terus di sini tanpa perlu mengisi borang digital.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">1. Jenis Borang</label>
                  <select
                    value={directFormType}
                    onChange={e => { setDirectFormType(e.target.value); setDirectSubmitTo(null); setDirectMsg({type:"",text:""}); }}
                    className={inputClass}
                  >
                    <option value="">— Pilih jenis borang —</option>
                    {FORMS_CONFIG.map((config, idx) => (
                      <option key={config.id} value={config.id}>{idx+1}. {config.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">2. Muat Naik Fail PDF</label>
                  {directFile ? (
                    <div className="flex items-center gap-3">
                      <span className="flex-1 truncate rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">✓ {directFile.name}</span>
                      <button type="button" onClick={() => setDirectFile(null)} className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">✕</button>
                    </div>
                  ) : (
                    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
                      ↑ Pilih Fail PDF
                      <input type="file" accept="application/pdf" className="hidden" onChange={e=>{ if(e.target.files[0]) { setDirectFile(e.target.files[0]); setDirectMsg({type:"",text:""}); } }} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">3. Hantar Kepada</label>
                  <div className="flex gap-3">
                    {(FORMS_CONFIG.find(f => f.id === directFormType)?.submitToOptions ?? ["advisor","pegawai"]).map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDirectSubmitTo(value)}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition ${directSubmitTo===value ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"}`}
                      >
                        {directSubmitTo===value ? "✓ " : ""}{SUBMIT_TO_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>

                {directMsg.text && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${directMsg.type==="success"?"border-green-200 bg-green-50 text-green-700":"border-red-200 bg-red-50 text-red-700"}`}>
                    {directMsg.text}
                  </div>
                )}

                <button
                  onClick={handleRequestDirectPdfSubmit}
                  disabled={directSubmitting}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {directSubmitting ? "Menghantar..." : "Hantar PDF"}
                </button>
              </div>
            </div>

            {/* Form cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FORMS_CONFIG.map((config, idx) => (
                <div key={config.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">{idx+1}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">{config.title}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{config.subtitle}</p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button onClick={()=>handleStartNewForm(config)} className="w-full rounded-xl bg-red-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
                      Isi Borang Baru
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Status Penyerahan Borang */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">Status Penyerahan Borang</h2>
              </div>
              {loadingSubmissions ? (
                <p className="p-6 text-sm text-gray-500">Memuatkan senarai borang...</p>
              ) : submissions.length===0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada borang dihantar lagi.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-900 text-left">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Jenis Borang</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tarikh Hantar</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Status</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Disemak Oleh</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {submissions.map(sub=>(
                        <tr key={sub.id} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.formName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{sub.createdAt?.toDate?sub.createdAt.toDate().toLocaleDateString("ms-MY"):"—"}</td>
                          <td className="px-4 py-3"><span className={statusBadge(sub.status)}>{statusLabel(sub.status)}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{sub.reviewedByEmail||<span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3">
                            {sub.status === "diluluskan" && PDF_GENERATORS[sub.formType] ? (
                              <button onClick={() => handleDownloadUpdatedPdf(sub)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700">
                                Muat Turun PDF Kemaskini
                              </button>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ TAB: LAPORAN ══ */}
        {activeTab==="laporan" && (
          <>
            {progContext&&userRole==="treasurer"&&(
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                Menunjukkan penyata untuk <span className="font-bold">{progContext.code}</span> — {progContext.name}
              </div>
            )}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-red-700">Jana Penyata</h2>

              {/* Filter mode toggle */}
              <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
                <button
                  onClick={() => setFilterMode("julat")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filterMode==="julat" ? "bg-white text-red-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Julat Tarikh
                </button>
                <button
                  onClick={() => setFilterMode("keseluruhan")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filterMode==="keseluruhan" ? "bg-white text-red-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Keseluruhan Program
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${filterMode==="keseluruhan" ? "text-gray-300" : "text-gray-700"}`}>Tarikh Mula</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e=>setStartDate(e.target.value)}
                    disabled={filterMode==="keseluruhan"}
                    className={`${inputClass} ${filterMode==="keseluruhan" ? "cursor-not-allowed bg-gray-50 text-gray-300" : ""}`}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${filterMode==="keseluruhan" ? "text-gray-300" : "text-gray-700"}`}>Tarikh Akhir</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e=>setEndDate(e.target.value)}
                    disabled={filterMode==="keseluruhan"}
                    className={`${inputClass} ${filterMode==="keseluruhan" ? "cursor-not-allowed bg-gray-50 text-gray-300" : ""}`}
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={handleLoadReport} disabled={loading} className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60">
                    {loading ? "Memuatkan..." : "Jana Penyata"}
                  </button>
                </div>
                <div className="flex items-end">
                  <button onClick={handleDownloadPdf} disabled={!records.length} className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 disabled:opacity-60">
                    Muat Turun PDF
                  </button>
                </div>
              </div>

              {filterMode==="keseluruhan" && (
                <p className="mt-3 text-xs text-gray-400">Semua transaksi dalam program akan disertakan tanpa tapis tarikh.</p>
              )}

              {errorMsg&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}
              {message&&<div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-green-600">Jumlah Pendapatan</p><h2 className="mt-2 text-2xl font-bold text-gray-900">RM {summary.totalIncome.toFixed(2)}</h2></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-red-600">Jumlah Perbelanjaan</p><h2 className="mt-2 text-2xl font-bold text-gray-900">RM {summary.totalExpense.toFixed(2)}</h2></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Baki</p><h2 className="mt-2 text-2xl font-bold text-gray-900">RM {summary.balance.toFixed(2)}</h2></div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-red-100 px-6 py-4"><h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">Transaksi Diluluskan</h2></div>
              {!records.length ? <p className="p-6 text-sm text-gray-500">Tiada transaksi dijumpai. Jana penyata terlebih dahulu.</p> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead><tr className="bg-red-900 text-left">
                      {["Program","Tarikh","Catatan","Kategori","Jenis","Jumlah","Dibuat Oleh"].map(h=>(
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-red-50">
                      {records.map(item=>(
                        <tr key={item.id} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3">{item.programmeCode?(<div><span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{item.programmeCode}</span><p className="mt-0.5 text-xs text-gray-500">{item.programmeName}</p></div>):<span className="text-xs text-gray-400">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{typeLabel(item.type)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">RM {Number(item.amount||0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.createdByEmail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ MODAL: ISI BORANG ══ */}
      {openFormId && activeFormConfig && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl mb-8">
            <div className="sticky top-0 z-10 flex items-start justify-between rounded-t-2xl border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">{activeFormConfig.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{activeFormConfig.subtitle}</p>
              </div>
              <button onClick={closeForm} className="ml-4 shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>

            {hasDraft && (
              <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-xs font-medium text-amber-800">Draf dijumpai — maklumat sebelum ini telah dipulihkan secara automatik.</p>
                <button onClick={discardDraft} className="ml-4 shrink-0 text-xs font-semibold text-amber-700 underline hover:text-amber-900">Buang Draf</button>
              </div>
            )}

            <div className="px-6 py-5 space-y-6">
              {activeFormConfig.sections && <p className="text-xs text-gray-400"><span className="font-bold text-red-600">*</span> Medan bertanda wajib diisi</p>}
              {(() => {
                const hasRowSection = activeFormConfig.sections?.some(s=>s.isRowSection);
                const hasSignatureInSection = activeFormConfig.sections?.some(s=>s.fields?.some(f=>f.type==="signature"));
                return (
                  <>
                    {activeFormConfig.sections
                      ? activeFormConfig.sections.map(section=>(
                          <div key={section.id}>
                            <div className="mb-3 flex items-center gap-2">
                              <span className={`flex h-6 items-center justify-center rounded-full bg-red-900 text-xs font-bold text-white ${section.id.length>2?"px-3":"w-6"}`}>{section.id}</span>
                              <h4 className="text-sm font-bold text-gray-800">{section.label}</h4>
                              {!section.required && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Pilihan</span>}
                            </div>
                            {section.isRowSection ? (
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                {section.rowSectionFields && (
                                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                    {section.rowSectionFields.map(renderField)}
                                  </div>
                                )}
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-xs text-gray-500">
                                    {activeFormConfig.rowsAutoFromTransactions
                                      ? `${rows.length} transaksi perbelanjaan direkodkan`
                                      : activeFormConfig.fixedRowCount ? `${rows.length} entri (tetap pada ${activeFormConfig.fixedRowCount})` : `${rows.length} entri`}
                                  </p>
                                  {!activeFormConfig.fixedRowCount && !activeFormConfig.rowsAutoFromTransactions && (
                                    <button type="button" onClick={addRow} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">+ Tambah Penyumbang</button>
                                  )}
                                </div>
                                {activeFormConfig.rowsAutoFromTransactions ? (
                                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Bil</th>
                                          {activeFormConfig.rowColumns.map(col=><th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>)}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {rows.length === 0 ? (
                                          <tr><td colSpan={activeFormConfig.rowColumns.length+1} className="px-3 py-4 text-center italic text-gray-400">Tiada transaksi perbelanjaan direkodkan untuk program ini.</td></tr>
                                        ) : rows.map((row,ri)=>(
                                          <tr key={ri}>
                                            <td className="px-3 py-2 font-medium text-gray-500">{ri+1}</td>
                                            {activeFormConfig.rowColumns.map(col=>(
                                              <td key={col.key} className="px-3 py-2 text-gray-800">{row[col.key] || <span className="italic text-gray-400">—</span>}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                      {rows.length > 0 && (
                                        <tfoot>
                                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-800">
                                            <td className="px-3 py-2 text-right" colSpan={activeFormConfig.rowColumns.length}>Jumlah Keseluruhan (RM)</td>
                                            <td className="px-3 py-2">RM {rows.reduce((s,r)=>s+Number(r.jumlah||0),0).toFixed(2)}</td>
                                          </tr>
                                        </tfoot>
                                      )}
                                    </table>
                                  </div>
                                ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Bil</th>
                                        {activeFormConfig.rowColumns.map(col=><th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>)}
                                        <th className="px-3 py-2"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {rows.map((row,ri)=>(
                                        <tr key={ri}>
                                          <td className="px-3 py-2 font-medium text-gray-500">{ri+1}</td>
                                          {activeFormConfig.rowColumns.map(col=>(
                                            <td key={col.key} className="px-3 py-1.5">
                                              <div
                                                onClick={()=>{
                                                  if (col.inputType==="address") {
                                                    const p=parseAlamatPenuh(row[col.key]??"");
                                                    setCellPopout({ri,key:col.key,label:col.label,placeholder:col.placeholder,inputType:"address",
                                                      addr:{alamat_1:p.baris1,alamat_2:p.baris2,alamat_poskod:p.poskod,alamat_bandar:p.bandar,alamat_negeri:p.negeri,alamat:row[col.key]??""}});
                                                  } else {
                                                    setCellPopout({ri,key:col.key,label:col.label,placeholder:col.placeholder,inputType:col.inputType||"text",tempValue:row[col.key]??""});
                                                  }
                                                }}
                                                className="min-w-[100px] cursor-pointer rounded border border-gray-200 px-2 py-1.5 text-xs transition hover:border-red-300 hover:bg-red-50"
                                              >
                                                {row[col.key]
                                                  ? <span className="text-gray-800">{row[col.key]}</span>
                                                  : <span className="italic text-gray-400">{col.placeholder??col.label}</span>}
                                              </div>
                                            </td>
                                          ))}
                                          <td className="px-3 py-1.5">
                                            <div className="flex gap-1">
                                              <button type="button" onClick={()=>handleRowConfirmClick(ri,row,activeFormConfig)} title="Sahkan baris ini" className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600">✓</button>
                                              {rows.length>1&&!activeFormConfig.fixedRowCount&&<button type="button" onClick={()=>handleRowRemoveClick(ri,row,activeFormConfig)} title="Buang baris ini" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <div className="grid gap-4 sm:grid-cols-2">{section.fields.map(renderField)}</div>
                              </div>
                            )}
                          </div>
                        ))
                      : <div className="grid gap-4 sm:grid-cols-2">{activeFormConfig.fields.map(renderField)}</div>
                    }

                    {activeFormConfig.rowColumns && !hasRowSection && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Senarai Baris</p>
                          <button type="button" onClick={addRow} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">+ Tambah Baris</button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Bil</th>
                                {activeFormConfig.rowColumns.map(col=><th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>)}
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {rows.map((row,ri)=>(
                                <tr key={ri}>
                                  <td className="px-3 py-2 font-medium text-gray-500">{ri+1}</td>
                                  {activeFormConfig.rowColumns.map(col=>(
                                    <td key={col.key} className="px-3 py-1.5">
                                      <input type="text" value={row[col.key]??""} onChange={e=>handleRowChange(ri,col.key,e.target.value)} className="w-full min-w-[100px] rounded border border-gray-200 px-2 py-1 text-xs italic placeholder:text-gray-400 outline-none focus:border-red-400" placeholder={col.placeholder??col.label} />
                                    </td>
                                  ))}
                                  <td className="px-3 py-1.5">{rows.length>1&&<button type="button" onClick={()=>removeRow(ri)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── Surat Kelulusan Program ── */}
                    {!activeFormConfig.hideSuratKelulusan && (
                      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Surat Kelulusan Program</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Pilihan</span>
                        </div>
                        <p className="mb-3 text-xs text-amber-700">Muat naik surat kelulusan program jika ada. (PDF atau imej diterima)</p>
                        {suratKelulusan?.url ? (
                          <div className="flex items-center gap-3">
                            <span className="flex-1 truncate rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">✓ {suratKelulusan.name}</span>
                            <label className="cursor-pointer rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                              Tukar
                              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e=>{if(e.target.files[0])handleSuratUpload(e.target.files[0]);}} />
                            </label>
                          </div>
                        ) : suratKelulusan?.uploading ? (
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                            Memuat naik...
                          </div>
                        ) : (
                          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                            ↑ Pilih & Muat Naik Surat Kelulusan
                            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e=>{if(e.target.files[0])handleSuratUpload(e.target.files[0]);}} />
                          </label>
                        )}
                      </div>
                    )}

                    {/* ── Lampiran (config.mandatoryAttachments) ── */}
                    {(activeFormConfig.mandatoryAttachments ?? []).map(att => {
                      const files = mandatoryFiles[att.key] ?? [];
                      const atCap = att.maxFiles && files.length >= att.maxFiles;
                      return (
                      <div key={att.key} className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-900">{att.label}</span>
                          {att.required === false ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Pilihan</span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Wajib</span>
                          )}
                          {att.maxFiles && <span className="text-xs text-amber-600">({files.length}/{att.maxFiles} fail)</span>}
                        </div>
                        <p className="mb-3 text-xs text-amber-700">{att.hint}</p>
                        <div className="space-y-2">
                          {files.map(f => (
                            <div key={f.id} className="flex items-center gap-3">
                              {f.uploading ? (
                                <div className="flex flex-1 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-700">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                  Memuat naik {f.name}...
                                </div>
                              ) : (
                                <span className="flex-1 truncate rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">✓ {f.name}</span>
                              )}
                              <button type="button" onClick={() => removeMandatoryAttachment(att.key, f.id)} className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">✕</button>
                            </div>
                          ))}
                        </div>
                        {atCap ? (
                          <p className="mt-2 text-xs italic text-amber-600">Had maksimum fail telah dicapai. Padam satu fail untuk muat naik yang baru.</p>
                        ) : (
                          <label className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                            ↑ Pilih & Muat Naik Fail
                            <input type="file" accept={att.accept ?? "application/pdf,image/*"} className="hidden" onChange={e=>{if(e.target.files[0])handleMandatoryAttachmentUpload(e.target.files[0], att.key);e.target.value="";}} />
                          </label>
                        )}
                      </div>
                      );
                    })}

                    {/* ── Tandatangan untuk PDF ── */}
                    {hasPdfGen && !hasSignatureInSection && (
                      <SignaturePanel
                        savedSignatures={userProfile?.signatures ?? []}
                        uid={currentUser?.uid}
                        activeSig={activeSig}
                        onActiveSig={setActiveSig}
                        onRefresh={refreshProfile}
                      />
                    )}
                  </>
                );
              })()}

              {/* ── Hantar Kepada (config.allowSubmitToChoice) ── */}
              {activeFormConfig.allowSubmitToChoice && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Hantar Kepada <span className="font-bold text-red-600">*</span>
                  </p>
                  <div className="flex gap-3">
                    {(activeFormConfig.submitToOptions ?? ["advisor","pegawai"]).map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSubmitTo(value)}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition ${submitTo===value ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100"}`}
                      >
                        {submitTo===value ? "✓ " : ""}{SUBMIT_TO_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formMsg.text && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${formMsg.type==="success"?"border-green-200 bg-green-50 text-green-700":"border-red-200 bg-red-50 text-red-700"}`}>
                  {formMsg.text}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button onClick={handleRequestSubmitBorang} disabled={submitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {submitting?"Menghantar...":"Hantar Borang"}
              </button>
              {hasPdfGen && (
                <button onClick={handleJanaPdf} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${activeSig?"border-green-600 bg-green-600 text-white hover:bg-green-700":"border-green-600 bg-white text-green-700 hover:bg-green-50"}`} title={activeSig?"Muat turun PDF":"Muat turun PDF (tiada tandatangan)"}>
                  Muat Turun PDF{activeSig ? " ✓" : ""}
                </button>
              )}
              <button onClick={closeForm} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">Batal</button>
            </div>

            {/* ── CellPopout Modal ── */}
            {cellPopout && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
                <div className={`w-full rounded-2xl bg-white p-6 shadow-xl ${cellPopout.inputType==="address"?"max-w-md":"max-w-sm"}`}>
                  <h3 className="mb-3 text-sm font-bold text-gray-900">{cellPopout.label}</h3>

                  {cellPopout.inputType === "address" ? (
                    <AddressField
                      formData={cellPopout.addr}
                      onMultiChange={(updates)=>setCellPopout(p=>({...p,addr:{...p.addr,...updates}}))}
                      fieldClass={fieldClass}
                    />
                  ) : cellPopout.inputType === "date" ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cellPopout.tempValue}
                        onChange={e=>setCellPopout(p=>({...p,tempValue:formatDateTyped(e.target.value)}))}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                        placeholder={cellPopout.placeholder??"cth. 2025-04-01"}
                        maxLength={10}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs text-gray-400">atau pilih dari kalendar:</span>
                        <input
                          type="date"
                          value={cellPopout.tempValue}
                          onChange={e=>setCellPopout(p=>({...p,tempValue:e.target.value}))}
                          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                      </div>
                    </div>
                  ) : cellPopout.inputType === "money" ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cellPopout.tempValue}
                      onChange={e=>setCellPopout(p=>({...p,tempValue:filterMoneyInput(e.target.value)}))}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                      placeholder={cellPopout.placeholder??"0.00"}
                      autoFocus
                    />
                  ) : cellPopout.inputType === "uppercase" ? (
                    <input
                      type="text"
                      value={cellPopout.tempValue}
                      onChange={e=>setCellPopout(p=>({...p,tempValue:e.target.value.toUpperCase()}))}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                      placeholder={cellPopout.placeholder??cellPopout.label}
                      autoFocus
                    />
                  ) : (
                    <textarea
                      value={cellPopout.tempValue}
                      onChange={e=>setCellPopout(p=>({...p,tempValue:e.target.value}))}
                      className="min-h-[100px] w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                      placeholder={cellPopout.placeholder??cellPopout.label}
                      autoFocus
                    />
                  )}

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={()=>{
                        if (cellPopout.inputType==="address") {
                          handleRowChange(cellPopout.ri,cellPopout.key,cellPopout.addr.alamat);
                        } else if (cellPopout.inputType==="money") {
                          const n = Number(cellPopout.tempValue);
                          handleRowChange(cellPopout.ri,cellPopout.key, cellPopout.tempValue!==""&&!isNaN(n) ? n.toFixed(2) : "");
                        } else {
                          handleRowChange(cellPopout.ri,cellPopout.key,cellPopout.tempValue);
                        }
                        setCellPopout(null);
                      }}
                      className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                    >Selesai</button>
                    <button
                      onClick={()=>setCellPopout(null)}
                      className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    >Batal</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Existing draft prompt (before starting a "new" form) ── */}
      {existingDraftPrompt && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Draf Belum Selesai Dijumpai</h3>
            <p className="mb-6 text-sm text-gray-500">
              Anda mempunyai draf belum selesai untuk <span className="font-semibold text-gray-800">{existingDraftPrompt.config.title}</span>. Adakah anda ingin menyambung draf tersebut, atau mula borang baru (draf lama akan dibuang)?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleContinueExistingDraft} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
                Sambung Draf Sebelum Ini
              </button>
              <button onClick={handleDiscardExistingDraft} className="w-full rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                Mula Borang Baru (Buang Draf)
              </button>
              <button onClick={() => setExistingDraftPrompt(null)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm submit borang ── */}
      {confirmSubmitBorang && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Sahkan Penghantaran Borang?</h3>
            <p className="mb-6 text-sm text-gray-500">
              Borang <span className="font-semibold text-gray-800">{activeFormConfig?.title}</span> akan dihantar untuk kelulusan. Semak semula sebelum menghantar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubmitBorang(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleSubmitBorang} disabled={submitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {submitting ? "Menghantar..." : "Ya, Hantar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm direct PDF submit ── */}
      {confirmDirectSubmit && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Sahkan Penghantaran PDF?</h3>
            <p className="mb-6 text-sm text-gray-500">
              PDF ini akan dihantar kepada <span className="font-semibold text-gray-800">{SUBMIT_TO_LABELS[directSubmitTo]}</span>. Semak semula sebelum menghantar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDirectSubmit(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleDirectPdfSubmit} disabled={directSubmitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {directSubmitting ? "Menghantar..." : "Ya, Hantar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm row add/remove popup ── */}
      {confirmRowAction && (() => {
        const isRemove = confirmRowAction.type === "remove";
        const noun = activeFormConfig?.id === "penyerahan-cek-wang-tunai" ? "penyumbang" : "entri";
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isRemove ? "bg-red-100" : "bg-green-100"}`}>
                {isRemove ? (
                  <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                  </svg>
                ) : (
                  <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <h3 className="mb-2 text-base font-bold text-gray-900">
                {isRemove ? `Buang ${noun} ini?` : `Sahkan Tambah ${noun[0].toUpperCase()+noun.slice(1)}?`}
              </h3>
              {confirmRowAction.label && (
                <p className="mb-6 text-sm text-gray-500"><span className="font-semibold text-gray-800">{confirmRowAction.label}</span></p>
              )}
              <div className="flex gap-3">
                <button onClick={()=>setConfirmRowAction(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
                <button
                  onClick={handleRowActionConfirmed}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition ${isRemove ? "bg-red-600 hover:bg-red-700" : "bg-red-900 hover:bg-red-800"}`}
                >
                  {isRemove ? "Ya, Buang" : "Ya, Sahkan"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Row action success popup ── */}
      {rowActionSuccess && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">{rowActionSuccess}</p>
            <button onClick={()=>setRowActionSuccess("")} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
