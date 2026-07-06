# CHAPTER 2: LITERATURE REVIEW

---

## 2.1 Introduction

This chapter presented a review of the literature relevant to the design and development of a web-based financial management system for student-run programmes at Universiti Teknologi Malaysia (UTM). The chapter began with a case study of financial reporting challenges encountered by student organisations at UTM and comparable institutions globally. It then examined the three main categories of financial management systems and the technologies underpinning them — including receipt digitisation, user authentication, digital signatures, approval routing, and cloud storage. Four existing financial management platforms were evaluated for their strengths and limitations in relation to the project's requirements. The chapter concluded with an evaluation of the specific development technologies selected for the SFMS, contextualised against academic and industry evidence.

---

## 2.2 Case Study on Financial Reporting Challenges

In many universities, including Universiti Teknologi Malaysia (UTM), student treasurers were responsible for managing the financial reporting of student-led programmes. While official policies were in place to regulate this process — including submission deadlines and documentation requirements — a wide range of practical challenges persisted, including delays in approvals, missing or damaged receipts, vague expense justifications, and cumbersome workflows involving multiple approvers.

Globally, student organisations reported similar difficulties. At the University of South Carolina, delays in processing reimbursements left students waiting months for substantial claims due to staff shortages and submission volume spikes (Daily Gamecock, 2024). At UCLA, student engineers paid upfront for project supplies and waited over six months for reimbursements due to administrative backlogs (Daily Bruin, 2023). In Malaysia, UTM and UTHM both operated multi-level approval systems that, while intended to ensure accountability, slowed decision-making — especially when treasurers or officers failed to provide complete documentation (Universiti Teknologi Malaysia, 2023; Universiti Tun Hussein Onn Malaysia, 2022).

Student organisations across various campuses also struggled with record-keeping and internal control. At Case Western Reserve University, student groups were unable to provide proper spending reports during an audit due to poor transition practices between outgoing and incoming committee members (The Observer, 2021). A study at the University of Eastern Philippines confirmed that budgeting practices were strong, but record-keeping and documentation were weak due to a lack of internal control policies (International Journal of Scientific & Technology Research, 2016). Other institutions, including Cal Poly Pomona and Stanford, introduced limits on lost-receipt reimbursements to reduce fraud and encourage better documentation (Stanford University ASSU, n.d.; The Poly Post, 2024).

These examples reinforced the importance of digital financial systems with built-in justification workflows, secure receipt storage, and structured approval tracking. Table 2.1 summarises these cases.

**Table 2.1: Examples of Financial Reporting Challenges in Student Programmes**

| Case Example | Issue Encountered | Impact | Source |
|---|---|---|---|
| University of South Carolina (2024) | Reimbursement delays due to staff shortages and volume | Students waited months for substantial claims | Daily Gamecock (2024) |
| UCLA (2023) | Approval/funding delays up to 6 months | Students paid upfront and waited half a year | Daily Bruin (2023) |
| Case Western Reserve University (2021) | Poor record-keeping during officer transition | Audit revealed unclear spending and untracked funds | The Observer (2021) |
| Cal Poly Pomona (2024) | Missing documentation and fund misuse in 100+ clubs | Clubs denied re-registration; policy reformed | The Poly Post (2024) |
| University of Eastern Philippines (2016) | Lack of internal financial control and documentation | Weak accountability, especially in handovers | IJSTR (2016) |
| Stanford University (n.d.) | Receipt loss and fraud risk | Lost receipt reimbursements capped and limited | Stanford ASSU (n.d.) |
| BAPP UTM (2024) | Manual spreadsheets, physical receipts, email-based approvals | 14–21 day delays; 70% revision rate; 30–40% receipt loss | Interview: Panji Alam, BAPP staff |

**[Figure 2.1: Current Financial Process Flow for Student-Led Programmes at UTM]**

*(Insert existing flowchart from current Chapter 2 draft here)*

---

## 2.3 Types of Financial Management Systems

