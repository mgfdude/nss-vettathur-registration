# NSS Vettathur Registration & Selection Portal Documentary

## 1. Project Overview

The NSS Vettathur Registration & Selection Portal is a web application for managing student registration, NSS application submission, document uploads, administrative review, and selection result publishing.

The system is built as a simple full-stack Node.js application:

- Frontend: Static HTML, CSS, and browser JavaScript in `client/`
- Backend: Express.js API server in `server/`
- Database: SQLite in development, managed through Knex migrations and seeds in `database/`
- File storage: Uploaded student files stored locally in `uploads/`

The portal supports two main user groups:

- Students, who register, receive an application ID, complete an application form, upload documents, and track status.
- Admins, who review applications, update statuses, manage interview marks, configure portal settings, and publish selection results.

## 2. Business Purpose

The project digitizes the NSS volunteer registration and selection process. Instead of collecting paper forms and manually tracking applications, the portal provides:

- OTP-based student registration
- Unique NSS application ID generation
- Online application drafting and submission
- Photo, signature, and document upload
- Student dashboard with notifications
- Admin dashboard for review and selection
- Selection-result visibility control
- Email notifications for registration, password reset, and selection

## 3. High-Level Architecture

```text
Browser
  |
  | Static pages and fetch API calls
  v
Express Server
  |
  | Routes:
  | /api/auth
  | /api/student
  | /api/admin
  | /api/uploads/:filename
  v
Controllers and Middleware
  |
  | Knex queries
  v
SQLite Database

Uploaded files are stored in the local uploads/ directory.
```

The Express app serves both the frontend and backend:

- Static frontend files are served from `client/`.
- API endpoints are exposed under `/api`.
- Uploaded files are served through a protected endpoint, not as public static assets.

## 4. Main Folder Structure

```text
Portal/
  client/
    index.html
    register.html
    dashboard.html
    admin.html
    css/
      styles.css
    js/
      api.js
      auth.js
      dashboard.js
      admin.js

  server/
    src/
      app.js
      routes/
      controllers/
      middlewares/
      utils/
    email_templates/
    config.js
    knexfile.js
    package.json

  database/
    connection.js
    migrations/
    seeds/

  uploads/
```

## 5. Technology Stack

Backend:

- Node.js
- Express.js
- Knex.js
- SQLite3 for development
- PostgreSQL-ready production configuration
- JWT for authentication
- bcryptjs for password hashing
- multer for uploads
- nodemailer for email delivery
- cookie-parser and CORS middleware

Frontend:

- Plain HTML
- Plain CSS
- Plain JavaScript
- Fetch API
- Local storage for client-side token/user details

Database:

- SQLite development database: `database/nss_portal.sqlite`
- Knex migrations and seeds

## 6. Application Roles

### Student

A student can:

- Register with email, phone number, and date of birth
- Verify registration through OTP
- Receive a generated application ID such as `NSS26-0001`
- Log in using application ID and password
- Fill and autosave the application form
- Upload photo, signature, and optional supporting documents
- Submit the application
- View application status and notifications
- View selection result when admin enables result publishing

### Admin / Superadmin

An admin can:

- Log in using seeded credentials
- View all applications
- Search and filter applications
- Review individual applications
- View uploaded student files
- Enter interview marks
- Add admin remarks
- Update application status
- Manage portal settings
- Export application data as CSV from the browser

The seed creates a default admin:

```text
Application ID: NSS-ADMIN
Password: Password@123
Email: admin@nssvettathur.org
```

## 7. Student Workflow

### Step 1: Registration Details

The student opens `register.html` and enters:

- Email and confirmation email
- Phone and confirmation phone
- Date of birth and confirmation date of birth

The frontend checks whether repeated fields match before moving to the OTP step.

### Step 2: OTP Verification

When the student requests an OTP:

1. The backend validates registration settings.
2. It checks whether registration is open.
3. It checks the deadline.
4. It checks the maximum applicant count.
5. It rejects duplicate email or phone.
6. It creates a hashed OTP record.
7. It sends the OTP email.

The OTP expires after 10 minutes and allows up to 3 incorrect attempts.

### Step 3: Account Creation

After OTP verification:

1. The system generates a unique app ID in the format `NSSYY-0001`.
2. The password is hashed with bcrypt.
3. A user account is created with role `student`.
4. A draft application is created.
5. Used OTP records are deleted.
6. A welcome email is sent.

