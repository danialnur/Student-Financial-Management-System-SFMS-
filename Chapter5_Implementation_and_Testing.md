# CHAPTER 5: SYSTEM IMPLEMENTATION AND TESTING

---

## 5.1 Introduction

Chapter 5 presents the implementation and testing phase of the Smart Financial Management System (SFMS), a web-based financial management platform developed for Bahagian Aktiviti dan Pembangunan Pelajar (BAPP), Universiti Teknologi Malaysia (UTM). This chapter documents the technical activities undertaken to translate the system design into a fully functional application, covering the coding of core system modules, the design and layout of key user interfaces, and the testing strategies applied to validate the system's correctness and usability.

The SFMS was implemented as a Single-Page Application (SPA) using React 18 as the frontend framework, Firebase as the cloud-based backend platform — providing Authentication, Firestore database, and Storage services — and Vite as the build toolchain. The system supported five distinct user roles: Treasurer (Bendahari), Advisor (Penasihat), Club Treasurer (Bendahari Kelab), Officer (Pegawai), and System Administrator (Admin), each with dedicated functional modules and access-controlled routes.

Section 5.2 describes the development environment and the coding of the system's main functional modules. Section 5.3 presents the interfaces of the key system functions with annotated screenshots. Section 5.4 documents the testing strategies employed, including black-box testing, white-box testing, and user acceptance testing. The chapter concludes with a summary in Section 5.5.

---

## 5.2 Coding of System Main Functions

This section describes the technical implementation of the Smart Financial Management System, covering the development environment configuration and the coding of the system's main functional modules. The implementation was structured using a layered architecture in which React components handled the user interface and local state, a dedicated services layer managed all communication with the Firebase backend, and a global context layer provided shared authentication state across the application. Each subsection below details the coding approach, key functions, and design decisions for one module, supported by relevant code excerpts.

### 5.2.1 Development Environment and Project Setup

The SFMS was developed on a Windows 11 machine using Visual Studio Code as the primary Integrated Development Environment (IDE). The project was scaffolded using Vite 5.4.10, a modern frontend build tool that offers a fast Hot Module Replacement (HMR) development server and an optimised production bundle using Rollup. Table 5.1 summarises the development environment and the key technologies used.

**Table 5.1: Development Environment Specifications**

| Component | Technology / Tool | Version |
|---|---|---|
| Frontend Framework | React | 18.3.1 |
| Routing Library | React Router DOM | 7.14.1 |
| Backend-as-a-Service | Firebase (Auth, Firestore, Storage) | 12.12.1 |
| CSS Framework | Tailwind CSS | 3.4.17 |
| PDF Generation | jsPDF + jsPDF-AutoTable | 4.2.1 / 5.0.7 |
| Build Tool | Vite | 5.4.10 |
| Code Linter | ESLint | 9.13.0 |
| IDE | Visual Studio Code | Latest |
| Operating System | Windows 11 | — |

The project source code was organised under the `src/` directory, partitioned into subdirectories by concern: `pages/` for page-level React components, `components/` for shared UI components, `services/` for data access functions, `context/` for global state management, `config/` for static configuration, and `firebase/` for backend initialisation. This architecture promoted a clear separation of concerns, making individual modules independently maintainable and testable.

---

### 5.2.2 Firebase Initialisation and Configuration

All backend services — user authentication, document storage, and file storage — were provided by Google Firebase. The Firebase project was initialised in `src/firebase/config.js`, which exported three service instances used throughout the application:

- **`auth`** — Firebase Authentication instance, used for login, registration, and session management.
- **`db`** — Firestore database instance, used for all persistent application data.
- **`storage`** — Firebase Storage instance, used for receipt images and submitted PDF forms.

A secondary Firebase authentication instance was maintained in `src/firebase/adminAuth.js`. This secondary instance allowed the System Administrator to create new user accounts via Firebase's `createUserWithEmailAndPassword` API without disrupting their own authenticated session. Without this approach, the admin's session would be replaced by the newly created user's session upon account creation.

The Firestore database was organised into five top-level collections:

- **`users`** — User profile documents containing the user's name, email, role, assigned club(s), and saved digital signatures.
- **`transactions`** — Income and expense records with type, category, amount, date, programme code, status, and receipt metadata.
- **`programmes`** — Academic programme definitions with unique programme codes and club associations.
- **`formSubmissions`** — Form data submitted through the dynamic form module with review status tracking.
- **`pdfSubmissions`** — Metadata records for PDF forms uploaded to Firebase Storage.

---

### 5.2.3 Authentication Module

The authentication module managed user login, self-registration, session persistence, and password recovery. Its logic was distributed across `LoginPage.jsx`, `RegisterPage.jsx`, and the global `AuthContext.jsx`.