Financial management systems varied in structure and capability based on the degree of digitalisation. Student organisations typically utilised one of the following three types.

### 2.3.1 Manual Financial Systems

Manual systems relied on handwritten ledgers, printed claim forms, and physical storage of receipts. These systems were inexpensive and simple to operate but were highly susceptible to human error, inefficiency, and difficulties in record retrieval. Approval and reimbursement delays were prevalent because of the need for physical document circulation and the absence of centralised control.

### 2.3.2 Semi-Digital Financial Systems

Semi-digital systems employed tools such as Microsoft Excel and email. In the context of Malaysian universities, student organisations maintained programme budgets in spreadsheets and submitted scanned receipts to advisors or finance offices via email. While these systems enabled simple calculations and electronic record-keeping, they were not centralised or automated. Research showed that financial management via spreadsheets tended to create rigid operations and was prone to manual errors (Khan, 2021). Semi-digital systems reduced some of the physical handling overhead of manual systems but retained fragmented workflows and high potential for miscommunication.

### 2.3.3 Web-Based Financial Systems

Web-based systems were cloud-enabled platforms that supported real-time access, automation, and centralised financial operations. They included features such as budget tracking dashboards, expense submission portals, and integrated approval workflows. Examples included Wave, TidyHQ, Zoho Expense, and MoneyMinder. Studies showed that web-based systems improved accuracy, processing speed, and accessibility compared to manual and semi-digital approaches, particularly under conditions of remote or distributed operation (Rahman et al., 2021). Institutions that adopted web-based financial tools reported significant improvements in processing time and in the transparency of financial records.

---

## 2.4 Receipt Digitisation

In student-led programme finances, physical receipts were frequently lost or damaged before they could be submitted for financial reporting. Receipt digitisation helped address these risks by enabling permanent digital storage linked to the associated financial transaction.

### 2.4.1 File Upload and Cloud Storage

The most straightforward approach to receipt digitisation was direct file upload by the user, with the file stored in a cloud storage service linked to the relevant transaction record. This approach was adopted in the SFMS: upon submitting a transaction, the Treasurer could optionally upload a receipt image or PDF. The uploaded file was stored in Firebase Storage under a path keyed to the user's UID and a timestamp, and the resulting download URL and storage path were saved alongside the transaction document in Firestore, enabling the receipt to be viewed by reviewers and deleted alongside the transaction if required.

### 2.4.2 Optical Character Recognition (OCR)

Optical Character Recognition (OCR) technology enabled automatic extraction of key details from scanned receipts, such as vendor names, amounts, and dates. Applications such as Mobile Bookkeeper integrated this functionality for personal finance use (Garcia & Claour, 2022). Best practices for OCR accuracy included using high-resolution scans (minimum 300 DPI), capturing flat and well-lit images, correcting skew, and enhancing contrast before processing (Odd & Theologou, 2018). While OCR would be a valuable enhancement to the SFMS in a future development iteration, it was outside the scope of this project; receipt upload and attachment were provided instead.

### 2.4.3 File Formats

Digital receipts should be stored as searchable PDF files with embedded layers where possible. Adobe and other vendors recommended the PDF/A format with proper indexing for long-term digital archiving. The SFMS accepted both image files (JPEG, PNG) and PDF documents as receipt uploads, stored via Firebase Storage.

---

## 2.5 User Authentication and Digital Signature Technologies

Authentication and digital signature technologies played a vital role in maintaining secure access and traceable approvals within a financial system.

### 2.5.1 Secure Login and Access Control

Passwords should be stored using salted cryptographic hashes, making credentials unreadable even if the underlying data store is accessed. Role-based access control (RBAC) restricts users to the functions appropriate for their assigned role, preventing unauthorised access to financial records outside a user's scope of responsibility. These measures aligned with institutional security standards for web-based systems (OWASP, 2023). Firebase Authentication stored credentials using industry-standard encryption and managed session tokens automatically, satisfying these security requirements without requiring custom credential storage logic.

