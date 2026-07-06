# CHAPTER 3: SYSTEM DEVELOPMENT METHODOLOGY

---

## 3.1 Introduction

This chapter describes the development methodology adopted for the Smart Financial Management System (SFMS) and provides a justification for the choice of methodology. The methodology governed how the project was planned, executed, tested, and refined from the initial requirements gathering phase through to final delivery.

The Agile-Kanban methodology was adopted for this project because of its iterative nature, flexibility in accommodating requirement changes, and suitability for a single-developer project. Each development iteration produced a functional increment of the system, which was subsequently tested and refined before the next iteration began. The methodology ensured that the system's features — particularly the role-based approval workflow, financial form submissions, and PDF report generation — were delivered incrementally and validated against user needs.

Section 3.2 justifies the methodology choice. Section 3.3 describes the five development phases. Section 3.4 outlines the testing strategy. Section 3.5 presents the technology stack. Section 3.6 details system requirements. Section 3.7 provides the chapter summary.

---

## 3.2 Methodology Choice and Justification

The Agile-Kanban methodology was selected for the development of SFMS for the following reasons:

**Flexibility for Evolving Requirements.** The full scope of the five user roles and the nine standardised UTM financial forms only became clear after consultation with BAPP staff during early requirements gathering. The Agile approach allowed new requirements — such as the Bendahari Kelab intermediate approval layer and the digital signature feature — to be incorporated into later development iterations without disrupting previously completed work.

**Suitability for a Solo Developer.** Kanban's lightweight task management model — based on a visual board with To-Do, In Progress, and Done columns — was more appropriate than Scrum's ceremony-heavy sprint structure for a single-developer project. There were no stand-up meetings or sprint review ceremonies to manage; instead, tasks were pulled from the backlog and prioritised dynamically based on supervisor feedback after each consultation session.

**Continuous User Feedback Integration.** Agile's short iteration cycles enabled frequent demonstrations of working system increments to the project supervisor and potential end-users. Feedback from these demonstrations directly shaped subsequent iterations, particularly in refining the transaction filtering logic, dashboard summary design, and the approval scope for each reviewer role.

**Comparison with Alternative Methodologies.** The Waterfall model was considered but rejected because it requires fully fixed requirements before development begins, which was not possible given that user role definitions and form structures needed to be validated iteratively. The Spiral model was considered unnecessary for this project scale, as risk management overhead was disproportionate to the relatively contained technical scope of a Firebase-based SPA. Extreme Programming (XP) was not selected because pair programming and continuous integration requirements are less applicable to a single-developer project.

Table 3.1 summarises the comparison between the evaluated methodologies.

**Table 3.1: Methodology Comparison**

| Criterion | Waterfall | Spiral | Agile-Kanban (Chosen) |
|---|---|---|---|
| Requirement flexibility | Low | Medium | High |
| Suitability for solo developer | Medium | Low | High |
| Iterative user feedback | No | Partial | Yes |
| Documentation overhead | High | High | Medium |
| Complexity | Low | High | Low-Medium |
| Supports mid-project scope changes | No | Partial | Yes |

---

## 3.3 Phases of the Agile-Kanban Methodology

The development of the SFMS was structured into five phases, executed iteratively across the PSM1 and PSM2 project periods.

**[Figure 3.1: Agile-Kanban Development Phases for SFMS]**

### 3.3.1 Requirements Gathering

The requirements gathering phase was conducted in PSM1 through informal interviews with representatives of BAPP UTM, review of the nine standardised UTM financial forms used by student clubs, and observation of the existing manual financial management process. The following information was collected:

- The five user roles involved in the financial approval chain: Treasurer (Bendahari), Club Treasurer (Bendahari Kelab), Advisor (Penasihat), Officer (Pegawai), and Administrator.
- The hierarchical approval flow: Treasurer submits → Bendahari Kelab reviews → Advisor or Pegawai approves → Admin has system-wide authority.
- The nine UTM financial form types that required digital equivalents in the system.
- Pain points with the existing paper-based process: lost receipts, delayed approvals, and no centralised transaction history.

These requirements were documented as user stories and translated into the use case diagram presented in Chapter 4.

### 3.3.2 System Design

