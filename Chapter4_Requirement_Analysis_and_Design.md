# CHAPTER 4: REQUIREMENT ANALYSIS AND DESIGN

---

## 4.1 Introduction

This chapter presents the requirement analysis and system design of the Smart Financial Management System (SFMS) developed for Bahagian Aktiviti dan Pembangunan Pelajar (BAPP), Universiti Teknologi Malaysia (UTM). The purpose of the system was to assist student treasurers, advisors, club treasurers, officers, and administrators in managing the financial activities of university student clubs in a more efficient, transparent, and structured manner. The system tracked income and expense transactions with receipt uploads, supported the submission and approval of standardised financial forms (borang), provided financial report generation, and enforced a role-based approval workflow.

The system's interaction and behavioural requirements were captured using Unified Modeling Language (UML) diagrams — including use case, sequence, and activity diagrams — to describe the interactions between users and the system. The chapter further presents the system architecture, data flow diagrams (DFD), class diagram, database schema, and interface designs that formed the basis for development and implementation.

Section 4.2 covers requirement analysis using UML diagrams and use case descriptions. Section 4.3 presents the system architecture. Section 4.4 details the data flow and class design. Section 4.5 describes the database design. Section 4.6 presents the interface designs. The chapter concludes with a summary in Section 4.7.

---

## 4.2 Requirement Analysis

Requirements analysis was conducted through informal interviews with the target users, observation of existing manual financial management practices, and review of the standardised UTM financial forms in use at BAPP. The key system features identified were: user authentication with role-based access control, club and programme management, income and expense transaction recording with receipt uploads, financial form (borang) submission, multi-level approval workflows, financial report generation in PDF format, and role-specific dashboard summaries.

The system supported five distinct user roles:

- **Treasurer (Bendahari)** — Primary user responsible for recording transactions, submitting financial forms, and generating reports for their assigned club and programme.
- **Advisor (Penasihat)** — Supervisory user who approved or rejected transactions and borang submitted by treasurers within their assigned clubs.
- **Club Treasurer (Bendahari Kelab)** — Club-level reviewer who performed first-level approval of transactions and borang from clubs under their purview before escalation to the Advisor.
- **Officer (Pegawai)** — Category-level officer who reviewed and approved transactions and borang across all clubs within their assigned BAPP category.
- **System Administrator (Admin)** — Responsible for managing user accounts, programme records, and could also approve or reject transactions system-wide.

### 4.2.1 Use Case Diagram

The use case diagram illustrated the main interactions between the five user roles and the SFMS. Figure 4.1 presents the overall use case diagram.

**[Figure 4.1: Use Case Diagram for the SFMS]**

> **PlantUML Source — Figure 4.1:**
> ```plantuml
> @startuml
> left to right direction
> skinparam packageStyle rectangle
> skinparam actorStyle awesome
>
> actor "Treasurer\n(Bendahari)" as TR
> actor "Advisor\n(Penasihat)" as AD
> actor "Club Treasurer\n(Bendahari Kelab)" as BK
> actor "Officer\n(Pegawai)" as PG
> actor "Admin\n(Pentadbir)" as AM
>
> rectangle "Smart Financial Management System (SFMS)" {
>   usecase "Register" as UC_REG
>   usecase "Login" as UC_LOGIN
>   usecase "View Dashboard" as UC_DASH
>   usecase "Add Transaction" as UC_ADD
>   usecase "Edit / Delete Transaction" as UC_EDIT
>   usecase "View Transaction History" as UC_HIST
>   usecase "Submit Financial Form (Borang)" as UC_BORANG
>   usecase "Generate Financial Report (PDF)" as UC_REPORT
>   usecase "Approve / Reject Transaction" as UC_APPRTX
>   usecase "Approve / Reject Borang" as UC_APPRBR
>   usecase "Manage Users" as UC_USERS
>   usecase "Manage Programmes" as UC_PROG
> }
>
> TR --> UC_REG
> TR --> UC_LOGIN
> TR --> UC_DASH
> TR --> UC_ADD
> TR --> UC_EDIT
> TR --> UC_HIST
> TR --> UC_BORANG
> TR --> UC_REPORT
>
> AD --> UC_LOGIN
> AD --> UC_DASH
> AD --> UC_APPRTX
> AD --> UC_APPRBR
> AD --> UC_REPORT
>
> BK --> UC_LOGIN
> BK --> UC_DASH
> BK --> UC_APPRTX
> BK --> UC_APPRBR
> BK --> UC_REPORT
>
> PG --> UC_LOGIN
> PG --> UC_DASH
> PG --> UC_APPRTX
> PG --> UC_APPRBR
> PG --> UC_REPORT
>
> AM --> UC_LOGIN
> AM --> UC_DASH
> AM --> UC_APPRTX
> AM --> UC_APPRBR
> AM --> UC_USERS
> AM --> UC_PROG
> @enduml
> ```