### 2.5.2 Electronic Signatures

Electronic signatures streamlined approval workflows and were legally recognised in many jurisdictions. Basic electronic signatures included typed names, checkbox consent, or scanned handwritten images embedded in documents. More advanced digital signatures used public-key cryptography to bind the signature to both the user and the specific document, offering tamper-evident verification with timestamps and user metadata for auditing (SignDesk, 2022). In the SFMS, a canvas-based digital signature capture component was used to allow users to draw their signatures in the browser. Signatures were stored as PNG images in Firebase Storage and embedded into generated PDF financial reports using jsPDF.

---

## 2.6 Approval Routing and Notification Mechanisms

Automated approval routing and real-time notifications helped enforce financial controls and minimised delays in multi-level approval processes.

### 2.6.1 Workflow Design

Automated routing moved financial requests through defined approval chains based on user roles or configurable thresholds. This structure eliminated delays caused by unclear responsibilities. An expense above a defined threshold could trigger automatic forwarding to successive approvers, ensuring that no single approver became a bottleneck (Workflow Automation Study, 2023). In the SFMS, the approval chain was role-governed rather than threshold-governed: all transactions submitted by a Treasurer were visible to Bendahari Kelab, Advisor, Pegawai, and Admin reviewers according to their assigned scope, without requiring automatic forwarding between roles.

### 2.6.2 Notifications and Escalations

Systems that notified users via email or in-app alerts when action was required improved responsiveness and reduced approval cycle times. If a user did not respond within a defined timeframe, escalation policies could forward the request to alternative approvers, ensuring continuity and accountability (Workflow Automation Study, 2023). In the SFMS, real-time Firestore listeners updated the approval page content when new transactions appeared, but browser-level push notifications were not implemented in this version of the system. This was identified as a recommended enhancement for future development.

---

## 2.7 Cloud Storage and Audit Trails

### 2.7.1 Cloud Storage

Cloud-based storage provided redundancy, remote access, and automated backups for financial data. Cloud platforms enhanced data recovery and scalability while maintaining access controls. For financial systems, this enabled scanned receipts and generated reports to be retrieved by transaction or date without dependence on a local file server (Google, 2023). Firebase Storage was selected for the SFMS based on its native integration with Firebase Authentication's access control model, enabling storage security rules to be scoped to the authenticated user's UID.

### 2.7.2 Audit Trails

Every significant user action — including record creation, status updates, and approvals — should be logged with a timestamp and user identifier. Audit trails provided transparency, enabled detection of irregularities, and simplified internal or external reviews (SignDesk, 2022). In the SFMS, all Firestore documents included `createdAt` and `updatedAt` server-generated timestamps, and all approval and rejection actions recorded the reviewer's UID, email address, and `reviewedAt` timestamp. While a dedicated audit log collection was not implemented, the metadata fields in the `transactions` and `formSubmissions` collections served as a transaction-level audit trail.

---

## 2.8 Current System Analysis

Several existing systems were used for financial tracking, expense approvals, and club administration that shared functional similarities with the proposed SFMS. Although these platforms were not developed specifically for student organisations in Malaysia, they offered features such as receipt management, approval workflows, and financial reporting. Evaluating their strengths and limitations provided reference points for designing a system tailored to student-led programmes at BAPP UTM.

### 2.8.1 Wave Accounting

Wave was a free, web-based accounting system widely used by freelancers and small organisations. Its core features included income and expense tracking, receipt capture via a mobile application, and financial reporting. However, Wave had no built-in approval mechanism; organisations had to rely on external tools or manual methods to obtain approval for transactions. Key features of Wave included:
- Receipt capture via mobile app
- Automatic transaction syncing
- Financial reports (profit/loss, balance sheet)
- Multi-user collaboration with basic permissions

Despite its simplicity and ease of use, Wave lacked structured approval routing and customisable access control, making it insufficient for the regulated financial workflows required in a university environment such as UTM (Wave Financial, 2023).