#### 5.2.3.1 Global Authentication State (AuthContext)

Authentication state was managed globally using React's Context API in `src/context/AuthContext.jsx`. The `AuthProvider` component wrapped the entire application and subscribed to Firebase's `onAuthStateChanged` listener, which fired whenever the authentication state changed — including on initial page load (session restoration), login, and logout. Upon detecting an authenticated user, the context fetched that user's Firestore profile document to retrieve their role and personal data, which were then made available to all child components through the `useAuth()` custom hook.

```jsx
// src/context/AuthContext.jsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setLoading(true);
    setCurrentUser(user);
    await fetchProfile(user);
    setLoading(false);
  });
  return () => unsubscribe();
}, [fetchProfile]);
```

The context exposed five values to consuming components: `currentUser` (the Firebase Auth user object), `userRole` (the string role identifier), `userProfile` (the full Firestore user document), `loading` (a boolean indicating whether auth state resolution was still in progress), and `refreshProfile` (a function to re-fetch the user profile after updates such as signature saves).

#### 5.2.3.2 Login Flow

The login process in `LoginPage.jsx` first performed client-side validation before invoking Firebase's `signInWithEmailAndPassword` function. The validation function checked that the email or username field was non-empty and, if an email address was provided, conformed to a standard format via regular expression, and that the password field was non-empty and at least six characters in length.

```jsx
// src/pages/LoginPage.jsx
const validate = () => {
  const errors = {};
  if (!email.trim())
    errors.email = "E-mel atau nama pengguna diperlukan.";
  else if (email.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Sila masukkan alamat e-mel yang sah.";
  if (!password)
    errors.password = "Kata laluan diperlukan.";
  else if (password.length < 6)
    errors.password = "Kata laluan mestilah sekurang-kurangnya 6 aksara.";
  return errors;
};
```

The system also supported username login. When the submitted value did not contain an `@` symbol, it was treated as a username and resolved to its corresponding email address via the `getEmailByUsername` service function before passing it to Firebase Authentication. Session persistence was configurable via a "Remember Me" checkbox using `browserLocalPersistence` or `browserSessionPersistence`. Firebase error codes were mapped to user-facing Malay-language messages through a `getErrorMessage` utility function.

#### 5.2.3.3 Self-Registration

New users registered at `/register` by providing a full name, matriculation number, email address, and password. Password strength was enforced through five real-time criteria: minimum eight characters, at least one uppercase letter, one lowercase letter, one digit, and one special character. Upon successful registration, a Firebase Authentication account was created and a corresponding Firestore profile document was written with the default role of `"treasurer"`.

#### 5.2.3.4 Password Recovery

Users who had forgotten their credentials could trigger a password reset from the login screen. Upon clicking "Lupa Kata Laluan?" (Forgot Password?), a secondary form was rendered on the same page. Firebase's `sendPasswordResetEmail` function dispatched a reset link to the submitted address after validating its format.

#### 5.2.3.5 Field-Level Encryption of Crucial Data

Beyond authenticating who a user was, the system also protected what was stored about them. Three crucial personally identifiable fields on the user profile — IC number, phone number, and matriculation number — were encrypted at the application level with AES-256-GCM before ever reaching Firestore, implemented in `src/utils/fieldEncryption.js` using the browser's native Web Crypto API.

```js
// src/utils/fieldEncryption.js
export async function encryptField(plaintext) {
  if (plaintext == null || plaintext === "") return plaintext ?? "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(String(plaintext))
  );
  return `enc:v1:${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipherBuf))}`;
}
```

`userService.js` called `encryptField()` immediately before every write to these three fields — at registration (`createUserProfile`) and at self-service profile edits (`updateUserProfile`) — while `AuthContext.jsx` called the matching `decryptField()` exactly once, right after a profile document was fetched from Firestore:

```jsx
// src/context/AuthContext.jsx
const [icNumber, phone, matricNumber] = await Promise.all([
  decryptField(data.icNumber),
  decryptField(data.phone),
  decryptField(data.matricNumber),
]);
setUserProfile({ ...data, icNumber, phone, matricNumber });
```

Because decryption happened once at the context layer, every other screen that read `userProfile` — the profile editor, and the auto-fill logic that copies a treasurer's IC number and phone number into a UTM financial form — continued to work against plain values without any further changes.

