# World Cup Goal Codes Implementation Plan

## Overview

This plan updates the project architecture to use **Firebase Firestore** for data storage and **Firebase Auth** for authentication instead of the originally proposed Supabase services.

The application still targets deployment on **Vercel** for the World Cup Day Finale and must support:

- a public page that shows goal-triggered coupon codes in real time
- overlapping active coupon codes, each valid for 2 minutes
- an admin experience for generating and publishing codes
- persistent code history for in-store validation by staff
- secure authentication and permission-based access control

## Target Stack

- **Frontend:** Next.js (TypeScript, App Router), Tailwind CSS
- **Hosting:** Vercel
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth
- **Server-side access:** Firebase Admin SDK from Next.js server routes / server actions
- **Testing:** Firebase Emulator Suite, Playwright, integration API tests
- **Optional background processing:** Cloud Functions / Cloud Scheduler for cleanup or derived state updates

## Architecture

```text
Public Visitors
    |
    v
Next.js Public UI on Vercel
    |
    | read active coupon feed
    v
Firestore

Admin / Staff Users
    |
    v
Firebase Auth (email/password, social login providers)
    |
    v
Next.js Admin UI on Vercel
    |
    | verified ID token / session cookie
    v
Next.js API Routes / Server Actions
    |
    v
Firebase Admin SDK
    |
    +--> Firestore coupon writes / reads
    +--> Auth user verification / role checks
```

## Service Dependencies

- **Next.js app**
  - renders the public goal page
  - renders the admin dashboard
  - exposes secured admin APIs for coupon creation and history lookups
- **Firebase Firestore**
  - stores coupon codes and audit metadata
  - stores user profile / role metadata if needed
- **Firebase Auth**
  - handles registration, login, provider federation, and session lifecycle
  - supports admin and staff access controls
- **Firebase Admin SDK**
  - verifies Firebase Auth session cookies or ID tokens on the server
  - performs trusted Firestore writes for coupon generation workflows
- **Firebase Emulator Suite**
  - runs local integration tests for Auth and Firestore
- **Vercel**
  - hosts the production Next.js application
  - stores Firebase environment variables and service-account credentials

## Firestore Data Model

### Collection: `couponCodes`

Each document represents one generated coupon code.

```ts
interface CouponCodeDocument {
  code: string; // 5-char uppercase alphanumeric
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + 2 minutes
  createdByUid: string;
  createdByEmail: string | null;
  createdByProvider: string | null;
  status: "active" | "expired" | "revoked";
  eventKey: string; // e.g. world-cup-day-finale-2026
}
```

### Collection: `users`

This collection mirrors authenticated users that need permissions inside the admin area.

```ts
interface UserDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "admin" | "staff";
  providers: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  disabled: boolean;
}
```

### Optional Collection: `auditLogs`

This collection is recommended for operational traceability.

```ts
interface AuditLogDocument {
  action: "coupon_created" | "user_role_changed" | "coupon_revoked";
  actorUid: string;
  actorEmail: string | null;
  createdAt: Timestamp;
  targetId: string;
  details: Record<string, unknown>;
}
```

## Firestore Query Strategy

- **Public page**
  - query coupons where `status == "active"`
  - sort by `createdAt desc`
  - client hides any entries that have crossed `expiresAt`
  - optional scheduled process can mark stale coupons as `expired`
- **Admin dashboard**
  - query recent coupons sorted by `createdAt desc`
  - show active and expired history for staff verification
- **Verification workflow**
  - staff searches recent coupons or enters a code
  - system returns whether the code exists and whether it was valid during the event

## Authentication Plan

Firebase Auth replaces the earlier Supabase Auth design.

### Supported Authentication Methods

- **Email / password**
  - required baseline for internal admin and staff accounts
- **Google**
  - recommended first social login provider for operators
- **Additional social providers**
  - Apple
  - GitHub
  - Facebook
  - Microsoft

Provider activation depends on business preference, but the implementation plan must leave room for all enabled Firebase Auth providers required by the business.

### Session Strategy

- Use Firebase client SDK for sign-in flows
- Exchange the Firebase ID token for a secure **HTTP-only session cookie**
- Verify the session cookie on Next.js server routes with the Firebase Admin SDK
- Protect `/admin` routes and coupon-management APIs through server-side role checks

### Authorization Model

- `admin`
  - can generate coupon codes
  - can read coupon history
  - can manage staff access if needed later
- `staff`
  - can read coupon history for in-store validation
  - cannot generate or revoke codes unless explicitly granted
- public visitors
  - no authentication required
  - can read only public coupon data

## Security Rules Plan

Firestore rules must enforce the same access model even when clients access Firestore directly.

### Required Rule Goals

- public users can read only active coupon data intended for public display
- authenticated staff can read coupon history needed for validation
- only authenticated admins can create, modify, or revoke coupon documents
- user profile documents are readable and writable only according to role-based constraints