### 2.8.2 TidyHQ

TidyHQ was a web-based platform developed for managing clubs and associations. Its financial module enabled users to set budgets, record expenses, and monitor fund usage. Receipt attachments could be uploaded, but the system did not support OCR scanning or formal multi-step approval routing. Key features included:
- Role-based permissions for treasurers and officers
- Budget creation and tracking by category
- Event-linked expense recording
- Integrated financial reporting with ledger-style visibility

Although TidyHQ supported transparent tracking and user role control, its lack of structured approval workflows and receipt verification tools limited its suitability for university settings requiring formal audit processes and policy enforcement (TidyHQ, 2023).

### 2.8.3 Zoho Expense

Zoho Expense was a premium, cloud-based expense management platform designed to streamline reimbursement and financial compliance through automation and real-time tracking. It was highly customisable and supported detailed multi-tiered workflows for expense approval. Its advanced OCR engine extracted data from scanned receipts, and all actions were logged in a transparent audit trail. Key features included:
- Smart receipt scanning with OCR for automatic extraction of transaction details
- Multi-tiered approval routing with notifications
- Customisable policy rules with automatic flagging of non-compliant expenses
- Digital receipt archiving and audit logging

Although Zoho Expense was feature-rich, its cost and generality made it poorly matched to the specific UTM-contextual requirements of BAPP student clubs. Its structure served as a valuable reference model for implementing layered approval systems and audit-ready receipt storage in the SFMS (Zoho, 2023).

### 2.8.4 MoneyMinder

MoneyMinder was a web-based financial management application developed specifically for volunteer-led organisations such as college clubs and non-profit associations. It provided essential accounting capabilities alongside a straightforward interface suited to non-professional treasurers. In 2025, it introduced a Reimbursement Manager enabling structured expense submission and review. Key features included:
- Reimbursement documentation with scanned receipts
- Budget versus actual tracking
- Simplified approval steps and role assignment
- Exportable and printable financial reports

MoneyMinder balanced usability with financial accountability through its reimbursement approval module, making it well-suited to student-driven programmes requiring simple approval cycles, transparent documentation, and accessible budget generation without the costs of enterprise solutions (MoneyMinder, 2023).

---

## 2.9 Comparison of Existing Systems with the Proposed SFMS

Table 2.2 summarised the key functional features of the four reviewed systems and compared them with the features delivered by the proposed SFMS. The comparison was based on the system requirements identified in the requirements gathering phase.

**Table 2.2: Feature Comparison of Existing Systems with the Proposed SFMS**

| Feature / Criteria | Weight | Wave | TidyHQ | Zoho Expense | MoneyMinder | SFMS |
|---|---|---|---|---|---|---|
| Expense Entry (Add / Edit / Delete) | 20% | Yes | Yes | Yes | Yes | Yes |
| Report Generation (PDF / Export) | 15% | Partial | Yes | Yes | Yes | Yes |
| Approval Workflow (Multi-level) | 25% | No | No | Yes | Basic | Yes |
| User Role Separation | 15% | Limited | Yes | Yes | Yes | Yes (5 roles) |
| Localised for UTM Processes | 15% | No | No | No | No | Yes |
| Cloud Storage (Receipts / Docs) | 10% | Yes | Partial | Yes | Partial | Yes |
| **Total Match Score** | | 30% | 50% | 80% | 45% | 100% |

The comparison showed that existing solutions offered partial functionality for student financial management but failed to address UTM-specific requirements. Wave and MoneyMinder lacked formal multi-level approval workflows. TidyHQ lacked approval routing and receipt verification. Zoho Expense, while the most feature-complete of the reviewed systems, was a general enterprise tool not customisable for academic financial form templates or UTM's specific role hierarchy. The SFMS was specifically designed to address all six criteria, with the additional distinction of supporting nine standardised UTM financial form templates and a five-role institutional hierarchy.

Table 2.3 provided an expanded attribute-level comparison between the reviewed systems and the SFMS.