The AES-256 key was supplied to the frontend build through an environment variable rather than committed to source control, reflecting a deliberate trade-off for a project with no backend server of its own: the key is necessarily present in the deployed JavaScript bundle. This closes the gap against casual exposure of the raw Firestore data (e.g. through the Firebase console or a database export) while not being resistant to an attacker capable of inspecting the frontend bundle itself — a limitation documented in §4.5.3 and §6.4, and revisited as future work in §6.5. Pre-existing plaintext records were brought in line with the new scheme by a one-off migration script (`scripts/encrypt-user-pii.mjs`), run in a dry-run mode first to report the exact set of affected records before any write was made.

---

### 5.2.4 Role-Based Access Control (RBAC)

Access control was enforced at the routing level through the `ProtectedRoute` component located in `src/components/ProtectedRoute.jsx`. This component wrapped all protected routes in `App.jsx` and accepted an `allowedRoles` prop that listed the roles authorised to access the enclosed route.

```jsx
// src/components/ProtectedRoute.jsx
export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
```

The component evaluated three sequential conditions. First, it waited for the global `loading` flag from `AuthContext` to become `false` before making any routing decision, preventing premature redirects during session restoration. Second, it redirected unauthenticated users to `/login`. Third, it redirected authenticated users whose role was not listed in `allowedRoles` back to `/login`, preventing horizontal privilege escalation between roles. The system defined 27 protected routes across five role-specific modules.

---

### 5.2.5 Transaction Management Module

The transaction management module was the core financial engine of the SFMS. It was implemented across `AddTransactionPage.jsx`, `EditTransactionPage.jsx`, `TransactionHistoryPage.jsx`, and the `transactionService.js` service layer.

#### 5.2.5.1 Service Layer Architecture

All Firestore read and write operations for transactions were encapsulated in `src/services/transactionService.js`. This service abstraction ensured that any changes to the data model or query logic were confined to a single file. The key service functions are shown below.

```js
// src/services/transactionService.js
export async function createTransaction(data) {
  const payload = {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return await addDoc(transactionsRef, payload);
}

export async function updateTransactionStatus(id, status, reviewedBy) {
  const docRef = doc(db, "transactions", id);
  await updateDoc(docRef, {
    status,
    reviewedByUid:   reviewedBy.uid,
    reviewedByEmail: reviewedBy.email,
    reviewedAt:      serverTimestamp(),
    updatedAt:       serverTimestamp(),
  });
}

export async function removeTransaction(id) {
  const docRef = doc(db, "transactions", id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    if (data.receiptPath) await deleteReceiptByPath(data.receiptPath);
  }
  await deleteDoc(docRef);
}
```

- **`createTransaction(data)`** — Created a new transaction document with status hardcoded to `"pending"` and server-generated timestamps.
- **`updateTransactionStatus(id, status, reviewedBy)`** — Updated the approval status and recorded the reviewer's UID, email, and a server-generated review timestamp.
- **`removeTransaction(id)`** — Deleted a transaction document and, if a `receiptPath` was present, also deleted the associated file from Firebase Storage to prevent orphaned objects.

A scope-limited variant, `getPendingTransactionsByProgrammeCodes(codes)`, retrieved pending transactions for an Advisor's assigned clubs. To comply with Firestore's 30-element `in` clause limit, it batched programme codes in chunks of 30, executing one query per chunk and merging the results.

#### 5.2.5.2 Receipt File Handling

Receipt files were uploaded to Firebase Storage via `receiptService.js`. A unique file path was generated using the user's UID and a millisecond timestamp, preventing filename collisions.

```js
// src/services/receiptService.js
export async function uploadReceipt(file, uid) {
  const fileName  = `${Date.now()}-${file.name}`;
  const storageRef = ref(storage, `receipts/${uid}/${fileName}`);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return { receiptUrl: downloadURL, receiptPath: storageRef.fullPath };
}

export async function deleteReceiptByPath(path) {
  if (!path) return;
  await deleteObject(ref(storage, path));
}
```

The resulting `receiptUrl` and `receiptPath` were stored within the transaction document, enabling cascade deletion when a transaction was removed.

#### 5.2.5.3 Approval Workflow

The approval workflow followed a three-state lifecycle: `pending` → `approved` or `rejected`. Transactions were created in the `pending` state by Treasurers and reviewed by authorised users via the `ApprovalPage`. Approved transactions were included in balance calculations; rejected transactions were excluded.

---

### 5.2.6 Dashboard Module

Each user role was served by a dedicated dashboard component presenting role-appropriate financial summaries, calculated by `src/services/dashboardService.js`. The Treasurer Dashboard provided the most granular view, requiring the user to first select a club category, then a specific club, and then a programme. The selection was persisted to `localStorage` and restored on subsequent logins. Once a programme was selected, the dashboard displayed four summary cards: current balance (approved income minus approved expenses), total income, total expenses, and pending transaction count. The Admin Dashboard aggregated system-wide metrics in parallel using `Promise.all`. The Bendahari Kelab Dashboard computed per-programme financial summaries for all programmes under the user's club, also applying query batching for clubs with many programmes.