Table 4.1 provides detailed descriptions of the system's core use cases.

**Table 4.1: Use Case Descriptions**

| Use Case | Actor(s) | Description |
|---|---|---|
| Register | Treasurer | New users created an account by providing full name, matriculation number, email, and password. Default role assigned was Treasurer. |
| Login | All roles | Users authenticated using email/username and password. The system redirected each user to their role-specific dashboard upon successful authentication. |
| View Dashboard | All roles | Displayed role-specific financial summaries, pending counts, and navigation shortcuts. |
| Add Transaction | Treasurer | Treasurer recorded an income or expense entry with date, type, category, amount, description, and an optional receipt upload. |
| Edit / Delete Transaction | Treasurer | Treasurer modified or removed pending transactions. Approved or rejected transactions could not be edited. |
| View Transaction History | Treasurer | Displayed all transactions created by the Treasurer, sorted by date with colour-coded status indicators. |
| Submit Financial Form (Borang) | Treasurer | Treasurer filled in and submitted one of nine standardised UTM financial forms for review and approval. |
| Generate Financial Report (PDF) | Treasurer, Advisor, Bendahari Kelab, Pegawai | Generated a PDF financial report of approved transactions filtered by programme code and date range. |
| Approve / Reject Transaction | Advisor, Bendahari Kelab, Pegawai, Admin | Reviewed pending transactions within authorised scope and updated status to approved or rejected. |
| Approve / Reject Borang | Advisor, Bendahari Kelab, Pegawai, Admin | Reviewed pending financial form submissions and updated their status. |
| Manage Users | Admin | Created, updated, and removed user accounts; assigned roles and club associations. |
| Manage Programmes | Admin | Created, edited, and deleted academic programme records with unique programme codes. |

---

### 4.2.2 Sequence Diagrams

Sequence diagrams described the chronological exchange of messages between actors and system components for the system's key processes. Four core processes were modelled.

#### 4.2.2.1 Login Process

Figure 4.2 illustrates the login sequence. The user submitted credentials to the Login Page, which called Firebase Authentication. On success, the system retrieved the user's role from Firestore and redirected them to their role-specific dashboard. On failure, a Malay-language error message was displayed.

**[Figure 4.2: Sequence Diagram — Login Process]**

> **PlantUML Source — Figure 4.2:**
> ```plantuml
> @startuml
> actor User
> participant "Login Page" as LP
> participant "Firebase Auth" as FA
> database "Firestore\n(users)" as FS
> participant "Role Dashboard" as DB
>
> User -> LP : Enter email/username & password
> LP -> FA : signInWithEmailAndPassword(email, password)
> alt Login Success
>   FA --> LP : Return auth token
>   LP -> FS : getDoc(users/{uid})
>   FS --> LP : Return user role
>   LP -> DB : Navigate to role-specific dashboard
> else Login Failed
>   FA --> LP : Return error code
>   LP --> User : Display Malay error message
> end
> @enduml
> ```

#### 4.2.2.2 Add Transaction

Figure 4.3 illustrates the Add Transaction sequence. The Treasurer entered transaction details; if a receipt was attached, it was uploaded to Firebase Storage first. The validated data was then written to Firestore with status `"pending"`.

**[Figure 4.3: Sequence Diagram — Add Transaction]**

> **PlantUML Source — Figure 4.3:**
> ```plantuml
> @startuml
> actor "Treasurer" as TR
> participant "Add Transaction\nPage" as ATP
> participant "receiptService" as RS
> storage "Firebase Storage" as STG
> participant "transactionService" as TS
> database "Firestore\n(transactions)" as DB
>
> TR -> ATP : Enter date, type, category, amount, description
> opt Receipt Attached
>   TR -> ATP : Upload receipt file
>   ATP -> RS : uploadReceipt(file, uid)
>   RS -> STG : uploadBytes(receipts/{uid}/{timestamp-filename})
>   STG --> RS : Return download URL
>   RS --> ATP : Return { receiptUrl, receiptPath }
> end
> ATP -> ATP : Validate required fields
> alt Valid Input
>   ATP -> TS : createTransaction({ ...data, status: "pending" })
>   TS -> DB : addDoc(transactions, payload)
>   DB --> TS : Confirm save
>   ATP --> TR : Navigate to Transaction History
> else Invalid Input
>   ATP --> TR : Display inline validation errors
> end
> @enduml
> ```