**Table 2.3: Attribute Comparison Between Existing Systems and the Proposed SFMS**

| Attribute | Wave | TidyHQ | Zoho Expense | MoneyMinder | SFMS |
|---|---|---|---|---|---|
| Platform | Web / Mobile | Web | Web / Mobile | Web | Web-based SPA |
| Budget Planning | Basic | Yes | Partial | Yes | Via programme tracking |
| Receipt Upload | Yes (Mobile) | No | Yes (OCR) | Yes (Manual) | Yes (Upload only) |
| Multi-level Approval | No | No | Yes | Basic | Yes (5-role routing) |
| User Role Management | Limited | Yes | Yes | Yes | Yes (5 distinct roles) |
| Audit Trail | Basic | Basic | Advanced | Moderate | Via Firestore metadata |
| Digital Signature in Reports | No | No | No | No | Yes (canvas-drawn PNG) |
| Standardised UTM Forms | No | No | No | No | Yes (9 form templates) |
| Push Notifications | Limited | No | Yes | No | No |
| Localised for Malaysian University | No | No | No | No | Yes |

This comparison confirmed that no existing platform fully addressed the operational requirements of BAPP UTM. The SFMS was designed specifically to close these gaps through its UTM-aligned role hierarchy, standardised form templates, digital signature integration, and Malay-language user interface.

---

## 2.10 Technologies and Tools

This section reviewed the development technologies selected for the SFMS. Each technology was evaluated based on its suitability for the project's technical requirements, academic and industry adoption, and compatibility with a serverless, client-side architecture.

### 2.10.1 Firebase — Cloud Firestore and Firebase Storage

Firebase was selected as the primary backend platform for the SFMS. It provided two essential backend services without requiring a dedicated application server: Cloud Firestore and Firebase Storage.

**Cloud Firestore** was a NoSQL, document-oriented database that supported real-time synchronisation of data between connected clients through listener subscriptions. Its document-collection data model was well-suited to the SFMS's financial data, in which each transaction, form submission, programme record, and user profile was represented as an independent document in a named collection. Firestore's Security Rules enabled field-level access control based on Firebase Authentication identity tokens, ensuring that users could only read and write documents within their authorised scope (Google, 2023).

**Firebase Storage** provided scalable object storage for binary files, including uploaded receipt images, generated PDF reports, and digital signature PNG files. Files were identified by their storage path, enabling cascading deletion when a parent transaction document was removed. The Firebase JavaScript SDK allowed uploads and downloads to be performed directly from the client without routing through an intermediate server (Google, 2023).

Together, Cloud Firestore and Firebase Storage formed the complete persistent data layer of the SFMS, operating under a serverless architecture that eliminated backend infrastructure provisioning and maintenance overhead.

### 2.10.2 Firebase Authentication

Firebase Authentication was adopted as the identity management service for the SFMS. It provided email/password-based authentication with session persistence configurable as browser-local or browser-session. Firebase Authentication managed secure credential storage, token-based session control, and integration with Firestore Security Rules for role-scoped data access. Password reset emails were also supported natively through the Firebase SDK (Google, 2023).

For the SFMS, user role information (one of: treasurer, advisor, admin, bendahari\_kelab, pegawai) was stored in the Firestore `users` collection alongside the authenticated user's UID, rather than in Firebase custom claims, enabling the React client to retrieve and apply role-based routing after login without requiring server-side claim management.

### 2.10.3 React 18 and Vite

React 18 was selected as the frontend framework for the SFMS. Its component-based architecture supported modular development of the role-specific dashboards, forms, and approval interfaces, with hooks (useState, useEffect, useContext) managing state and side effects in functional components. React's virtual DOM enabled efficient re-rendering of list-heavy views such as transaction histories and approval queues (Meta, 2023).

Vite was used as the build tool and development server. Vite's Hot Module Replacement (HMR) capability significantly reduced frontend iteration time during development. Its optimised production build output — leveraging Rollup for bundling and tree-shaking — produced a compact SPA bundle suitable for deployment to any static hosting provider (Vite, 2023).