---

### 5.2.7 Financial Reporting and PDF Generation Module

The reporting module enabled authorised users to generate nine standardised UTM financial form types as PDF documents. The module was implemented in `ReportPage.jsx`, supported by `reportService.js`, with form structures defined in `src/config/formsConfig.js`. Each form template was declared as a JavaScript object specifying sections and field types (`text`, `number`, `date`, `textarea`, `signature`). The nine supported templates were:

1. Akuan Penerimaan Wang Tunai (Cash Receipt Declaration)
2. Baucer Bayaran (Payment Voucher)
3. Tuntutan Bayaran Balik (Reimbursement Claim)
4. Senarai Invois (Invoice List)
5. Tuntutan Elaun Penceramah (Speaker Allowance Claim)
6. Pendahuluan Aktiviti (Activity Advance)
7. Permohonan Pengecualian Cukai (Tax Exemption Request)
8. Penyata Kewangan + Senarai Resit (Financial Statement with Receipt List)
9. Penyerahan Cek/Wang Tunai (Cheque/Cash Submission Form)

When the user submitted a filled form, jsPDF and jsPDF-AutoTable generated a formatted PDF client-side, embedding form data and digital signatures. Each user could register up to two signatures stored as base64-encoded data URLs in their Firestore profile. Generated forms could be downloaded directly or submitted to Firebase Storage as a formal record tracked in the `pdfSubmissions` collection.

---

### 5.2.8 User and Programme Management Module

**User Management** (`UserManagementPage.jsx`, `userService.js`): Administrators created new user accounts using a secondary Firebase Auth instance (`adminAuth`) so that their own session was not replaced. After account creation, a Firestore profile document was written with the assigned role and, for the Advisor role, one or more club associations. Existing records could be updated to reassign roles.

**Programme Management** (`ProgrammeManagementPage.jsx`, `programmeService.js`): Administrators could create, edit, and delete programmes. Each programme code was automatically converted to uppercase. Duplicate programme codes were rejected by the service before any Firestore write was attempted.

---

## 5.3 Interfaces of System Main Functions

This section presents and describes the main user interfaces of the SFMS, covering the layout, components, and interactions available on each key screen.

### 5.3.1 Login and Password Recovery Interface

The login interface employed a split-panel layout. On large screens, the left panel displayed the BAPP UTM institutional logo, the system name "Sistem Pengurusan Kewangan Bijak," and three institutional highlight tiles set against a dark red gradient background aligned with UTM's institutional colour scheme. The right panel presented the login form with labelled fields for email/username and password, a visibility toggle, a "Remember Me" checkbox, and a "Lupa Kata Laluan?" link that revealed the password recovery form inline without navigating away from the page. Inline field-level error messages appeared beneath invalid inputs, and Firebase authentication errors were displayed in a banner above the submit button.

**[Figure 5.1: Login Interface and Inline Password Recovery Form]**

---

### 5.3.2 User Registration Interface

The registration interface presented a single-column form capturing the user's full name (auto-converted to uppercase), matriculation number, email address, password, and password confirmation. A real-time password strength checklist showed five criteria with green tick marks as each was satisfied, reducing registration failures caused by invalid passwords.

**[Figure 5.2: User Registration Interface with Real-Time Password Strength Checklist]**

---

### 5.3.3 Treasurer Dashboard Interface

Upon login, the Treasurer was directed to the main dashboard. The top of the dashboard presented a hierarchical three-step selection: club category → specific club → programme. The current selection was persisted to `localStorage` and restored on subsequent visits. Once a programme was selected, four financial summary cards were displayed: Current Balance, Total Income, Total Expenses, and Pending Transactions count.

**[Figure 5.3: Treasurer Dashboard — Hierarchical Programme Selection (Category → Club → Programme)]**

**[Figure 5.4: Treasurer Dashboard — Financial Summary Cards]**

---

### 5.3.4 Add Transaction Interface

The Add Transaction interface at `/treasurer/add-transaction` presented a form divided into two sections: Transaction Details and Receipt Upload. The transaction type toggle (Income / Expense) dynamically updated the category dropdown. The optional receipt upload field supported image and PDF formats, displaying a filename preview once selected. On successful submission, the user was navigated to the Transaction History page.

**[Figure 5.5: Add Transaction Interface]**

---

### 5.3.5 Transaction History Interface