#### 4.2.2.3 Approve Transaction

Figure 4.4 illustrates the approval sequence. The Approval Page loaded pending transactions scoped to the reviewer's role, and the reviewer's decision updated the transaction status and recorded reviewer metadata.

**[Figure 4.4: Sequence Diagram — Approve Transaction]**

> **PlantUML Source — Figure 4.4:**
> ```plantuml
> @startuml
> actor "Reviewer\n(Advisor / BK / Pegawai / Admin)" as RV
> participant "Approval Page" as AP
> participant "transactionService" as TS
> database "Firestore\n(transactions)" as DB
>
> RV -> AP : Open Approval page
> AP -> TS : getPendingTransactions(scope)
> TS -> DB : Query where status == "pending" (scoped)
> DB --> TS : Return pending list
> TS --> AP : Display pending transactions
> RV -> AP : Click Approve or Reject
> AP -> TS : updateTransactionStatus(id, status, reviewedBy)
> TS -> DB : updateDoc({ status, reviewedByUid, reviewedAt })
> DB --> TS : Confirm update
> AP --> RV : Remove entry from list; show success
> @enduml
> ```

#### 4.2.2.4 Generate Financial Report (PDF)

Figure 4.5 illustrates the report generation sequence. The system retrieved approved transactions from Firestore, and jsPDF generated the PDF client-side, which was either downloaded or submitted to Firebase Storage.

**[Figure 4.5: Sequence Diagram — Generate Financial Report]**

> **PlantUML Source — Figure 4.5:**
> ```plantuml
> @startuml
> actor "User\n(Treasurer / Advisor)" as US
> participant "Report Page" as RP
> participant "reportService" as RS
> database "Firestore\n(transactions)" as DB
> participant "jsPDF\n(Client-side)" as PDF
> storage "Firebase Storage" as STG
>
> US -> RP : Select form template & date range
> RP -> RS : getApprovedTransactionsForReport(scope, code, range)
> RS -> DB : Query approved transactions
> DB --> RS : Return transaction list
> RS --> RP : Populate form fields
> US -> RP : Fill remaining fields & select signature
> US -> RP : Click Generate PDF
> RP -> PDF : Build PDF (jsPDF + autoTable + signature image)
> PDF --> RP : Return PDF blob
> alt Download
>   RP --> US : Trigger PDF download to device
> else Submit as Record
>   RP -> STG : Upload PDF to pdf_submissions/
>   STG --> RP : Return download URL
>   RP -> DB : addDoc(pdfSubmissions, { url, formType, uid })
>   RP --> US : Show submission success
> end
> @enduml
> ```

---

### 4.2.3 Activity Diagrams

Activity diagrams modelled the sequential flow of user-initiated processes from start to completion.

#### 4.2.3.1 Add Transaction

Figure 4.6 shows the activity flow for a Treasurer adding a new financial transaction.

**[Figure 4.6: Activity Diagram — Add Transaction]**

> **PlantUML Source — Figure 4.6:**
> ```plantuml
> @startuml
> start
> :Login as Treasurer;
> :Navigate to Add Transaction page;
> :Enter date, type, category, amount, description;
> if (Receipt to attach?) then (yes)
>   :Select and upload receipt file;
>   :File stored in Firebase Storage;
>   :Receipt URL and path saved;
> endif
> :Submit form;
> if (All required fields valid?) then (yes)
>   :Write transaction to Firestore\n(status = "pending");
>   :Navigate to Transaction History;
> else (no)
>   :Display inline validation errors;
>   :Return to form;
> endif
> stop
> @enduml
> ```

#### 4.2.3.2 Approve Transaction

Figure 4.7 shows the activity flow for a Reviewer processing pending transactions.

**[Figure 4.7: Activity Diagram — Approve Transaction]**