### Example Rule Shape

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /couponCodes/{couponId} {
      allow read: if resource.data.status == "active"
        || isStaffOrAdmin();
      allow create, update, delete: if isAdmin();
    }

    match /users/{userId} {
      allow read: if request.auth != null
        && (request.auth.uid == userId || isAdmin());
      allow write: if isAdmin();
    }
  }
}
```

Server-side writes through the Admin SDK still require role checks in application code because Admin SDK bypasses Firestore rules.

## Integration Workflows

### Public Coupon Display

1. Visitor opens `/`
2. Next.js fetches active coupon documents from Firestore
3. UI displays all non-expired codes, newest first
4. Client refreshes periodically or subscribes through a push/update mechanism
5. Each card shows a countdown based on `expiresAt`

### Admin Login

1. Admin opens `/admin`
2. Firebase Auth handles login via email/password or enabled social provider
3. Client receives Firebase ID token
4. Next.js backend exchanges token for secure session cookie
5. Server verifies cookie and resolves the user role
6. Admin dashboard becomes available only if role is authorized

### Coupon Generation

1. Admin clicks `Generate live coupon`
2. Next.js server verifies session and admin role
3. Server generates a unique 5-character alphanumeric code
4. Server writes a `couponCodes` document to Firestore with `createdAt`, `expiresAt`, and actor metadata
5. Public page refresh logic exposes the newly active code

### Staff Validation

1. Staff logs in with Firebase Auth
2. Staff opens the recent coupon history view
3. Staff verifies the code shown by the customer
4. Staff confirms that only one valid code can be redeemed in person

## Resource Provisioning Steps

### Firebase Project Setup

1. Create a Firebase project for the event
2. Enable **Firestore** in Native Mode
3. Choose the production region closest to the expected audience
4. Enable **Firebase Auth**
5. Configure email/password auth
6. Configure required social login providers
7. Register web app credentials for the Next.js frontend
8. Generate a Firebase service account for server-side access
9. Create Firestore indexes required by coupon queries
10. Publish Firestore security rules

### Vercel Setup

1. Create or connect the Vercel project
2. Add public Firebase web env vars
3. Add Firebase Admin SDK credentials
4. Configure production, preview, and local-development env scopes
5. Deploy the Next.js app

## Environment Configuration

### Client-side Firebase variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Server-side Firebase Admin variables

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Alternative:

- `FIREBASE_SERVICE_ACCOUNT_JSON` as a single JSON payload if preferred for deployment tooling

### Session / app variables

- `FIREBASE_SESSION_COOKIE_NAME`
- `GOAL_CODE_TTL_SECONDS=120`
- `EVENT_KEY=world-cup-day-finale-2026`

## Development Task Breakdown

### Phase 1: Firebase Foundation

- create Firebase project and app registrations
- install Firebase client SDK and Firebase Admin SDK
- initialize Firebase client utilities and admin utilities
- configure local development through Firebase Emulator Suite

### Phase 2: Firestore Modeling

- implement Firestore collections for `couponCodes`, `users`, and optional `auditLogs`
- define document converters / TypeScript interfaces
- create required compound indexes for active and historical coupon queries
- add code generation logic with uniqueness safeguards

### Phase 3: Firebase Auth

- implement email/password sign-up and login
- configure social login providers needed by the business
- add session-cookie creation and verification on the server
- map authenticated users into application roles
- create staff/admin onboarding flow

### Phase 4: Access Control

- write Firestore security rules
- enforce role checks in Next.js server handlers
- restrict coupon publishing to admins
- restrict coupon history access to staff and admins

### Phase 5: Feature Integration

- connect admin dashboard actions to Firestore writes
- connect public coupon board reads to Firestore queries
- support overlapping active codes with independent expiration timers
- surface clear error messages for auth and data failures

### Phase 6: Testing

- add integration tests using Firebase Emulator Suite
- add end-to-end auth and admin workflow coverage
- verify failure behavior for invalid permissions and expired sessions

### Phase 7: Deployment

- configure Vercel env vars for Firebase client and admin credentials
- deploy preview and production environments
- validate auth providers and Firestore reads/writes in hosted environments

## Integration Testing Requirements

Testing must explicitly validate both Firestore and Firebase Auth behaviors.

### Auth workflow coverage

- user registration succeeds with email/password
- login succeeds with email/password
- supported social-provider login flows are exercised in the test plan
- invalid credentials are rejected with correct error handling
- expired or invalid session cookies are rejected on protected routes

### Authorization coverage

- public users cannot access admin-only data
- staff users can read coupon history but cannot create coupon codes
- admin users can create coupon codes successfully
- users without proper roles are blocked from privileged operations

### Firestore data coverage

- coupon creation persists the expected fields
- generated documents contain the correct 2-minute TTL window
- active coupon queries return overlapping live codes in the correct order
- historical queries return recently generated codes for verification use
- duplicate-code collision handling is tested

### Error-handling coverage

- Firestore write failures surface actionable admin errors
- auth provider failures surface actionable login errors
- missing Firebase configuration fails fast with clear diagnostics
- permission-denied responses are logged and handled cleanly

## Deployment Validation Checklist

- Firebase Auth providers are enabled in production
- Firestore rules are deployed and verified
- required indexes are created
- Vercel environment variables are populated
- Firebase Admin credentials are valid in server runtime
- public coupon page loads without authentication
- admin login, coupon publish, and coupon history workflows succeed end-to-end

## Documentation Updates Required

All planning and setup documentation should reference **Firebase Firestore** and **Firebase Auth** instead of Supabase.

Update references in:

- implementation plan
- architecture diagrams
- dependency lists
- setup instructions
- environment-variable documentation
- test plans
- deployment runbooks

## Notes On Current Repository State

This document updates the **implementation plan** only. If the repository still contains Supabase-based code or references, those should be treated as migration work items until the Firebase implementation replaces them fully.