The Transaction History interface at `/treasurer/transactions` listed all transactions created by the logged-in Treasurer, sorted from most recent to oldest. Each entry displayed the date, category, description, amount, and a colour-coded status badge: green for "Diluluskan" (Approved), amber for "Menunggu" (Pending), and red for "Ditolak" (Rejected). Pending transactions included Edit and Delete action buttons; approved and rejected transactions were read-only. Deletion required an explicit confirmation step.

**[Figure 5.6: Transaction History Interface with Colour-Coded Status Badges]**

---

### 5.3.6 Approval Interface

The Approval interface was accessible to Advisors, Pegawai, Bendahari Kelab, and Admin users. The interface listed all pending transactions within the reviewer's authorised scope — Advisors saw only transactions from their assigned clubs' programmes, while Pegawai and Admin saw all pending transactions system-wide. Each entry displayed the date, category, amount, programme code, and a receipt link. Approve and Reject buttons were presented for each entry, and a separate section listed pending PDF form submissions.

**[Figure 5.7: Approval Interface — Pending Transactions List]**

---

### 5.3.7 Report Generation Interface

The Report interface presented a form template selector listing the nine supported UTM form types. Upon selecting a template, the system dynamically rendered the corresponding input form. For forms requiring financial data, a date range filter queried and populated the form with matching approved transactions automatically. Signature fields displayed the user's saved digital signatures as selectable options. Form field values were auto-saved to `localStorage` as a draft to prevent data loss on accidental navigation.

**[Figure 5.8: Report Generation Interface — Form Template Selection and Dynamic Input Form]**

---

### 5.3.8 User Management Interface

The User Management interface at `/admin/users` displayed all registered system users in a tabular layout showing name, email, role, and associated club(s). An expandable creation form allowed the admin to register a new user. When the Advisor role was selected, additional fields appeared for assigning clubs. Existing records could be updated to reassign roles.

**[Figure 5.9: User Management Interface — User List and Creation Form]**

---

### 5.3.9 Programme Management Interface

The Programme Management interface at `/admin/programmes` displayed all registered programmes with inline creation and editing. The programme code field was automatically uppercased; submitting a duplicate code displayed an inline error without creating a record.

**[Figure 5.10: Programme Management Interface — Programme List and Inline Creation Form]**

---

## 5.4 Testing

System testing verified that the SFMS operated correctly under normal and boundary conditions and satisfied the functional requirements established during the analysis and design phases. Three complementary testing strategies were employed: black-box testing (Section 5.4.1), which examined the system's external behaviour; white-box testing (Section 5.4.2), which analysed internal code logic and branch coverage; and user acceptance testing (Section 5.4.3), which evaluated usability and functional satisfaction with real users.

---

### 5.4.1 Black Box Testing

Black-box testing evaluated system behaviour without reference to internal implementation details. Test cases were derived from the system's functional requirements and covered three aspects: system workflow (Section 5.4.1.1), input-output verification (Section 5.4.1.2), and error message responses (Section 5.4.1.3).

#### 5.4.1.1 System Flow

System flow tests verified that the application navigated correctly between states in response to user actions across all primary workflows.

**Table 5.2: System Flow Test Cases**

| Test ID | Test Case Description | Test Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| SF-01 | Login as Treasurer | 1. Open /login. 2. Enter valid treasurer credentials. 3. Click "Log Masuk." | Redirected to /treasurer/dashboard. | Redirected to /treasurer/dashboard. | Pass |
| SF-02 | Login as Advisor | 1. Open /login. 2. Enter valid advisor credentials. 3. Click "Log Masuk." | Redirected to /advisor/dashboard. | Redirected to /advisor/dashboard. | Pass |
| SF-03 | Login as Admin | 1. Open /login. 2. Enter valid admin credentials. 3. Click "Log Masuk." | Redirected to /admin/dashboard. | Redirected to /admin/dashboard. | Pass |
| SF-04 | Cross-role route access blocked | 1. Log in as Treasurer. 2. Manually navigate to /admin/users. | Redirected to /login. | Redirected to /login. | Pass |
| SF-05 | Unauthenticated route access blocked | 1. Without logging in, navigate to /treasurer/dashboard. | Redirected to /login. | Redirected to /login. | Pass |
| SF-06 | Treasurer adds a transaction | 1. Log in as Treasurer. 2. Navigate to Add Transaction. 3. Fill all required fields. 4. Click Submit. | Transaction saved in Firestore with status "pending"; navigated to Transaction History. | Transaction saved; navigation correct. | Pass |
| SF-07 | Treasurer edits a pending transaction | 1. Navigate to Transaction History. 2. Click Edit on a pending transaction. 3. Modify a field. 4. Save. | Transaction updated in Firestore; redirected to Transaction History. | Transaction updated; redirected correctly. | Pass |
| SF-08 | Advisor approves a transaction | 1. Log in as Advisor. 2. Navigate to Approvals. 3. Click Approve on a pending transaction. | Transaction status updated to "approved"; entry removed from pending list. | Status updated; removed from list. | Pass |
| SF-09 | Advisor rejects a transaction | 1. Log in as Advisor. 2. Navigate to Approvals. 3. Click Reject on a pending transaction. | Transaction status updated to "rejected." | Status updated correctly. | Pass |
| SF-10 | Treasurer deletes a pending transaction | 1. Navigate to Transaction History. 2. Click Delete on a pending transaction. 3. Confirm. | Transaction removed from Firestore; associated receipt file deleted from Firebase Storage. | Transaction and receipt deleted. | Pass |
| SF-11 | Dashboard balance reflects approved transactions | 1. Approve an income transaction. 2. View that programme's Treasurer dashboard. | Dashboard balance increases by the approved amount. | Balance updated correctly. | Pass |
| SF-12 | Password reset email sent | 1. Click "Lupa Kata Laluan?" 2. Enter a registered email. 3. Submit. | Success message displayed; password reset email sent. | Message displayed; email received. | Pass |
| SF-13 | Logout | 1. Click Logout in the page header. | Session ended; redirected to /login; back navigation blocked. | Redirected to /login; back navigation blocked. | Pass |