In the system design phase, the architecture, data models, and interface layouts were defined. The Firebase-based two-tier architecture was selected in this phase: a React 18 SPA on the client communicating directly with three Firebase services (Authentication, Cloud Firestore, and Storage) without an intermediate application server. This decision simplified deployment and eliminated backend maintenance overhead.

UML diagrams produced in this phase included the use case diagram, four sequence diagrams, three activity diagrams, a class diagram, two data flow diagrams, and the entity relationship diagram. Interface mockups were created to define the screen layouts for each of the five role dashboards. The complete design artefacts are presented in Chapter 4.

### 3.3.3 System Development

Development was executed in five incremental iterations across PSM1 and PSM2:

- **Iteration 1**: User authentication module — Firebase Auth email/password login, username-based login resolution, password reset, role-based redirect, and `ProtectedRoute` RBAC component.
- **Iteration 2**: Transaction management module — Add, edit, delete, and view transaction history for the Treasurer role; receipt upload to Firebase Storage.
- **Iteration 3**: Approval workflow module — Pending transaction list scoped by role; approve and reject functionality for Advisor, Bendahari Kelab, Pegawai, and Admin.
- **Iteration 4**: Financial form and report module — Nine UTM form types with dynamic field rendering, digital signature capture and storage, PDF generation using jsPDF and jspdf-autotable, and PDF submission to Firebase Storage.
- **Iteration 5**: Administrative and dashboard modules — User account management, programme management, and role-specific dashboard summaries with financial totals.

Each iteration produced a working system increment that was tested and validated before the next iteration began. Anti-spam controls (localStorage-based cooldowns) and Firestore query optimisation (30-element chunked `in` queries) were added in later iterations following performance testing.

### 3.3.4 System Testing and Evaluation

Testing was integrated throughout each development iteration rather than deferred to a single final phase. Three types of testing were conducted:

- **White Box Testing**: Structural testing of key functions, including the `validate()` function in `LoginPage.jsx`, the `createTransaction` and `updateTransactionStatus` functions in `transactionService.js`, and the `ProtectedRoute` component RBAC logic. Test cases were designed to verify branch coverage for each function.
- **Black Box Testing**: Functional testing of 13 system flows (login, registration, add transaction, edit transaction, delete transaction, approve transaction, reject transaction, submit borang, approve borang, generate report, manage users, manage programmes, and view dashboard), validating expected outputs against defined inputs without reference to internal code structure.
- **User Acceptance Testing (UAT)**: Conducted with a target group of BAPP students acting in the treasurer and reviewer roles. Participants completed five standardised tasks and scored system usability using a structured questionnaire. Results were used to refine the interface in the final development iteration.

The full test cases, results, and UAT analysis are presented in Chapter 5.

### 3.3.5 System Maintenance

After UAT feedback was collected and acted upon, the system entered a maintenance phase in which reported usability issues were resolved, documentation was completed, and the source code was reviewed for consistency. Minor UI refinements — including error message localisation and dashboard loading state improvements — were implemented in this phase. Ongoing maintenance after project submission was outside the scope of PSM2.

### 3.3.6 Project Timeline

The project was planned and executed across two semesters — PSM1 and PSM2. The detailed Gantt charts for both phases are provided in the Appendix (see Figure A.1 for PSM1 and Figure A.2 for PSM2), which outline the tasks, milestones, and durations for each phase of development.

---

## 3.4 Testing Strategy

The testing strategy followed a three-tier approach aligned with the PSM2 evaluation rubric requirements. All testing was conducted manually.

**White Box Testing** focused on the internal logic of key functions. Test cases exercised individual code paths — including both valid inputs and boundary/invalid inputs — to verify that the functions returned the correct outputs and handled errors appropriately. Functions tested included login validation, transaction creation, transaction status update, cascading receipt deletion, and role-based route protection.

**Black Box Testing** evaluated the system's functional behaviour from the user's perspective, without reference to the source code. Each test case specified an input scenario, the expected system behaviour, and the observed result. Tested flows covered all 27 protected routes across all five user roles.

**User Acceptance Testing (UAT)** was conducted with representative end-users who performed a set of predefined tasks within the live system and completed a structured questionnaire after each task. The questionnaire measured satisfaction, ease of use, and task completion rate. UAT results were analysed and used to confirm that the system met the usability requirements identified in the requirements gathering phase.

---

## 3.5 Technology Stack

Table 3.2 presents the complete technology stack used in the development of the SFMS.