### Step 4: Application Form

After login, students use `dashboard.html` to complete the application. The form is divided into:

- Personal information
- Academic information
- Contact information
- Volunteer profile
- Uploads

The frontend autosaves form changes to:

```text
PATCH /api/student/application
```

Uploaded files go to:

```text
POST /api/student/application/upload
POST /api/student/application/upload-sig
POST /api/student/application/upload-docs
```

### Step 5: Submission

The student submits through:

```text
POST /api/student/application/submit
```

After submission:

- Status changes from `Draft` to `Submitted`.
- The form becomes locked.
- A notification is created.
- Further edits and uploads are blocked.

## 8. Admin Workflow

Admins use `admin.html`.

### Dashboard and Statistics

The admin dashboard loads:

```text
GET /api/admin/stats
GET /api/admin/applications
```

It displays:

- Total registered students
- Submitted applications
- Selected students
- Waitlisted students

### Application Review

Admins can open an application drawer and review:

- Application ID
- Name
- Email and phone
- Date of birth
- Class and roll number
- Guardian details
- Skills, interests, volunteering experience, and NSS essay
- Uploaded photo, signature, and documents

Admins can update:

- Status
- Interview marks
- Admin remarks

Supported statuses include:

- Draft
- Submitted
- Under Review
- Interview Scheduled
- Selected
- Rejected
- Waitlisted

When status changes, a notification is created for the student. If the status becomes `Selected`, the system attempts to send a selection email.

### Portal Settings

Admins can update:

- `registration_open`
- `registration_deadline`
- `max_applicants`
- `selection_open`

These settings control whether registration is available and whether students can see final selection results.

## 9. API Summary

### Authentication Routes

Base path:

```text
/api/auth
```

Routes:

```text
POST /register/initiate
POST /register/verify
POST /login
POST /forgot-password/initiate
POST /forgot-password/reset
POST /logout
```

### Student Routes

Base path:

```text
/api/student
```

All student routes require authentication and the `student` role.

Routes:

```text
GET   /dashboard
GET   /application
PATCH /application
POST  /application/submit
POST  /application/upload
POST  /application/upload-sig
POST  /application/upload-docs
```

### Admin Routes

Base path:

```text
/api/admin
```

All admin routes require authentication and either the `admin` or `superadmin` role.

Routes:

```text
GET   /applications
GET   /applications/:id
PATCH /applications/:id
GET   /stats
GET   /settings
PATCH /settings
```

### Upload Access

Uploaded files are accessed through:

```text
GET /api/uploads/:filename
```

Access rules:

- Admins and superadmins can access all uploads.
- Students can access only their own uploaded files.

## 10. Database Model

### `users`

Stores login accounts.

Important columns:

- `id`
- `app_id`
- `email`
- `phone`
- `password_hash`
- `role`
- `is_email_verified`
- `last_login`
- `is_active`
- `failed_login_attempts`
- `locked_until`

### `applications`

Stores student application details.

Important columns:

- `user_id`
- `status`
- Personal fields such as `full_name`, `father_name`, `mother_name`, `dob`, `age`, `blood_group`, `aadhaar_number`
- Contact and address fields
- Academic fields
- Emergency contact fields
- Volunteer profile fields
- Upload path fields
- Admin review fields
- `submitted_at`

### `otp_codes`

Stores OTP records.

Important columns:

- `email`
- `phone`
- `code_hash`
- `type`
- `payload`
- `expires_at`
- `attempts`

### `settings`

Stores configurable portal settings.

Seeded settings:

- `registration_open`
- `registration_deadline`
- `selection_open`
- `max_applicants`

### `notifications`

Stores student-facing notifications.

Important columns:

- `user_id`
- `title`
- `message`
- `is_read`

## 11. Authentication and Security

The system uses JWT tokens. Tokens are:

- Returned in the login response
- Stored in browser local storage by the frontend
- Also set as an HTTP-only cookie by the backend

Protected routes use `authenticateToken`, which accepts:

- `Authorization: Bearer <token>`
- Or the `token` cookie

Security-related behavior:

- Passwords are hashed with bcrypt.
- OTP codes are hashed with SHA-256 before storage.
- OTPs expire after 10 minutes.
- OTP attempts are capped.
- Login failures lock an account after 5 failed attempts for 15 minutes.
- Uploads are protected by authentication and ownership checks.
- Upload file size is limited to 2MB.
- Upload extensions are limited to `.png`, `.jpg`, `.jpeg`, and `.pdf`.