#### 5.4.1.2 Input Output Verification

Input-output tests verified that the system correctly processed valid, invalid, and boundary inputs and produced the expected outputs or rejections.

**Table 5.3: Input-Output Verification Test Cases**

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| IO-01 | Login | Valid email and correct password | Authenticated; redirected to role-specific dashboard. | Redirected to correct dashboard. | Pass |
| IO-02 | Login | Valid email, empty password | Inline error: "Kata laluan diperlukan." | Error displayed. | Pass |
| IO-03 | Login | Empty email and empty password | Two inline errors displayed simultaneously. | Both errors displayed. | Pass |
| IO-04 | Login | Malformed email (e.g., "usermail") | Inline error: "Sila masukkan alamat e-mel yang sah." | Error displayed. | Pass |
| IO-05 | Add Transaction | Amount = 500.00, all fields valid | Transaction saved in Firestore with `amount: 500` (numeric). | Transaction saved correctly. | Pass |
| IO-06 | Add Transaction | Receipt file (PNG or PDF) | File uploaded to Firebase Storage; download URL stored in transaction. | URL saved; receipt viewable via link. | Pass |
| IO-07 | Registration | All password criteria met; matching confirmation | Account created; Firestore profile written. | Account created successfully. | Pass |
| IO-08 | Registration | Confirm password field does not match | Inline mismatch error displayed. | Error displayed. | Pass |
| IO-09 | Programme Management | Duplicate programme code submitted | Error displayed; no duplicate document created in Firestore. | Error displayed; no duplicate. | Pass |
| IO-10 | Programme Management | Unique programme code in lowercase | Programme code stored in uppercase; document created. | Code uppercased; programme created. | Pass |
| IO-11 | Approval | Approve a transaction with a receipt attached | Status updated to "approved"; receipt URL remains accessible. | Status updated; receipt accessible. | Pass |

#### 5.4.1.3 Error Messages

Error message tests confirmed that the system presented clear, contextually accurate messages when invalid inputs were submitted or backend errors occurred.

**Table 5.4: Error Message Test Cases**

| Test ID | Trigger Condition | Expected Error Message | Actual Message | Status |
|---|---|---|---|---|
| EM-01 | Login — incorrect password | "E-mel atau kata laluan tidak sah. Sila cuba lagi." | Correct message displayed. | Pass |
| EM-02 | Login — unregistered email | "Tiada akaun dijumpai dengan alamat e-mel ini." | Correct message displayed. | Pass |
| EM-03 | Login — empty email field | "E-mel atau nama pengguna diperlukan." (inline) | Displayed inline beneath email field. | Pass |
| EM-04 | Registration — email already registered | "Akaun dengan e-mel ini sudah wujud." | Correct message displayed. | Pass |
| EM-05 | Registration — passwords do not match | Mismatch error on confirm password field | Error displayed. | Pass |
| EM-06 | Add Transaction — required field left empty | Form submission blocked; required field highlighted | Submission blocked correctly. | Pass |
| EM-07 | Programme creation — duplicate code | Duplicate code warning; submission rejected | Warning displayed; no record created. | Pass |
| EM-08 | Password reset — unregistered email | "Tiada akaun dijumpai dengan alamat e-mel ini." | Correct message displayed. | Pass |

---

### 5.4.2 White Box Testing

