# CHAPTER 6: CONCLUSION

---

## 6.1 Introduction

This chapter presents the conclusion of the Smart Financial Management System (SFMS) project. The chapter revisits the project objectives and evaluates the extent to which each objective was achieved, summarises the contribution of the system to the financial management process at Bahagian Aktiviti dan Pembangunan Pelajar (BAPP), Universiti Teknologi Malaysia, and discusses the limitations of the system as currently implemented. The chapter concludes with recommendations for future work that would extend or improve the capabilities of the SFMS beyond the scope of this project.

---

## 6.2 Summary of the Project

The SFMS was developed to address the shortcomings of the existing paper-based financial management process used by student clubs at UTM. Before the system was developed, treasurers maintained financial records manually, approval processes were conducted via physical document handoffs, and there was no centralised repository for financial history or submitted forms. These practices led to delays, inconsistencies, and limited visibility for supervisory roles.

The developed system provided a web-based platform built with React 18, Tailwind CSS, and Google Firebase (Authentication, Cloud Firestore, and Firebase Storage), deployed as a single-page application accessible through any modern web browser. The system implemented a five-role hierarchy — Treasurer, Club Treasurer (Bendahari Kelab), Advisor, Officer (Pegawai), and Administrator — each with clearly scoped access to system functions. The core features delivered included: role-based user authentication, programme-scoped transaction recording with receipt uploads, a multi-level approval workflow for transactions and financial forms, nine standardised UTM financial form templates with client-side PDF generation using jsPDF, digital signature capture and embedding, and role-specific financial dashboard summaries.

The system was evaluated through white box testing, black box testing covering all 27 protected routes across five role modules, and user acceptance testing (UAT) with representative end-users. Testing confirmed that all core functional requirements were met and that the system was perceived as usable and effective by the target user groups.

---

## 6.3 Achievement of Objectives

The project was guided by four primary objectives, each of which was addressed as follows.

**Objective 1: To identify the financial management requirements of student clubs at BAPP UTM.**
This objective was achieved through an informal interview-based requirements gathering process with BAPP staff and student representatives. The process identified five distinct user roles, the hierarchical approval chain, nine UTM financial form types requiring digital implementation, and key pain points in the manual process such as the lack of centralised transaction history and delayed approval communication. The gathered requirements were formally documented as use case descriptions (Table 4.1) and formed the basis for all subsequent design decisions.

**Objective 2: To design a web-based financial management system with role-based access control and a multi-level approval workflow.**
This objective was achieved through the system design artefacts presented in Chapter 4, including the use case diagram (Figure 4.1), four sequence diagrams (Figures 4.2–4.5), three activity diagrams (Figures 4.6–4.8), the system architecture diagram (Figure 4.9), the DFD Level-0 and Level-1 (Figures 4.10–4.11), the class diagram (Figure 4.12), and the ERD (Figure 4.13). The `ProtectedRoute` component enforced role-based access at the routing level, preventing any user from accessing functions outside their assigned role.

**Objective 3: To implement transaction management, financial form submission, and PDF report generation features for the system.**
This objective was achieved through five incremental development iterations described in Section 3.3.3. The completed system provided full transaction lifecycle management (create, edit, delete, approve, reject), receipt upload and cascading deletion to Firebase Storage, nine UTM financial form templates with dynamic field rendering, digital signature capture stored under `signatures/{uid}/slot-{slot}.png`, and client-side PDF generation embedded with transaction data and digital signatures. The PDF generation module handled all nine form types using jsPDF and jspdf-autotable without requiring any server-side processing.

**Objective 4: To evaluate the usability and correctness of the system through functional testing and user acceptance testing.**
This objective was achieved through the three-tier testing strategy documented in Chapter 5. White box tests verified the correctness of key functions. Black box tests confirmed that all 13 defined system flows produced the expected outputs. UAT with target users confirmed that the system met usability expectations, with detailed results presented in Tables 5.8–5.10 of Chapter 5.

---

## 6.4 System Limitations

The following limitations arose from architectural constraints of the chosen technology stack rather than from incomplete implementation.

**Offline Unavailability.** The SFMS required an active internet connection for all operations because Cloud Firestore and Firebase Storage have no persistent offline mode in this implementation. Users in environments with unreliable connectivity experienced failed reads and writes. Firebase Firestore does support optional offline persistence through the SDK's `enableIndexedDbPersistence` API, but this was not enabled in the current implementation as it introduces synchronisation complexity outside the project scope.