> **PlantUML Source — Figure 4.7:**
> ```plantuml
> @startuml
> start
> :Login as Reviewer\n(Advisor / Bendahari Kelab / Pegawai / Admin);
> :Navigate to Approval page;
> :System loads pending transactions within reviewer scope;
> if (Any pending transactions?) then (yes)
>   :Review transaction details and receipt link;
>   if (Decision?) then (Approve)
>     :Update status to "approved";
>   else (Reject)
>     :Update status to "rejected";
>   endif
>   :Record reviewer UID, email, and timestamp;
>   :Remove transaction from pending list;
> else (no)
>   :Display empty state message;
> endif
> stop
> @enduml
> ```

#### 4.2.3.3 Register and Login

Figure 4.8 shows the activity flow for a new user registering and logging into the system.

**[Figure 4.8: Activity Diagram — Register and Login]**

> **PlantUML Source — Figure 4.8:**
> ```plantuml
> @startuml
> start
> :Open application;
> if (Already registered?) then (yes)
>   :Navigate to Login page;
> else (no)
>   :Navigate to Register page;
>   :Fill in full name, matric, email, password;
>   if (All fields valid and password criteria met?) then (yes)
>     :Create Firebase Auth account;
>     :Write Firestore user profile\n(default role: treasurer);
>     :Navigate to Login page;
>   else (no)
>     :Show inline validation errors;
>     :Return to registration form;
>   endif
> endif
> :Enter email/username and password;
> if (Credentials valid?) then (yes)
>   :Retrieve user role from Firestore;
>   :Redirect to role-specific dashboard;
> else (no)
>   :Display Malay error message;
>   :Return to Login page;
> endif
> stop
> @enduml
> ```

---

## 4.3 System Architecture

The SFMS was built on a **two-tier client-server architecture** in which the React frontend communicated directly with Google Firebase cloud services using the Firebase JavaScript SDK. No dedicated application server or REST API layer was required because Firebase provided serverless backend services natively. The architecture consisted of the following layers.

**Presentation Layer (Client Side):**
The single-page application (SPA) was built with React 18 and styled using Tailwind CSS. All five user roles accessed the system through the same web application, which rendered different routes and components based on the authenticated user's role. Vite served as the development and build tool.

**Business Logic Layer (Client-embedded):**
Application logic — including input validation, role-based routing, balance calculations, and PDF generation — was implemented directly within React components and the services layer (`src/services/`). The `ProtectedRoute` component enforced role-based access control at the routing level, and the services layer abstracted all Firestore read/write operations.

**Data Storage Layer (Google Firebase):**
Three Firebase services formed the backend:
- **Firebase Authentication** — Managed user login, session persistence, and account creation.
- **Cloud Firestore** — Stored all structured application data including user profiles, transactions, programmes, and form submissions.
- **Firebase Storage** — Stored binary files including uploaded receipts and generated PDF submissions.

Figure 4.9 illustrates the system architecture.

**[Figure 4.9: System Architecture Diagram — Two-Tier Client-Firebase Model]**

> **PlantUML Source — Figure 4.9:**
> ```plantuml
> @startuml
> skinparam rectangle {
>   BackgroundColor #FEFEFE
>   BorderColor #555555
> }
> skinparam database {
>   BackgroundColor #FFF9C4
>   BorderColor #F9A825
> }
>
> rectangle "Presentation Layer\n(React 18 + Tailwind CSS + Vite)" as CLIENT {
>   rectangle "Treasurer\nModule" as M1
>   rectangle "Advisor\nModule" as M2
>   rectangle "Bendahari Kelab\nModule" as M3
>   rectangle "Pegawai\nModule" as M4
>   rectangle "Admin\nModule" as M5
> }
>
> rectangle "Business Logic Layer\n(React Services + ProtectedRoute)" as LOGIC {
>   rectangle "transactionService" as S1
>   rectangle "reportService" as S2
>   rectangle "dashboardService" as S3
>   rectangle "userService /\nprogrammeService" as S4
>   rectangle "jsPDF (client-side\nPDF generation)" as S5
> }
>
> rectangle "Firebase SDK\n(JavaScript Client SDK v12)" as SDK
>
> database "Firebase Authentication\n(User sessions & accounts)" as AUTH
> database "Cloud Firestore\n(users, transactions,\nprogrammes, formSubmissions,\npdfSubmissions)" as FS
> database "Firebase Storage\n(receipts/, pdf_submissions/,\nsignatures/)" as STG
>
> CLIENT --> LOGIC : calls
> LOGIC --> SDK : uses
> SDK --> AUTH
> SDK --> FS
> SDK --> STG
> @enduml
> ```