White-box testing examined the internal code logic of the system to verify that all decision branches, conditional paths, and loops executed correctly. Three key code segments were analysed: the login form validation function, the `ProtectedRoute` access control component, and the Firestore query batching logic in the transaction service.

#### 5.4.2.1 Login Form Validation Logic

The `validate()` function in `LoginPage.jsx` contained four independent conditional branches:

1. `if (!email.trim())` → set a "required" error for the email field.
2. `else if (email.includes("@") && !regex.test(email))` → set a format error for a malformed email.
3. `if (!password)` → set a "required" error for the password field.
4. `else if (password.length < 6)` → set a minimum-length error.

The function returned an errors object; if the object was non-empty, form submission was halted. Figure 5.11 illustrates the branch coverage flowchart for this function.

**[Figure 5.11: Login Validation Function — Branch Coverage Flowchart]**

**Table 5.5: White Box Test Cases — Login Validation (`validate()`)**

| Test ID | Input Conditions | Branches Exercised | Expected Outcome |
|---|---|---|---|
| WB-01 | `email = ""`, `password = ""` | Branch 1 and Branch 3 | Both required errors set; form blocked. |
| WB-02 | `email = "invalid"`, `password = ""` | Branch 2 and Branch 3 | Email format error + password required error. |
| WB-03 | `email = "valid@mail.com"`, `password = "abc"` | Branch 4 | Password minimum-length error. |
| WB-04 | `email = "valid@mail.com"`, `password = "correct123"` | No branches triggered | No errors returned; Firebase call proceeds. |

All four branches produced the expected outcome, confirming 100% branch coverage of the validation function.

#### 5.4.2.2 ProtectedRoute Access Control Logic

The `ProtectedRoute` component evaluated three sequential conditions before rendering protected content. Figure 5.12 illustrates the four possible execution paths through the component.

**[Figure 5.12: ProtectedRoute Execution Path Diagram]**

| Path | Condition | Outcome |
|---|---|---|
| Path A | `loading === true` | Loading screen rendered. |
| Path B | `loading === false`, `currentUser === null` | `<Navigate to="/login" />` |
| Path C | `loading === false`, `currentUser !== null`, role not in `allowedRoles` | `<Navigate to="/login" />` |
| Path D | `loading === false`, `currentUser !== null`, role in `allowedRoles` | Protected `children` rendered. |

**Table 5.6: White Box Test Cases — ProtectedRoute**

| Test ID | Authentication State | Role | Expected Behaviour |
|---|---|---|---|
| WB-05 | `loading = true` | Any | Loading screen rendered; no redirect. |
| WB-06 | `loading = false`, no user | — | Redirect to /login. |
| WB-07 | `loading = false`, user authenticated | Role not in `allowedRoles` (e.g., "treasurer" on /admin route) | Redirect to /login. |
| WB-08 | `loading = false`, user authenticated | Role in `allowedRoles` | Protected content rendered. |

All four paths executed as expected, confirming that no protected route could be rendered under any unauthorised condition.

#### 5.4.2.3 Firestore Query Batching Logic

The `getPendingTransactionsByProgrammeCodes` function in `transactionService.js` employed loop-based batching to comply with Firestore's 30-element `in` clause limit:

```js
// src/services/transactionService.js
export async function getPendingTransactionsByProgrammeCodes(codes) {
  if (!codes || codes.length === 0) return [];
  const results = [];
  for (let i = 0; i < codes.length; i += 30) {
    const chunk = codes.slice(i, i + 30);
    const q = query(
      transactionsRef,
      where("status", "==", "pending"),
      where("programmeCode", "in", chunk)
    );
    const snap = await getDocs(q);
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return results.sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );
}
```

**Table 5.7: White Box Test Cases — Query Batching**

| Test ID | Input | Expected Behaviour |
|---|---|---|
| WB-09 | `codes = []` (empty) | Function returns an empty array immediately; no query executed. |
| WB-10 | `codes` with 10 elements | One batch query executed. |
| WB-11 | `codes` with 30 elements | One batch query executed (exactly at limit). |
| WB-12 | `codes` with 31 elements | Two batch queries executed; results merged. |
| WB-13 | `codes` with 60 elements | Two batch queries executed (30 + 30). |
| WB-14 | `codes` with 61 elements | Three batch queries executed (30 + 30 + 1). |

The batching logic correctly handled all edge cases, ensuring that queries remained compliant with Firestore's operator constraints regardless of the number of programme codes.

---

### 5.4.3 User Acceptance Testing

User acceptance testing (UAT) was conducted to evaluate the system's usability, functional correctness, and suitability for the target users. Participants were selected to represent the primary user categories of the SFMS: Treasurers, Advisors, and System Administrators.