**Table 3.2: SFMS Technology Stack**

| Purpose | Tool / Library | Version | Use Case |
|---|---|---|---|
| Frontend Framework | React | 18 | Component-based SPA development with hooks for state and lifecycle management |
| Build Tool | Vite | Latest | Development server, Hot Module Replacement (HMR), and optimised production build |
| CSS Framework | Tailwind CSS | v3 | Utility-first responsive styling; UTM institutional branding |
| Client-side Routing | react-router-dom | v7 | 27 protected routes across 5 role modules; `ProtectedRoute` RBAC component |
| Authentication | Firebase Authentication | JS SDK v12 | Email/password authentication, session persistence (`browserLocalPersistence`), password reset |
| Database | Cloud Firestore | JS SDK v12 | NoSQL document store for `users`, `transactions`, `programmes`, `formSubmissions`, `pdfSubmissions` |
| File Storage | Firebase Storage | JS SDK v12 | Receipt images, generated PDFs, and digital signature PNG files |
| PDF Generation | jsPDF + jspdf-autotable | Latest | Client-side generation of the nine UTM financial report templates |
| Version Control | Git | — | Source code management and development history |
| Development Runtime | Node.js | v18+ | Vite dev server and `npm` package management (build-time only; not used at runtime) |

The system required no dedicated application server or REST API. All backend operations were handled natively by the Firebase JavaScript SDK operating directly from the React client. Firebase's serverless model eliminated the need for server provisioning, maintenance, or API design.

---

## 3.6 System Requirements

### 3.6.1 User (Client) Requirements

The SFMS was a web-based single-page application requiring no software installation by end-users. Table 3.3 lists the minimum hardware and software requirements for users to access the system.

**Table 3.3: User System Requirements**

| Type | Specification | Purpose |
|---|---|---|
| Hardware | Minimum 4 GB RAM, dual-core processor, stable internet connection | Required for smooth SPA rendering, Firebase real-time operations, and PDF generation |
| Operating System | Windows 10 / macOS 10.15 / Ubuntu 20.04 or later | Any OS supporting a modern browser |
| Browser | Google Chrome 90+, Mozilla Firefox 88+, Microsoft Edge 90+, or Safari 14+ | Required to run the React SPA; no browser extension needed |
| Internet | Minimum 5 Mbps connection | Required for all Firebase Firestore reads/writes and Firebase Storage file uploads |

### 3.6.2 Development Environment Requirements

Table 3.4 lists the requirements for setting up the SFMS development environment.

**Table 3.4: Development Environment Requirements**

| Type | Specification | Purpose |
|---|---|---|
| Hardware | Minimum 8 GB RAM, quad-core processor | For running Vite HMR dev server alongside browser and IDE |
| Runtime | Node.js v18 or later | Required to run `npm` and the Vite development server |
| Package Manager | npm v9 or later | Installing and managing all project dependencies |
| Firebase Project | Firebase project with Authentication, Cloud Firestore, and Storage enabled | Provides the backend services used by the SPA |
| Browser | Google Chrome with React DevTools extension | For UI debugging and Firebase network inspection |
| IDE | Visual Studio Code (recommended) | Source code editing with Tailwind CSS IntelliSense and ESLint plugins |

The complete step-by-step deployment and environment setup guide is provided in Appendix A.

---

## 3.7 Chapter Summary

Chapter 3 described the Agile-Kanban development methodology adopted for the Smart Financial Management System. Section 3.2 justified the methodology choice against Waterfall, Spiral, and XP alternatives, establishing that Agile-Kanban was the most suitable approach for a solo developer project with evolving role-based requirements. Section 3.3 described the five development phases — requirements gathering, system design, system development (five incremental iterations), testing and evaluation, and maintenance — and referenced the PSM1 and PSM2 Gantt charts in Appendix A. Section 3.4 outlined the three-tier testing strategy comprising white box, black box, and user acceptance testing. Section 3.5 presented the complete technology stack, centred on React 18, Tailwind CSS, and three Firebase services (Authentication, Cloud Firestore, Storage) with no intermediate application server. Section 3.6 specified the minimum system requirements for both end-users and the development environment.

The methodology and technology choices documented in this chapter formed the foundation for the system design in Chapter 4 and the implementation and testing activities in Chapter 5.
