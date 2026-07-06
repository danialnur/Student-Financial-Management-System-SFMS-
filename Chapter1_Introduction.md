# CHAPTER 1: INTRODUCTION

---

## 1.1 Introduction

Managing the finances of student-led programmes was as demanding as organising the programmes themselves — particularly when the process relied on manual, paper-based workflows. At Universiti Teknologi Malaysia (UTM), student programmes represented an essential component of student development. They provided students with practical opportunities to develop leadership, organisational, and teamwork skills through activities such as workshops, community service, academic competitions, and innovation-focused initiatives.

To carry out these programmes, student committees were required to submit a formal proposal and budget to university departments such as TNCHEPA or UTMXCITE for approval. Upon approval, partial or full financial support was granted depending on the nature and scale of the proposed activity. Once the programme was completed, the appointed treasurer was responsible for managing all financial documentation and submitting a financial report — including a detailed spending breakdown, original receipts, payment confirmations, and approval documents — within 14 working days after the event.

In practice, most financial records were maintained using spreadsheets, printed receipts, and scanned documents. Financial reports and supporting materials were submitted via email or delivered physically. Receipts were frequently placed on A4 paper and scanned into soft copies for archiving. This method was time-consuming and error-prone, often involving miscommunication, missing attachments, and delays in approvals that extended beyond the mandated 14-day deadline.

These persistent difficulties created a clear need for a centralised, web-based financial management system specifically tailored to the requirements of student-run programmes at UTM. Such a system was designed to streamline the financial recording process, reduce the administrative workload, and promote greater transparency and accountability across all stages of the financial reporting workflow.

---

## 1.2 Problem Background

When a student programme proposal was accepted and funding was granted at UTM, financial responsibilities were assigned to the treasurer. The treasurer was charged with tracking all expenditure, storing receipts, and submitting a complete financial report containing a spending breakdown, supporting documents, and approval signatures. The deadline for this submission was 14 working days after the programme to ensure timely auditing and reimbursement.

In practice, a number of recurring problems affected this process. An interview conducted with Panji Alam, a BAPP UTM staff member, revealed the following issues in the current student financial reporting process:

- **Approval delays**: On average, the approval process took 14 to 21 working days, well beyond the official 14-day reporting deadline.
- **High revision rate**: Over 70% of submitted financial reports were returned at least once for revision, due to missing documentation or incorrect entries.
- **Receipt loss**: Between 30% and 40% of programmes faced missing or unreadable receipts, especially those submitted without digital backups. Thermal paper receipts faded over time and were easily damaged before scanning.
- **Inconsistent expense justification**: There was no formalised procedure for justifying unexpected or out-of-budget expenditures, leading to inconsistency in how such cases were reviewed and approved across different advisors and programmes.

These delays interrupted the reimbursement cycle and caused frustration for student committee members who had personally funded programme expenses while awaiting reimbursement. The reliance on manual spreadsheets and physical document circulation contributed significantly to these inefficiencies.

The absence of a centralised digital system meant that each programme's financial records were maintained in isolation, with no shared visibility for supervisory roles such as advisors and finance officers. Different reviewers applied inconsistent standards, and there was no audit trail linking transactions to the individuals who reviewed and approved them.

These problems highlighted the need for a structured, web-based financial management system that supported real-time digital receipt uploads, a standardised multi-level approval workflow, centralised transaction records, and automated generation of the standardised UTM financial forms required for submission.

---

## 1.3 Aim of the Project

The primary aim of this project was to design, develop, and evaluate a web-based Smart Financial Management System (SFMS) for student clubs at Bahagian Aktiviti dan Pembangunan Pelajar (BAPP), Universiti Teknologi Malaysia. The system was intended to provide student treasurers with a secure, role-governed digital platform for recording financial transactions, uploading receipts, submitting standardised financial forms, and generating official PDF financial reports. The platform was also designed to support supervisory roles — including Advisor, Club Treasurer (Bendahari Kelab), and Officer (Pegawai) — in reviewing and approving transactions and financial form submissions through a structured multi-level approval workflow, thereby improving the timeliness, transparency, and accuracy of the financial reporting process at BAPP UTM.

---

## 1.4 Project Objectives

The objectives of this project were:

1. **To identify** the financial management challenges and system requirements of student clubs at BAPP UTM through stakeholder consultation and analysis of the existing manual financial reporting process.

2. **To design** a web-based financial management system incorporating a five-role hierarchy (Treasurer, Club Treasurer / Bendahari Kelab, Advisor / Penasihat, Officer / Pegawai, and Administrator) with a multi-level approval workflow and role-based access control enforced at the routing level.

3. **To develop and implement** the designed system using React 18 and Google Firebase, delivering core features comprising programme-scoped transaction management with digital receipt upload, financial form (borang) submission for nine standardised UTM form templates, and client-side PDF report generation with embedded digital signatures.