#### 5.4.3.1 Testing Procedure

Each participant was provided with a test account configured for their respective role and a set of guided tasks to complete within the system:

- **Treasurer tasks:** Log in, select a programme on the dashboard, add an income and an expense transaction with a receipt, view the transaction history, and generate a PDF report.
- **Advisor tasks:** Log in, review the pending transactions list, approve one transaction and reject another, and view financial reports.
- **Admin tasks:** Log in, create a new user with an assigned role, and create a new programme with a unique code.

After completing the tasks, participants completed a structured questionnaire using a five-point Likert scale (1 = Strongly Disagree, 5 = Strongly Agree) to rate the system across eight usability and functional dimensions.

#### 5.4.3.2 UAT Questionnaire

**Table 5.8: User Acceptance Testing Questionnaire**

| No. | Statement |
|---|---|
| 1 | The system is easy to navigate and use. |
| 2 | The system accurately records and displays financial transaction data. |
| 3 | The approval workflow (approve/reject transactions) functions correctly. |
| 4 | The PDF report generation produces correct and complete documents. |
| 5 | The system provides clear and helpful error messages when invalid input is entered. |
| 6 | The login and role-based access control function correctly for my role. |
| 7 | The system is suitable for managing student club finances at UTM. |
| 8 | Overall, I am satisfied with the performance of this system. |

#### 5.4.3.3 UAT Participants

UAT was conducted with a total of [N] participants drawn from the target user groups of the SFMS. Table 5.9 summarises the participant composition by role.

**Table 5.9: UAT Participant Breakdown**

| Role | Number of Participants |
|---|---|
| Treasurer (Bendahari) | [n1] |
| Advisor (Penasihat) | [n2] |
| System Administrator (Admin) | [n3] |
| **Total** | **[N]** |

#### 5.4.3.4 UAT Results

The mean score for each questionnaire item was computed by averaging all participant responses on the five-point Likert scale. Table 5.10 presents the results.

**Table 5.10: UAT Results Summary**

| No. | Statement | Mean Score (/ 5.00) |
|---|---|---|
| 1 | Ease of navigation and use | [X.XX] |
| 2 | Accuracy of transaction recording and display | [X.XX] |
| 3 | Correctness of approval workflow | [X.XX] |
| 4 | Quality of PDF report generation | [X.XX] |
| 5 | Clarity of error messages | [X.XX] |
| 6 | Login and access control correctness | [X.XX] |
| 7 | Suitability for UTM student club finance management | [X.XX] |
| 8 | Overall satisfaction | [X.XX] |
| **Overall Mean Score** | | **[X.XX]** |

**[Figure 5.13: Bar Chart — UAT Mean Scores per Questionnaire Item]**

#### 5.4.3.5 UAT Analysis

The overall mean score of [X.XX]/5.00 indicated that the system met user expectations across all evaluated dimensions. The highest-rated dimension was Statement [X] — [statement text] — with a mean score of [X.XX]/5.00, reflecting [brief justification]. The lowest-rated dimension was Statement [X] — [statement text] — with a mean score of [X.XX]/5.00, which suggested [brief justification and proposed improvement]. These findings will be addressed in the system limitations and future works discussion presented in Chapter 6.

---

## 5.5 Chapter Summary

Chapter 5 documented the complete implementation and testing of the Smart Financial Management System (SFMS) for BAPP UTM. Section 5.2 described the development environment and the coding of the system's main functional modules: Firebase backend initialisation; user authentication including login with username support, registration with real-time password strength validation, session persistence, and password recovery; role-based access control enforced at the routing level through the `ProtectedRoute` component; the transaction management module with a dedicated service layer encapsulating all Firestore operations including cascade deletion of receipt files; receipt file handling via Firebase Storage with unique path generation; the dashboard module providing role-specific financial summaries; the financial reporting module supporting nine UTM form templates with client-side PDF generation and digital signature integration; and the user and programme management module for administrative operations using a secondary Firebase Auth instance.

Section 5.3 presented the interface design for ten key screens, supported by annotated screenshots. Section 5.4 documented three testing strategies: black-box testing validated system flow across 13 workflow tests (Table 5.2), input-output correctness across 11 test cases (Table 5.3), and error message accuracy across 8 cases (Table 5.4); white-box testing confirmed complete branch coverage across 14 test cases for validation logic, access control, and Firestore query batching (Tables 5.5 to 5.7); and user acceptance testing evaluated the system with [N] real end users across eight usability and functional dimensions, achieving an overall mean score of [X.XX]/5.00. The results confirmed that the SFMS was functionally complete, correctly enforced role-based access control, and met the requirements identified in earlier chapters.