---

## 4.4 System Design

### 4.4.1 Data Flow Diagram — Level 0 (Context Diagram)

The Level-0 DFD (context diagram) in Figure 4.10 presented the SFMS as a single process and showed the data flows between the system and its five external entities.

**[Figure 4.10: DFD Level-0 — Context Diagram]**

> **PlantUML Source — Figure 4.10:**
> ```plantuml
> @startuml
> skinparam rectangle {
>   BackgroundColor #EAF4FB
>   BorderColor #2980B9
> }
> skinparam usecase {
>   BackgroundColor #FDFEFE
>   BorderColor #555555
> }
>
> rectangle "Treasurer\n(E1)" as E1
> rectangle "Advisor / Bendahari Kelab /\nPegawai (E2)" as E2
> rectangle "Admin\n(E3)" as E3
>
> usecase "Smart Financial\nManagement\nSystem (SFMS)" as SFMS
>
> E1 --> SFMS : Credentials, transaction data,\nreceipt files, borang fields
> SFMS --> E1 : Transaction history, dashboard summary,\nPDF reports, approval status
>
> E2 --> SFMS : Credentials, approve/reject decisions
> SFMS --> E2 : Pending transaction list,\nfinancial reports
>
> E3 --> SFMS : Credentials, user/programme\nmanagement commands
> SFMS --> E3 : User list, programme list,\nsystem dashboard
> @enduml
> ```

### 4.4.2 Data Flow Diagram — Level 1

The Level-1 DFD in Figure 4.11 decomposed the system into five primary processes, showing the data flows between processes, data stores, and external entities.

**[Figure 4.11: DFD Level-1 — System Processes and Data Stores]**

> **PlantUML Source — Figure 4.11:**
> ```plantuml
> @startuml
> skinparam rectangle {
>   BackgroundColor #EBF5FB
>   BorderColor #2E86C1
>   RoundCorner 5
> }
> skinparam database {
>   BackgroundColor #FEF9E7
>   BorderColor #D4AC0D
> }
> skinparam usecase {
>   BackgroundColor #EAFAF1
>   BorderColor #1E8449
> }
>
> ' External entities
> rectangle "Treasurer (E1)" as E1
> rectangle "Reviewer: Advisor /\nBendahari Kelab /\nPegawai (E2)" as E2
> rectangle "Admin (E3)" as E3
>
> ' Processes
> usecase "P1\nAuthenticate\nUser" as P1
> usecase "P2\nManage\nTransactions" as P2
> usecase "P3\nProcess\nApprovals" as P3
> usecase "P4\nGenerate\nPDF Reports" as P4
> usecase "P5\nManage Users\n& Programmes" as P5
>
> ' Data stores
> database "D1: users\n(Firestore)" as D1
> database "D2: transactions\n(Firestore)" as D2
> database "D3: programmes\n(Firestore)" as D3
> database "D4: formSubmissions\npdfSubmissions\n(Firestore)" as D4
> database "D5: Firebase Storage\n(receipts / pdfs / signatures)" as D5
>
> ' Authentication flows
> E1 --> P1 : credentials
> E2 --> P1 : credentials
> E3 --> P1 : credentials
> P1 --> D1 : read user profile
> P1 --> E1 : session + role
> P1 --> E2 : session + role
> P1 --> E3 : session + role
>
> ' Transaction flows
> E1 --> P2 : transaction data + receipt file
> P2 --> D3 : read programme record
> P2 --> D5 : store receipt file
> P2 --> D2 : write pending transaction
> P2 --> E1 : confirmation + transaction history
>
> ' Approval flows
> D2 --> P3 : pending transactions (scoped)
> D4 --> P3 : pending borang (scoped)
> E2 --> P3 : approve / reject decision
> P3 --> D2 : update transaction status
> P3 --> D4 : update borang status
> P3 --> E2 : updated pending list
>
> ' Report flows
> D2 --> P4 : approved transactions
> E1 --> P4 : form fields + date range
> P4 --> D4 : write form/PDF submission record
> P4 --> D5 : store generated PDF
> P4 --> E1 : PDF download / submission confirmation
>
> ' Admin flows
> E3 --> P5 : user data + programme data
> P5 --> D1 : write / update user profile
> P5 --> D3 : write / update programme record
> P5 --> E3 : updated user and programme lists
> @enduml
> ```