**Firestore `in` Clause Limit.** Cloud Firestore's query API limits the `in` operator to a maximum of 30 values per query clause. Approval pages that needed to load pending transactions across many club programme codes required chunked batch queries, adding implementation complexity. This is an inherent platform constraint of Cloud Firestore that cannot be circumvented without restructuring the data model.

**Client-side-only Validation.** Because the system had no server-side application layer, all input validation was performed in the React client. A technically knowledgeable user with direct Firebase SDK access could write documents that bypassed client-side validation. Firestore Security Rules were configured to provide basic authentication gating, but field-level validation in Security Rules has limitations compared to server-enforced validation.

**PDF Generation Performance on Low-end Devices.** PDF generation for financial reports with large transaction datasets was performed entirely client-side using jsPDF and jspdf-autotable. On low-specification devices, generating a report with more than 100 transaction rows caused a brief UI freeze. A server-side PDF generation approach (e.g., using Firebase Cloud Functions) would mitigate this but was outside the scope of this project.

**No Push Notifications.** The system had no mechanism to proactively notify a Treasurer when their transaction was approved or rejected, nor to notify a reviewer when new transactions were pending. Users had to check their dashboard or the approval page manually to see status updates. Real-time Firestore listeners updated the UI on-screen, but browser-level push notifications required Firebase Cloud Messaging, which was not implemented.

---

## 6.5 Recommendations for Future Work

The following enhancements are recommended as extensions to the SFMS in future development iterations.

**Email and Push Notifications via Firebase Cloud Functions.** Deploying a Cloud Functions backend would enable event-triggered email and push notifications when transaction statuses change. This would substantially improve the responsiveness of the approval workflow and reduce the need for manual status checking.

**Mobile Application.** Converting the React SPA to a Progressive Web App (PWA) or developing a React Native mobile application would enable offline-capable access and native mobile push notifications, directly addressing the offline availability and notification limitations identified in Section 6.4.

**Server-side Input Validation via Cloud Functions.** Adding a Firebase Cloud Functions layer for write operations would allow field-level validation to be enforced server-side, strengthening data integrity guarantees beyond what Firestore Security Rules alone can provide.

**Financial Analytics Dashboard.** The current dashboard displayed basic totals (total income, total expenses, current balance). Future iterations could incorporate trend visualisations using a charting library such as Recharts or Chart.js — for example, monthly income vs. expense bar charts and category-level spending breakdowns — to support better financial decision-making for treasurers and advisors.

**Export to Excel and CSV.** In addition to PDF report generation, providing Excel (XLSX) and CSV export options using a library such as SheetJS would give users more flexibility in how they store and re-use financial data, particularly for integration with UTM's institutional reporting tools.

**Budget Planning Module.** A budget planning feature allowing treasurers to set a programme budget and track expenditure as a percentage of that budget would close a gap in the current system, where transactions are recorded without reference to any pre-approved budget ceiling.

---

## 6.6 Conclusion

The Smart Financial Management System was successfully designed, developed, and evaluated as a web-based financial management platform for student clubs at BAPP, Universiti Teknologi Malaysia. The system addressed the identified limitations of the existing manual process by providing a centralised, role-governed platform for recording transactions, managing multi-level approval workflows, submitting standardised UTM financial forms, and generating digital financial reports with embedded digital signatures.

All four project objectives were achieved. The Agile-Kanban development methodology enabled iterative refinement of the system in response to advisor feedback across the PSM1 and PSM2 project phases. The technology stack — React 18, Firebase Authentication, Cloud Firestore, and Firebase Storage — provided a serverless architecture that was cost-effective, scalable, and maintainable without a dedicated application server.

The system limitations identified are inherent to the serverless Firebase architecture and to the scope constraints of a final year project, rather than deficiencies in the delivered functionality. The recommendations in Section 6.5 provide a clear roadmap for enhancing the system's reliability, accessibility, and analytical capability in future development phases.

The SFMS demonstrated that a modern, role-based financial management system for university student clubs can be built entirely on serverless cloud infrastructure, reducing operational complexity while meeting the practical needs of treasurers, advisors, and administrators in a real institutional setting.