## 12. Email System

Email delivery is handled through nodemailer.

Templates live in:

```text
server/email_templates/
```

Templates include:

- `otp.html`
- `forgot-password.html`
- `welcome.html`
- `selected.html`

In development, if SMTP settings are not provided, the app attempts to create an Ethereal test account and logs preview URLs.

Environment variables for email:

```text
EMAIL_HOST
EMAIL_PORT
EMAIL_SECURE
EMAIL_USER
EMAIL_PASS
```

## 13. Setup and Running

Install server dependencies:

```bash
cd server
npm install
```

Run database migrations:

```bash
npm run migrate:latest
```

Seed initial settings and admin account:

```bash
npm run seed:run
```

Start the server:

```bash
npm start
```

For development with watch mode:

```bash
npm run dev
```

Open the portal:

```text
http://localhost:3000
```

## 14. Environment Configuration

The app reads configuration from environment variables through `dotenv`.

Recommended `.env` values:

```text
PORT=3000
NODE_ENV=development
JWT_SECRET=replace_with_a_long_random_secret
SESSION_SECRET=replace_with_a_long_random_secret

EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email_user
EMAIL_PASS=your_email_password
```

In production, set:

```text
NODE_ENV=production
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=strong_production_secret
```

## 15. Current-State Observations

The project is functional in structure, but there are some important implementation mismatches and risks to address before production use.

### Application Form Save Mismatch

The frontend application form contains fields such as:

- `full_name`
- `father_name`
- `mother_name`
- `age`
- `blood_group`
- `aadhaar_number`
- `phone_number`
- `whatsapp_number`
- `guardian_mobile`
- `house_name`
- `place`
- `pin_code`
- `district`

However, the backend `saveApplicationDraft` currently only allows these fields:

- `first_name`
- `last_name`
- `class_name`
- `roll_number`
- `guardian_name`
- `guardian_phone`
- `emergency_phone`
- `skills`
- `interests`
- `volunteer_exp`
- `essay_why_nss`

This means many visible frontend fields may not actually save to the database.

### Submission Required Fields Mismatch

The backend requires `first_name` and `last_name` before submission, but the current visible form uses `full_name` instead. Unless `first_name` and `last_name` are populated elsewhere, submission may fail.

### Aadhaar Storage

The database includes `aadhaar_number`, and the frontend collects Aadhaar. For a real deployment, sensitive identity fields should be handled carefully, ideally encrypted or avoided unless legally required.

### Default Secrets

`JWT_SECRET` and `SESSION_SECRET` have development fallback values. Production deployments must set secure environment variables.

### Client Token Storage

The frontend stores JWT tokens in local storage. This is convenient but increases exposure if an XSS issue occurs. The backend also supports HTTP-only cookies, so a cookie-first approach would be safer.

### Rate Limiter Memory Storage

OTP rate limiting is implemented with an in-memory `Map`. It resets when the server restarts and will not coordinate across multiple server instances.

### Upload Validation

Upload validation checks file extensions, but not MIME content or actual file signatures. Stronger validation is recommended for production.

### Production Database

Production is configured for PostgreSQL, but deployment-specific migration, connection, SSL, and backup handling still need to be finalized.

## 16. Recommended Next Improvements

Highest priority:

1. Align frontend form fields with backend draft-save fields.
2. Fix submission validation to match the actual form.
3. Add server-side validation for all application fields.
4. Use secure secrets from `.env`.
5. Strengthen upload MIME validation.

Medium priority:

1. Add pagination controls to the admin UI.
2. Add notification read/unread handling.
3. Add audit logs for admin decisions.
4. Add CSV export from the backend for consistent, permission-controlled exports.
5. Improve production deployment documentation.

Long-term:

1. Add automated tests for registration, login, submission, and admin review.
2. Add role management for superadmins.
3. Move OTP rate limiting to Redis or another shared store.
4. Add structured logging.
5. Add backup and restore procedures for the database and uploads.

## 17. Summary

This portal is a focused NSS admission and selection management system. It already has the essential pieces: registration, OTP verification, student dashboards, application uploads, admin review, status updates, notifications, and configurable portal settings.

The main work before real-world deployment is not architectural; it is alignment and hardening. The frontend and backend application fields should be synchronized, validation should be strengthened, and production secrets, upload security, and database deployment should be finalized.