### 4.4.3 Class Diagram

The class diagram in Figure 4.12 illustrated the object-oriented structure of the SFMS, showing the key data models, service classes, and their relationships as implemented.

**[Figure 4.12: Class Diagram]**

> **PlantUML Source — Figure 4.12:**
> ```plantuml
> @startuml
> skinparam classAttributeIconSize 0
>
> class UserProfile {
>   +uid : String
>   +email : String
>   +username : String
>   +fullName : String
>   +matricNumber : String
>   +role : String
>   +club : String
>   +clubs : String[]
>   +category : String
>   +signatures : String[]
> }
>
> class Transaction {
>   +id : String
>   +createdBy : String
>   +createdByClub : String
>   +programmeCode : String
>   +type : String
>   +category : String
>   +amount : Number
>   +date : String
>   +description : String
>   +status : String
>   +receiptUrl : String
>   +receiptPath : String
>   +reviewedByUid : String
>   +reviewedAt : Timestamp
>   +createdAt : Timestamp
>   +updatedAt : Timestamp
> }
>
> class Programme {
>   +id : String
>   +code : String
>   +name : String
>   +club : String
>   +treasurerUid : String
> }
>
> class FormSubmission {
>   +id : String
>   +createdBy : String
>   +createdByClub : String
>   +formType : String
>   +formData : Object
>   +status : String
>   +reviewedBy : String
>   +reviewedAt : Timestamp
>   +createdAt : Timestamp
> }
>
> class TransactionService {
>   +createTransaction(data) : Promise
>   +getTransactionsByUser(uid, code) : Promise
>   +getPendingTransactions() : Promise
>   +getPendingTransactionsByProgrammeCodes(codes) : Promise
>   +updateTransactionStatus(id, status, reviewer) : Promise
>   +removeTransaction(id) : Promise
> }
>
> class ReportService {
>   +getApprovedTransactionsForReport(role, uid, code, range) : Promise
> }
>
> class DashboardService {
>   +getTreasurerDashboardSummary(uid, code) : Promise
>   +getAdvisorDashboardSummary() : Promise
>   +getAdminDashboardSummary() : Promise
>   +getBendahariKelabSummary(club) : Promise
> }
>
> class AuthContext {
>   +currentUser : FirebaseUser
>   +userRole : String
>   +userProfile : UserProfile
>   +loading : Boolean
>   +logout() : void
>   +refreshProfile() : Promise
> }
>
> AuthContext --> UserProfile : manages
> TransactionService --> Transaction : CRUD
> ReportService --> Transaction : reads
> DashboardService --> Transaction : reads
> Transaction --> Programme : references (programmeCode)
> Transaction --> UserProfile : created by / reviewed by
> FormSubmission --> UserProfile : created by / reviewed by
> Programme --> UserProfile : owned by (treasurerUid)
> @enduml
> ```

---

## 4.5 Database Design

The SFMS used **Cloud Firestore** (a NoSQL document database) as its primary data store, supplemented by **Firebase Storage** for binary files. Firestore organised data into five top-level collections of documents, each identified by an auto-generated unique ID. There were no relational joins; references between documents were maintained through stored UID and code string fields.

### 4.5.1 Entity Relationship Diagram (ERD)

Figure 4.13 presents the ERD of the SFMS, reflecting the Firestore document structure with attribute data types and primary/foreign key relationships.

**[Figure 4.13: Entity Relationship Diagram — SFMS Firestore Schema]**

