// borangPdfGenerators.js

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Shared PDF styles ────────────────────────────────────────────────────────
const TS = { fontSize: 9, cellPadding: 2.5, textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.2 };
const HS = { fillColor: [210,210,210], textColor: [0,0,0], fontStyle: "bold", lineColor: [0,0,0], lineWidth: 0.2 };
const LC = { cellWidth: 52, fontStyle: "bold", fillColor: [220,220,220], textColor: [0,0,0] };
const fmtRM = (v) => { const n = Number(v); return (isNaN(n)||v===""||v==null) ? "RM 0.00" : `RM ${n.toFixed(2)}`; };

// Downloads the PDF once — no extra blank tab
export function openPdf(doc, filename = "borang.pdf") {
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
export const PDF_GENERATORS = {
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