### 2.10.4 Tailwind CSS

Tailwind CSS v3 was used for all styling in the SFMS. As a utility-first CSS framework, Tailwind allowed styles to be composed directly within JSX markup using predefined class tokens, eliminating the need for separate CSS files and reducing the risk of style conflicts in a large component tree. Tailwind's responsive utility classes enabled the SFMS interface to adapt to different screen sizes without additional CSS media queries. The framework's design token system (colour palettes, spacing scales, border radii) was configured to reflect UTM institutional branding — a dark red (`red-900`) primary colour and a light grey (`gray-50`) background — ensuring visual consistency across all role modules (Tailwind Labs, 2023).

### 2.10.5 react-router-dom v7

Client-side routing in the SFMS was managed by react-router-dom v7. The `<Routes>` and `<Route>` components defined 27 protected routes distributed across five role modules. A custom `ProtectedRoute` wrapper component checked the authenticated user's role on every route transition, redirecting unauthenticated users to the login page and users with an insufficient role back to their own dashboard. This approach enforced role-based access control at the routing level without requiring server-side session management (Remix Software, 2023).

### 2.10.6 jsPDF and jspdf-autotable

PDF generation in the SFMS was performed entirely client-side using jsPDF and its jspdf-autotable plugin. jsPDF is a JavaScript library that constructs PDF documents in the browser without any server-side processing. It supported text, images, lines, and embedded content, enabling the SFMS to build the nine UTM financial form templates programmatically — auto-populating fields from approved transaction data retrieved from Firestore and embedding digital signature PNG images in designated signature fields. The jspdf-autotable plugin extended jsPDF with configurable table rendering, used for the transaction list sections of each financial report (Parallax, 2023).

The decision to perform PDF generation client-side was consistent with the SFMS's serverless architecture: no Cloud Function or server endpoint was required for report generation, and the generated PDF could be either downloaded to the user's device or uploaded to Firebase Storage as a submitted form record.

### 2.10.7 Git and GitHub

Git was used as the version control system throughout the SFMS development. GitHub served as the remote repository hosting platform, enabling the developer to maintain a complete revision history, roll back to previous working states, and manage development branches during iterative feature development. Version control was particularly important for managing the five sequential development iterations described in Chapter 3 (Chacon & Straub, 2014).

---

## 2.11 Chapter Summary

Chapter 2 reviewed the literature and technologies relevant to the development of the Smart Financial Management System. Section 2.2 surveyed financial reporting challenges in student organisations at UTM and comparable institutions globally, establishing the problem context for the SFMS and documenting BAPP-specific data from an interview with a staff member (Table 2.1). Section 2.3 classified financial management systems into manual, semi-digital, and web-based categories, with web-based systems identified as the most appropriate model for the SFMS based on their accuracy, accessibility, and real-time capabilities. Sections 2.4 through 2.7 reviewed the supporting technologies relevant to financial system design — receipt digitisation (file upload and OCR), secure user authentication and electronic signatures, multi-level approval routing, and cloud storage with audit trail support.

Sections 2.8 and 2.9 evaluated four existing financial management platforms — Wave, TidyHQ, Zoho Expense, and MoneyMinder — and compared their features against the SFMS in Tables 2.2 and 2.3. The comparison confirmed that no existing platform addressed all six functional criteria required for BAPP UTM's context, particularly the nine UTM-standardised form templates, the five-role institutional hierarchy, and the Malay-language interface. Section 2.10 reviewed the seven technologies selected for the SFMS — Firebase (Cloud Firestore, Firebase Storage, and Authentication), React 18, Vite, Tailwind CSS v3, react-router-dom v7, jsPDF with jspdf-autotable, and Git — each justified against the project's technical requirements and the serverless architecture decision. Chapter 3 describes the Agile-Kanban development methodology and the five phases through which these technologies were applied to build the SFMS.