> **PlantUML Source — Figure 4.13:**
> ```plantuml
> @startuml
> skinparam linetype ortho
>
> entity "users" as U {
>   * uid : String <<PK>>
>   --
>   email : String
>   username : String
>   fullName : String
>   matricNumber : String
>   role : Enum(treasurer | advisor | admin\n  | bendahari_kelab | pegawai)
>   club : String
>   clubs : String[]
>   category : String
>   signatures : String[]
>   createdAt : Timestamp
> }
>
> entity "transactions" as T {
>   * id : String <<PK>>
>   --
>   createdBy : String <<FK → users.uid>>
>   createdByClub : String
>   programmeCode : String <<FK → programmes.code>>
>   type : Enum(income | expense)
>   category : String
>   amount : Number
>   date : String
>   description : String
>   status : Enum(pending | approved | rejected)
>   receiptUrl : String
>   receiptPath : String
>   reviewedByUid : String <<FK → users.uid>>
>   reviewedByEmail : String
>   reviewedAt : Timestamp
>   createdAt : Timestamp
>   updatedAt : Timestamp
> }
>
> entity "programmes" as P {
>   * id : String <<PK>>
>   --
>   code : String <<UNIQUE>>
>   name : String
>   club : String
>   treasurerUid : String <<FK → users.uid>>
> }
>
> entity "formSubmissions" as FS {
>   * id : String <<PK>>
>   --
>   createdBy : String <<FK → users.uid>>
>   createdByClub : String
>   formType : String
>   formData : Object
>   status : Enum(menunggu | disemak | diluluskan | ditolak)
>   reviewedBy : String <<FK → users.uid>>
>   reviewedByEmail : String
>   reviewedAt : Timestamp
>   createdAt : Timestamp
> }
>
> entity "pdfSubmissions" as PS {
>   * id : String <<PK>>
>   --
>   uid : String <<FK → users.uid>>
>   formType : String
>   pdfUrl : String
>   pdfPath : String
>   createdAt : Timestamp
> }
>
> U ||--o{ T : "creates (createdBy)"
> U ||--o{ T : "reviews (reviewedByUid)"
> P ||--o{ T : "scopes (programmeCode)"
> U ||--o{ P : "owns (treasurerUid)"
> U ||--o{ FS : "submits (createdBy)"
> U ||--o{ PS : "submits (uid)"
> @enduml
> ```

### 4.5.2 Firestore Collection Schema

Table 4.2 summarises the five Firestore collections, their key fields, and field data types.

**Table 4.2: Firestore Collection Schema**

| Collection | Key Field | Type | Description |
|---|---|---|---|
| **users** | uid | String (PK) | Firebase Auth UID |
| | fullName | String | User's full name (uppercase) |
| | email | String | Login email address |
| | username | String | Auto-derived from email prefix |
| | role | String | One of: treasurer, advisor, admin, bendahari\_kelab, pegawai |
| | club | String | Single assigned club (treasurer, bendahari\_kelab) |
| | clubs | String[ ] | Array of assigned clubs (advisor) |
| | category | String | BAPP category (pegawai only) |
| | signatures | String[ ] | Base64 data URLs of saved digital signatures |
| **transactions** | id | String (PK) | Auto-generated Firestore document ID |
| | createdBy | String (FK) | UID of creating Treasurer |
| | programmeCode | String (FK) | Programme code reference |
| | type | String | `income` or `expense` |
| | amount | Number | Transaction amount in RM |
| | status | String | `pending`, `approved`, or `rejected` |
| | receiptUrl | String | Firebase Storage download URL |
| | receiptPath | String | Storage path for cascade deletion |
| | reviewedByUid | String (FK) | UID of approving reviewer |
| | createdAt | Timestamp | Server-generated creation time |
| **programmes** | id | String (PK) | Auto-generated Firestore document ID |
| | code | String (UNIQUE) | Uppercase programme code |
| | name | String | Programme name |
| | club | String | Associated club name |
| | treasurerUid | String (FK) | UID of owning Treasurer (anti-spam) |
| **formSubmissions** | id | String (PK) | Auto-generated Firestore document ID |
| | createdBy | String (FK) | UID of submitting Treasurer |
| | formType | String | One of nine UTM form type identifiers |
| | formData | Object | Structured form field values |
| | status | String | `menunggu`, `disemak`, `diluluskan`, or `ditolak` |
| | createdAt | Timestamp | Server-generated submission time |
| **pdfSubmissions** | id | String (PK) | Auto-generated Firestore document ID |
| | uid | String (FK) | UID of submitting user |
| | formType | String | UTM form type identifier |
| | pdfUrl | String | Firebase Storage download URL |
| | pdfPath | String | Storage path for PDF file |
| | createdAt | Timestamp | Server-generated submission time |

Firebase Storage organised binary files under three path prefixes:
- `receipts/{uid}/{timestamp}-{filename}` — uploaded receipt images and PDFs
- `pdf_submissions/{formType}/{uid}/{timestamp}.pdf` — submitted financial forms
- `signatures/{uid}/slot-{slot}.png` — user digital signature images

