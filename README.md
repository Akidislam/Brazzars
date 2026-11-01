# Brazzars

Brazzars is a Bangladesh-focused, multi-vendor marketplace project. Its intended marketplace brings customers, independent vendors, and administrators into one web application. The current codebase is an early foundation: it contains a customer-facing landing page, an Express API health check, an opt-in MongoDB connection, and four initial Mongoose models.

> **Project status:** Marketplace transactions, authentication, vendor tools, and admin workflows are planned. They are not implemented in the current application.

## Table of contents

- [Vision and objectives](#vision-and-objectives)
- [Feature status](#feature-status)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Frontend](#frontend)
- [Backend](#backend)
- [Database](#database)
- [Marketplace workflows](#marketplace-workflows)
- [API](#api)
- [Environment configuration](#environment-configuration)
- [Local development](#local-development)
- [Security](#security)
- [Git workflow](#git-workflow)
- [Roadmap and future improvements](#roadmap-and-future-improvements)
- [License](#license)

## Vision and objectives

The product vision is to make it easier for people in Bangladesh to discover and shop from independent businesses through one marketplace. Brazzars is intended to support general merchandise from multiple vendors, with separate customer, vendor, and admin experiences in a single React application.

The planned business rules include a fixed 10% vendor commission, product review before public listing, a hybrid delivery model, Cash on Delivery and a future online payment option, and manually approved vendor payouts in the initial marketplace release.

## Feature status

| Area | Implemented now | Planned |
| --- | --- | --- |
| Customer experience | Responsive landing page and category/marketplace entry sections | Customer account, sign-in, cart, checkout, and order tracking |
| Vendor experience | User, Shop, and Product data models | Vendor registration, shop management, product management, and order fulfillment tools |
| Admin experience | User role values include `admin` | Admin interface, vendor suspension, and product review/moderation tools |
| API | `GET /api/health` and `GET /api/health/db` | Marketplace, account, shop, product, cart, checkout, and order APIs |
| Database | Mongoose connection support and User, Shop, Category, Product models | Cart, Order, VendorOrder, Payment, Review, Address, Commission, Payout, and Notification models |
| Payments and delivery | No payment or delivery integration | Cash on Delivery, an online gateway selected later, and platform-managed or vendor-managed delivery |

The role values and data models provide a foundation; they do not imply that corresponding screens, APIs, or permissions are already available.

## Technology stack

| Layer | Current technology |
| --- | --- |
| Frontend | React 18, Vite, JavaScript, Tailwind CSS |
| Navigation | React Router |
| HTTP client | Axios |
| Backend | Node.js, Express 4 |
| Database access | MongoDB Atlas, Mongoose 8 |
| Configuration | dotenv |
| Cross-origin requests | CORS |
| Password field handling | Node.js built-in scrypt hash in the User model save hook |

JWT-based authentication and bcrypt are part of the product plan, but authentication is not implemented. The current User schema hashes document-save passwords with scrypt; there are no login or registration APIs.

## Architecture

Brazzars is structured as a modular monolith with separate `client/` and `server/` applications in one repository. The React app is intended to host customer, vendor, and admin interfaces as the product grows. The Express server provides the API boundary and uses Mongoose for data access. MongoDB connection is controlled by environment configuration; the server waits for a successful connection when the opt-in flag is enabled.

## Frontend

The frontend currently has one React Router application. Both `/` and the fallback route render the landing page. The Axios client is configured with `VITE_API_BASE_URL` when provided and otherwise uses the local API base URL in its source configuration. No customer, vendor, or admin route guards have been implemented.

Current frontend source tree:

```text
client/
├── .env.example
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── styles.css
    ├── assets/          (empty placeholder)
    ├── components/      (empty placeholder)
    ├── context/         (empty placeholder)
    ├── features/        (empty placeholder)
    ├── hooks/           (empty placeholder)
    ├── layouts/         (empty placeholder)
    ├── pages/
    │   └── HomePage.jsx
    ├── routes/          (empty placeholder)
    └── services/
        └── api.js
```

## Backend

The Express app installs CORS and JSON middleware, mounts health routes, and returns JSON for unknown routes and server errors. dotenv reads `server/.env` when present. `CONNECT_TO_DATABASE` is opt-in: if it is not `true`, the HTTP server starts without a database connection. When it is `true`, startup waits for Mongoose to connect and exits with a sanitized error if connection setup fails.

Current backend source tree:

```text
server/
├── .env.example
├── package.json
├── package-lock.json
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   ├── database.js
    │   └── env.js
    ├── controllers/
    │   └── healthController.js
    ├── middleware/
    │   └── errorHandler.js
    ├── models/
    │   ├── Category.js
    │   ├── Product.js
    │   ├── Shop.js
    │   └── User.js
    ├── routes/
    │   └── healthRoutes.js
    ├── services/        (empty placeholder)
    ├── utils/           (empty placeholder)
    └── validators/      (empty placeholder)
```

## Database

The existing database configuration uses the Mongoose dependency and the `MONGODB_URI` environment variable. It does not define or seed data itself. Mongoose model registration alone does not create collections; collections and indexes are created by MongoDB when model operations require them.

### Implemented models

| Model | Fields and behavior | References and indexes |
| --- | --- | --- |
| `User` | Name, normalized unique email, password hash, phone, role, active flag, timestamps | Email unique; role indexed. Password is excluded from normal queries and hashed by a pre-save hook using scrypt. |
| `Shop` | Shop name, unique slug, description, logo, contact details, address, status, timestamps | `owner` references `User`; owner and status indexed; slug unique. |
| `Category` | Name, unique slug, description, image, active flag, timestamps | Slug unique. |
| `Product` | Name, slug, description, price, compare-at price, stock, images, status, timestamps | `vendor` references `User`, `shop` references `Shop`, and `category` references `Category`; shop/slug is unique together; vendor/status and category/status are indexed. Negative prices and stock are rejected; stock must be a whole number. |

The schemas declare references; they do not enforce that the referenced User has a vendor role, that a Product vendor owns its Shop, or that referenced records are active. No order, payment, or payout collection exists yet.

### Planned models

The product plan includes `Cart`, `Order`, `VendorOrder`, `Payment`, `Review`, `Address`, `Commission`, `Payout`, and `Notification`. These models have not been created.

## Marketplace workflows

The following describe confirmed product decisions, not working application flows.

### Roles and permissions

The User schema accepts `customer`, `vendor`, and `admin` role values. Account registration, authentication, authorization middleware, and role-protected routes are not implemented. The planned experience assigns customers to shopping, vendors to shop/product/order management, and admins to marketplace moderation.

### Product approval

The Product schema supports `pending`, `approved`, `rejected`, and `disabled` statuses, defaulting to `pending`. The planned workflow is for vendors to submit products and admins to approve or reject them before public listing; admins may later disable or remove listings. No approval API or public product listing exists yet.

### Cart, checkout, and vendor orders

Customers are planned to sign in before checkout. A parent checkout/order group is intended to contain separate vendor orders so each vendor can fulfill their own items. Order models, cart operations, checkout, fulfillment, and order tracking are not implemented.

### Commission and payouts

The planned commission is fixed at 10% per vendor sale. Vendor payouts are intended to require manual admin approval initially, with no automated payout system. No commission or payout logic exists in the current code.

### Payment and delivery

Cash on Delivery is the planned initial payment method, with an online gateway to be selected later. Delivery is planned as hybrid: either platform-managed or vendor-managed. No payment provider, delivery integration, live GPS tracking, or native mobile application is included in the initial scope or implemented now.

## API

Only these API endpoints are currently implemented:

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns HTTP 200 JSON indicating the API is running. |
| `GET` | `/api/health/db` | Returns HTTP 200 when Mongoose is connected, otherwise HTTP 503 with the current connection state. |

Other paths return a JSON 404 response. No authentication or marketplace endpoints are available yet.

## Environment configuration

The example files define these variable names:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend | Optional API base URL for Axios. |
| `PORT` | Backend | HTTP server port; source configuration defaults to port 5000 when unset. |
| `CLIENT_ORIGIN` | Backend | CORS origin; source configuration defaults to the Vite development origin when unset. |
| `MONGODB_URI` | Backend | MongoDB connection string. Provide your own Atlas URI privately. |
| `CONNECT_TO_DATABASE` | Backend | Enables the startup database connection only when set to `true`. |

To configure a local machine, copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`, then edit the local files as needed. Replace the MongoDB URI placeholder with your own Atlas connection string and opt in to the database connection by setting `CONNECT_TO_DATABASE` to `true`. Keep all `.env` files private; do not paste credentials into source files or commit them. The checked-in example files contain placeholders, not working credentials.

## Local development

### Requirements

- Node.js 20 or newer
- npm
- A MongoDB Atlas connection string only if you choose to enable the database connection

### Install dependencies

The repository has separate frontend and backend packages:

```bash
cd client
npm install

cd ../server
npm install
```

### Run the frontend

From the repository root:

```bash
npm run dev:client
```

Or from `client/`:

```bash
npm run dev
```

Vite uses port 5173 and requires that port to be available. To create the frontend production build, run `npm run build:client` from the root or `npm run build` from `client/`. To preview a completed build, run `npm run preview` from `client/`.

### Run the backend

From the repository root:

```bash
npm run dev:server
```

Or from `server/`:

```bash
npm run dev
```

For a non-watch start, run `npm run start:server` from the root or `npm start` from `server/`. With database connection disabled, the API starts without Atlas. With `CONNECT_TO_DATABASE=true`, it waits for the configured MongoDB connection before listening.

### Health checks

After starting the backend, visit:

- `http://localhost:5000/api/health`
- `http://localhost:5000/api/health/db`

The database health endpoint returns HTTP 503 while Mongoose is disconnected; this is expected when the optional database connection is disabled.

## Security

- Keep `.env` and `.env.*` local; `.gitignore` excludes them while allowing `.env.example` files to be committed.
- Never put Atlas credentials, passwords, access tokens, or private keys in README files, source code, screenshots, or commits.
- The database connection error handling avoids logging the MongoDB URI.
- The User model hashes passwords on document saves and excludes the password field from normal queries. Authentication and password verification endpoints are not implemented.
- Do not expose admin controls or rely on client-side role checks as authorization; server-side authorization must be implemented before protected operations are added.

## Git workflow

The intended shared branch is `main`. For a contributor working from the GitHub repository:

```bash
git clone https://github.com/Akidislam/Brazzars.git
cd Brazzars
git checkout -b feature/short-description
# Make and review changes
git status --short
git add <reviewed-files>
git diff --cached
git commit -m "type: describe the change"
git push -u origin feature/short-description
```

Before staging, review `git status` and confirm no environment files or credentials are included. Keep `.env.example` files, which contain placeholders, in version control.

## Roadmap and future improvements

1. Add server-side request validation and structured logging.
2. Implement registration and login, password verification, JWT handling, and role-based authorization.
3. Add admin workflows for vendor approval/suspension and product moderation.
4. Build customer, vendor, and admin route groups and interfaces.
5. Add product/category discovery, cart, checkout, parent orders, and per-vendor orders.
6. Implement Cash on Delivery, select and integrate an online payment provider, and define payment state handling.
7. Add platform/vendor delivery assignment and order status tracking.
8. Add commission records and manual payout review.
9. Add reviews, notifications, and operational reporting.
10. Add automated tests, deployment configuration, monitoring, and backups.

These are future steps; they are not claims about current functionality.

## License

No license has been selected yet. All rights remain with the project owner unless a license is added.