4. **To evaluate** the system's functional correctness and usability through white box testing of key functions, black box testing of all 27 protected system routes across the five role modules, and user acceptance testing (UAT) with representative end-users drawn from the target user groups.

---

## 1.5 Project Scope

The scope of the SFMS project was defined as follows:

- **Users**: The system served five distinct user roles — Treasurer (Bendahari), Club Treasurer (Bendahari Kelab), Advisor (Penasihat), Officer (Pegawai), and System Administrator — corresponding to the roles involved in the financial approval chain at BAPP UTM.
- **Platform**: The system was developed as a web-based single-page application (SPA) accessible through any modern web browser without software installation. No native mobile application was developed as part of this project.
- **Core Features**: The system provided transaction management (record, edit, delete, approve, reject), digital receipt upload and storage, nine standardised UTM financial form templates with PDF generation, multi-level approval workflows, role-specific financial dashboard summaries, user account management, and programme management.
- **Data Scope**: The system was tested and evaluated using simulated programme data and accounts seeded for demonstration purposes. The system was not integrated with UTM's live financial disbursement systems or existing UTMXCITE/TNCHEPA databases, and did not process actual fund transfers.
- **Institution**: The system was designed specifically for the operational context of BAPP UTM, with the nine financial form templates, approval hierarchy, and role definitions based on BAPP's existing financial management procedures.

---

## 1.6 Project Significance

The significance of this project lay in its direct response to documented inefficiencies in the financial management of student clubs at BAPP UTM. By digitising the full lifecycle of a financial transaction — from initial entry and receipt upload through multi-level review to PDF report generation and submission — the SFMS eliminated the reliance on manual spreadsheets, physical receipt handling, and ad-hoc email-based approval chains.

The system's significance extended across multiple dimensions:

- **Operational efficiency**: By centralising all financial records in a Cloud Firestore database accessible by all relevant roles, the system eliminated approval delays caused by sequential physical document handoffs and the need for manual follow-up with individual reviewers.
- **Documentation integrity**: Digital receipt upload to Firebase Storage with deletion cascading to transaction records ensured that receipts were permanently linked to the transactions they supported, eliminating the 30–40% receipt loss rate identified in the problem background.
- **Transparency and accountability**: Every transaction and form submission recorded the creating user's UID and timestamp, and every approval or rejection recorded the reviewer's UID, email, and timestamp — creating a permanent, structured audit trail without requiring a dedicated audit log system.
- **Standardisation**: The nine UTM financial form templates standardised the format of financial reports submitted for review, reducing the over-70% revision return rate attributable to inconsistent or incomplete reporting.
- **Scalability**: The serverless Firebase architecture allowed the system to serve all student clubs across six BAPP categories and approximately 111 clubs without requiring dedicated server provisioning or maintenance.

The system also demonstrated that a fully functional, role-governed financial management platform for a university institutional context could be delivered using a serverless cloud architecture with no dedicated application server, offering a cost-effective and maintainable model for similar digitisation initiatives in higher education.

---

## 1.7 Report Organisation

This report was organised into six chapters. Chapter 1 provided the introduction, covering the problem background, project aim, four objectives, project scope, and significance of the SFMS. Chapter 2 presented the literature review, examining existing financial management practices and their shortcomings, reviewing four comparable digital tools (Wave, TidyHQ, Zoho Expense, and MoneyMinder), and evaluating the key technologies — Firebase, React, Tailwind CSS, jsPDF, and related libraries — that informed the system design. Chapter 3 described the Agile-Kanban development methodology, the five development phases executed across PSM1 and PSM2, the three-tier testing strategy, the technology stack, and the system's hardware and software requirements. Chapter 4 presented the system design through UML diagrams (use case, sequence, activity, class), data flow diagrams at Level-0 and Level-1, the entity relationship diagram, the Firestore collection schema, and interface design mockups for the five role modules. Chapter 5 documented the system implementation, including actual code snippets from the built system, and reported the results of white box testing, black box testing, and user acceptance testing. Chapter 6 concluded the report by summarising the achievement of each of the four project objectives, identifying the system's inherent limitations, and recommending directions for future development.

---

## 1.8 Chapter Summary

This chapter established the context and motivation for the development of the Smart Financial Management System. Section 1.2 identified the key problems in the current manual financial management process at BAPP UTM — including approval delays of 14 to 21 working days, a 70% report revision rate, and 30–40% receipt loss — based on an interview with a BAPP staff member. Section 1.3 stated the project's aim to deliver a web-based, role-governed financial management platform for student clubs. Section 1.4 defined four project objectives covering requirements identification, system design, system development, and system evaluation. Section 1.5 scoped the system to five user roles, nine UTM form templates, and web-based delivery for BAPP UTM. Section 1.6 articulated the significance of the system in terms of operational efficiency, documentation integrity, transparency, and scalability. The remainder of the report follows the structure described in Section 1.7.