---

## 4.6 Interface Design

The user interface of the SFMS was designed using Tailwind CSS with UTM institutional branding: a dark red (`red-900`) primary colour palette and a light grey (`gray-50`) background. All cards used `rounded-2xl` corners with `shadow-sm`. Status indicators followed a consistent colour convention: green for approved/diluluskan, amber for pending/menunggu, and red for rejected/ditolak. The interface was responsive and functioned on desktops, tablets, and mobile browsers.

### 4.6.1 Login Interface

The login screen was the entry point for all user roles. It employed a split-panel layout on large screens, with the institutional branding panel on the left and the login form on the right. The form supported both email and username input, included a password visibility toggle, a "Remember Me" persistence toggle, and an inline password recovery form triggered by the "Lupa Kata Laluan?" link.

**[Figure 4.14: Login Interface Mockup]**

### 4.6.2 Treasurer Dashboard Interface

Upon login, the Treasurer was presented with a hierarchical programme selector (Category → Club → Programme) at the top of the dashboard. Once a programme was selected, four financial summary cards were displayed: Current Balance, Total Income, Total Expenses, and Pending Transactions count. Navigation links directed the user to Add Transaction, Transaction History, and Reports.

**[Figure 4.15: Treasurer Dashboard Mockup — Programme Selector and Summary Cards]**

### 4.6.3 Add Transaction Interface

The Add Transaction form was divided into two sections: Transaction Details and Receipt Upload. The transaction type toggle dynamically updated the category dropdown. An optional file upload field accepted image and PDF receipt files. Required fields were highlighted on invalid submission.

**[Figure 4.16: Add Transaction Interface Mockup]**

### 4.6.4 Approval Interface

The Approval interface presented a paginated list of pending transactions scoped to the reviewer's authority. Each entry showed the date, category, amount, programme code, and a receipt link. Approve and Reject buttons were provided per entry. A second tab listed pending borang (financial form) submissions for the same scope.

**[Figure 4.17: Approval Interface Mockup — Pending Transactions and Borang]**

### 4.6.5 Report Generation Interface

The Report interface provided a form template selector for nine UTM financial form types. Selecting a template rendered the corresponding dynamic input form, auto-populating financial fields from approved transactions within the selected date range. Digital signature slots allowed the user to embed their saved signature. The completed form could be downloaded as a PDF or submitted as a formal record.

**[Figure 4.18: Report Generation Interface Mockup]**

### 4.6.6 Admin Management Interfaces

The User Management interface at `/admin/users` displayed all registered users in a table, with an expandable form for creating new accounts and assigning roles. The Programme Management interface at `/admin/programmes` provided inline creation, editing, and deletion of programme records, with automatic uppercase enforcement on programme codes.

**[Figure 4.19: Admin User Management Interface Mockup]**

**[Figure 4.20: Admin Programme Management Interface Mockup]**

---

## 4.7 Chapter Summary

Chapter 4 presented the requirement analysis and system design of the Smart Financial Management System for BAPP UTM. Section 4.2 documented the system's requirements through a use case diagram covering five user roles (Treasurer, Advisor, Bendahari Kelab, Pegawai, and Admin) and twelve use cases (Table 4.1), four sequence diagrams describing the Login, Add Transaction, Approve Transaction, and Generate Report processes (Figures 4.2–4.5), and three activity diagrams covering the Add Transaction, Approve Transaction, and Register/Login workflows (Figures 4.6–4.8).

Section 4.3 described the two-tier system architecture in which the React 18 SPA communicated directly with three Firebase cloud services — Authentication, Cloud Firestore, and Firebase Storage — via the Firebase JavaScript SDK, with no intermediate application server. Section 4.4 presented the system design through a Level-0 context DFD (Figure 4.10), a Level-1 process DFD decomposing five core system processes across five Firestore data stores (Figure 4.11), and a class diagram illustrating the relationships between the five data model classes and three service classes (Figure 4.12). Section 4.5 detailed the Firestore database schema through a corrected ERD (Figure 4.13) and a complete collection field specification (Table 4.2) covering all five collections and Firebase Storage path conventions. Section 4.6 presented interface design mockups for the seven primary screens of the system. A deployment and setup guide for the system is provided in Appendix A.

The design artefacts documented in this chapter served as the blueprint for the implementation activities presented in Chapter 5.
