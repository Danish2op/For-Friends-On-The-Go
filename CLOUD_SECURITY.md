# Cloud Security Protocols

This project implements a robust "Security by Design" architecture, primarily leveraging Firebase features and strict schema validation.

## 1. Firestore Security Rules
The most significant security protocol is the **`firestore.rules`** file, which contains ~700 lines of fine-grained access control logic.
- **Strict Schema Validation**: Custom functions ensure that only well-formed data can be written.
- **RBAC (Role-Based Access Control)**:
    - **Self-Access**: Users can only modify their own data.
    - **Friend-Locked**: Proximity and lobby data are restricted to mutual friends.
- **Atomic Transitions**: Validates data consistency across documents using `getAfter` for operations like friendship requests.

## 2. Infrastructure & Identity
- **Firebase Authentication**: Cryptographically verified identities for all database interactions.
- **Cloud Functions**: Sensitive backend logic (like push notification dispatching) runs in a trusted server-side environment with admin privileges.
- **Environment Management**: API keys and configuration are managed via `.env.local` and injected at build-time, preventing sensitive data from being hardcoded in the source.

## 3. Road Map
- **App Check**: Deployment of Firebase App Check is planned to further protect against unauthorized non-app clients.
