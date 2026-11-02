# Brazzars

Brazzars is a Bangladesh-focused, multi-vendor marketplace project. Its intended marketplace brings customers, independent vendors, and administrators into one web application. The current codebase includes a customer-facing landing page, an Express API with health, authentication, product, category, and shop discovery endpoints, an opt-in MongoDB connection, and four Mongoose models.

> **Project status:** Customer and vendor registration, login, JWT authentication, current-user endpoint, vendor product APIs, product review APIs, and public marketplace discovery endpoints are implemented. Marketplace transactions and management dashboards remain planned.

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
| Customer experience | Responsive landing page; customer registration and login UI; protected account placeholder; current-user API | Cart, checkout, and order tracking |
| Vendor experience | Vendor registration UI; shared login; protected seller dashboard placeholder; product management API | Shop management UI and order fulfillment tools |
| Admin experience | Protected admin dashboard placeholder; pending product review API; user role values include `admin` | Vendor suspension, product moderation UI, and no public admin registration |
| API | Health, authentication, vendor product management, admin product review, category/shop discovery, and public product search APIs below | Cart, checkout, and order APIs |
| Database | Mongoose connection support and User, Shop, Category, Product models, including review, active, and soft-delete fields | Cart, Order, VendorOrder, Payment, Review, Address, Commission, Payout, and Notification models |
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
| Password field handling | Node.js built-in scrypt hash in the User model save hook and scrypt password verification |
| Access tokens | `jsonwebtoken` with HS256 signature and one-hour expiration |

The existing scrypt password format is retained for both hashing and verification. Passwords are not rehashed with bcrypt. JWT-based login and registration are implemented; refresh tokens and logout/revocation are not.

## Architecture

Brazzars is structured as a modular monolith with separate `client/` and `server/` applications in one repository. The React app is intended to host customer, vendor, and admin interfaces as the product grows. The Express server provides the API boundary and uses Mongoose for data access. MongoDB connection is controlled by environment configuration; the server waits for a successful connection when the opt-in flag is enabled. Authentication is implemented as an Express route module, service layer, JWT middleware, and role authorization middleware.

## Frontend

The frontend is one React Router application. It includes customer registration and shared login pages, vendor shop registration, and protected customer, vendor, and admin dashboard placeholders. `AuthContext` restores sessions through `/api/auth/me`; route guards use the backend-returned role. The Axios client attaches the access token and clears an expired session after an authenticated 401 response. The base URL uses `VITE_API_BASE_URL` when provided and otherwise uses the local API base URL in its source configuration.

Authentication pages are available at `/login`, `/register`, `/vendor/login`, and `/vendor/register`. Protected placeholders are `/account`, `/vendor/dashboard`, and `/admin/dashboard`. These dashboard pages are starting points and do not provide marketplace management features.

The frontend keeps the access token in `sessionStorage`, so the session ends with the browser tab. JavaScript running on the page can access this storage; this is a known security tradeoff. The frontend does not treat a stored role as authoritative and validates an existing token through the backend.

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
    ├── components/
    │   └── auth/        (shared form fields and notices)
    ├── context/
    │   └── AuthContext.jsx
    ├── features/        (empty placeholder)
    ├── hooks/           (empty placeholder)
    ├── layouts/
    │   └── AuthLayout.jsx
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── HomePage.jsx
    │   ├── LoginPage.jsx
    │   └── RegisterPage.jsx
    ├── routes/
    │   └── ProtectedRoute.jsx
    └── services/
        ├── api.js
        ├── authErrors.js
        └── authStorage.js
```

The frontend auth flow is covered by Vitest and React Testing Library tests in `src/__tests__/`.

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
    │   ├── authController.js
    │   ├── discoveryController.js
    │   ├── healthController.js
    │   └── productController.js
    ├── middleware/
    │   ├── authenticate.js
    │   ├── authorizeRoles.js
    │   └── errorHandler.js
    ├── models/
    │   ├── Category.js
    │   ├── Product.js
    │   ├── Shop.js
    │   └── User.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── adminProductRoutes.js
    │   ├── categoryRoutes.js
    │   ├── healthRoutes.js
    │   ├── publicProductRoutes.js
    │   ├── shopRoutes.js
    │   └── vendorProductRoutes.js
    ├── services/
    │   ├── authService.js
    │   ├── discoveryService.js
    │   ├── passwordService.js
    │   ├── productService.js
    │   └── tokenService.js
    ├── test/
    │   ├── auth.test.js
    │   ├── discovery.test.js
    │   └── product.test.js
    ├── utils/
    │   ├── httpError.js
    │   └── safeUser.js
    └── validators/
        ├── discoveryValidator.js
        └── productValidator.js
```

## Database

The existing database configuration uses the Mongoose dependency and the `MONGODB_URI` environment variable. It does not define or seed data itself. Mongoose model registration alone does not create collections; collections and indexes are created by MongoDB when model operations require them.

### Implemented models

| Model | Fields and behavior | References and indexes |
| --- | --- | --- |
| `User` | Name, normalized unique email, password hash, phone, role, active flag, timestamps | Email unique; role indexed. Password is excluded from normal queries and hashed by a pre-save hook using scrypt. |
| `Shop` | Shop name, unique slug, description, logo, contact details, address, approval status, active flag, timestamps | `owner` references `User`; owner/status/active fields indexed; slug unique. Existing shops without `isActive` are treated as active when approved. |
| `Category` | Name, unique slug, description, image, active flag, timestamps | Slug and active state indexed. |
| `Product` | Name, shop-scoped slug, description, price, compare-at price, stock, image URLs, review status, active flag, soft-delete date, reviewer, review time, rejection reason, timestamps | `vendor` references `User`, `shop` references `Shop`, `category` references `Category`, and `reviewedBy` references `User`; shop/slug is unique together; vendor/status, category/status, and public visibility fields are indexed. Price must be greater than zero; stock must be a non-negative whole number. |

Vendor product APIs assign the authenticated vendor and their Shop on the server and check active categories. Product removal is a soft delete using `isActive=false` and `deletedAt`; existing records are not permanently removed. Public shop discovery requires `status=approved` and treats an absent `isActive` field on a legacy Shop as active. Public product APIs additionally require the referenced Shop to satisfy that same rule. Shop directory responses expose only city, district, and country from the address, never owner or shop contact details. The schemas declare references; they do not independently enforce that a referenced User has a vendor role or that a Product vendor owns its Shop. No order, payment, or payout collection exists yet.

### Planned models

The product plan includes `Cart`, `Order`, `VendorOrder`, `Payment`, `Review`, `Address`, `Commission`, `Payout`, and `Notification`. These models have not been created.

## Marketplace workflows

The following describe confirmed product decisions, not working application flows.

### Roles and permissions

The User schema accepts `customer`, `vendor`, and `admin` role values. Registration only creates customers or vendors; there is no public admin registration endpoint. The authentication middleware verifies a signed bearer token, reloads the user, rejects missing or inactive users, and attaches a safe profile. Authorization middleware checks the role loaded from MongoDB rather than a client-supplied role. Vendor product routes require `vendor`; product review routes require `admin`. Other vendor/admin management APIs and dashboard operations remain planned.

### Product approval

The Product schema supports `pending`, `approved`, `rejected`, and `disabled` statuses, defaulting to `pending`. Vendors create products in `pending`; only admins can approve or reject pending products. Approval records `reviewedBy` and `reviewedAt`; rejection may also store a reason. Significant vendor edits to name, description, price, compare-at price, category, or images return the product to `pending` and clear prior review data. Stock-only edits retain approval. Deleted products are soft-deleted and excluded from vendor management and public listing. Public discovery returns only approved, active, non-deleted products from approved, active shops. Missing active/delete fields on legacy documents are treated as active/not deleted unless explicitly marked otherwise.

### Cart, checkout, and vendor orders

Customers are planned to sign in before checkout. A parent checkout/order group is intended to contain separate vendor orders so each vendor can fulfill their own items. Order models, cart operations, checkout, fulfillment, and order tracking are not implemented.

### Commission and payouts

The planned commission is fixed at 10% per vendor sale. Vendor payouts are intended to require manual admin approval initially, with no automated payout system. No commission or payout logic exists in the current code.

### Payment and delivery

Cash on Delivery is the planned initial payment method, with an online gateway to be selected later. Delivery is planned as hybrid: either platform-managed or vendor-managed. No payment provider, delivery integration, live GPS tracking, or native mobile application is included in the initial scope or implemented now.

## API

These API endpoints are currently implemented:

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns HTTP 200 JSON indicating the API is running. |
| `GET` | `/api/health/db` | Returns HTTP 200 when Mongoose is connected, otherwise HTTP 503 with the current connection state. |
| `POST` | `/api/auth/register` | Creates a customer account only and returns a safe user profile plus a JWT. A supplied role is not used. |
| `POST` | `/api/auth/register/vendor` | Creates a vendor account and pending shop; uses a database transaction when available and cleanup fallback when transactions are unsupported. |
| `POST` | `/api/auth/login` | Verifies email and password and returns a safe profile plus a JWT; invalid credentials use a generic response. |
| `GET` | `/api/auth/me` | Requires a bearer JWT and returns the current user's safe profile. |
| `POST` | `/api/vendor/products` | Vendor only; creates an owned product in pending review. |
| `GET` | `/api/vendor/products` | Vendor only; lists only the current vendor's non-deleted products with pagination and filters. |
| `GET` | `/api/vendor/products/:id` | Vendor only; returns an owned product or 404. |
| `PATCH` | `/api/vendor/products/:id` | Vendor only; updates allowed product fields; significant changes reset review to pending. |
| `DELETE` | `/api/vendor/products/:id` | Vendor only; soft-deletes an owned product. |
| `GET` | `/api/admin/products/pending` | Admin only; lists active, non-deleted products awaiting review. |
| `PATCH` | `/api/admin/products/:id/approve` | Admin only; approves a pending product and records reviewer/time. |
| `PATCH` | `/api/admin/products/:id/reject` | Admin only; rejects a pending product with an optional reason. |
| `GET` | `/api/products` | Public; lists only approved, active, non-deleted products. |
| `GET` | `/api/products/:slug` | Public; returns one publicly visible product by slug or 404. |
| `GET` | `/api/categories` | Public; lists active categories with pagination and name search. |
| `GET` | `/api/categories/:slug` | Public; returns one active category or 404. |
| `GET` | `/api/categories/:slug/products` | Public; lists public products in an active category. |
| `GET` | `/api/shops` | Public; lists approved and active shops with pagination and name search. |
| `GET` | `/api/shops/:slug` | Public; returns one approved and active shop or 404. |
| `GET` | `/api/shops/:slug/products` | Public; lists public products from an approved and active shop. |

JWTs are signed with HS256 and expire after one hour. Protected product routes reuse the database-backed `authenticate` and `authorizeRoles` middleware. Vendors can only access products whose stored owner matches their authenticated user ID; admins alone can review products. Discovery routes are public and return only selected public fields. Other paths return a JSON 404 response.

### Product API examples

Create a vendor product with `POST /api/vendor/products` (Bearer token required):

```json
{
  "name": "Handwoven jute tote",
  "description": "A reusable tote made by local artisans.",
  "price": 850,
  "compareAtPrice": 1000,
  "category": "64f000000000000000000001",
  "stock": 12,
  "imageUrl": "https://images.example.com/jute-tote.jpg"
}
```

`category` must be an active Category ObjectId. `imageUrl` is optional; `images` may instead be supplied as an array of up to 10 HTTP/HTTPS URLs. The server assigns vendor, shop, slug, active state, and pending status. Client-supplied ownership, slug, status, review metadata, active state, and system fields are rejected.

Successful create/detail/update responses use the existing response envelope:

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "64f000000000000000000010",
      "name": "Handwoven jute tote",
      "slug": "handwoven-jute-tote",
      "status": "pending",
      "isActive": true,
      "price": 850,
      "stock": 12
    }
  }
}
```

List endpoints return the relevant array (`data.products`, `data.categories`, or `data.shops`) plus `data.pagination`, whose fields are `page`, `limit`, `total`, and `pages`. Directory endpoints accept `page` (default `1`), `limit` (default `20`, maximum `100`), and `search` where applicable. Global product listing accepts `search`, `category` (active slug or ObjectId), `shop` (approved active slug or ObjectId), `minPrice`, `maxPrice`, `sort`, `page`, and `limit`. Category products accept search, price sorting, optional min/max price, and pagination; shop products also accept category filtering. Supported public product sorts are `newest`, `price_asc`, `price_desc`, and `name_asc`. Price ranges must be non-negative with `minPrice <= maxPrice`. Search is limited to 100 characters and treated as literal text; unsupported query keys and sorts are rejected.

Example requests:

```text
GET /api/categories?search=home&page=1&limit=12
GET /api/categories/home-living/products?search=lamp&sort=price_asc&page=1&limit=20
GET /api/shops?search=craft&page=1&limit=12
GET /api/shops/example-crafts/products?category=home-living&sort=newest
GET /api/products?search=linen&category=home-living&shop=example-crafts&minPrice=500&maxPrice=3000&sort=price_asc&page=1&limit=24
```

Category response example:

```json
{
  "success": true,
  "data": {
    "categories": [{ "id": "64f000000000000000000001", "name": "Home & Living", "slug": "home-living", "description": "Home goods", "image": "https://images.example.com/home.jpg" }],
    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
  }
}
```

Shop list responses use the same pagination envelope with `shops`; shop objects contain only public shop name, slug, logo, description, and city/district/country location. Public product list responses retain the existing `products` and `pagination` envelope. Product visibility consistently excludes pending/rejected/disabled, inactive, and soft-deleted products and products attached to pending, suspended, or inactive shops.

Admin rejects may send `{ "reason": "Please provide clearer product photos." }`; an empty body or omitted reason is also allowed. Review endpoints only transition products currently pending and active. Repeated review attempts return a conflict response. Public responses include only safe Shop and Category details and do not include vendor account data.

### Authentication requests

- `POST /api/auth/register` accepts `name`, `email`, and `password`; `phone` is optional. It always creates a customer. Any `role` in the request is ignored, and there is no public admin registration.
- `POST /api/auth/register/vendor` accepts the same user fields plus a `shop` object with required `shopName` and `slug`. Shop description, contact email, and contact phone are optional. The new shop starts in `pending` status.
- `POST /api/auth/login` accepts `email` and `password`. Invalid credentials and inactive users receive the same generic rejection.
- `GET /api/auth/me` requires `Authorization: Bearer <token>`. The token is verified, then the current active user and role are loaded from MongoDB.

Successful registration and login responses include a safe user profile and an access token. The password and password hash are never included. Admin accounts must be provisioned through a controlled administrative process; public registration cannot assign the admin role.

## Environment configuration

The example files define these variable names:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend | Optional API base URL for Axios. |
| `PORT` | Backend | HTTP server port; source configuration defaults to port 5000 when unset. |
| `CLIENT_ORIGIN` | Backend | CORS origin; source configuration defaults to the Vite development origin when unset. |
| `MONGODB_URI` | Backend | MongoDB connection string. Provide your own Atlas URI privately. |
| `CONNECT_TO_DATABASE` | Backend | Enables the startup database connection only when set to `true`. |
| `JWT_SECRET` | Backend | Private signing secret for access tokens; configure a random value of at least 32 characters. |

To configure a local machine, copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env` when creating fresh local files. If `server/.env` already exists, preserve its private values and add or update only the settings you need. Replace the MongoDB URI placeholder with your own Atlas connection string, opt in to the database connection by setting `CONNECT_TO_DATABASE` to `true`, and set `JWT_SECRET` to a locally generated random secret. Keep all `.env` files private; do not paste credentials into source files or commit them. The checked-in example files contain placeholders, not working credentials.

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

### Run backend tests

From `server/`, run:

```bash
npm test
```

The Node.js built-in test suite uses in-memory model stubs for auth, product, and discovery API flows and does not create accounts, products, or collections in MongoDB Atlas. Coverage includes role authorization, ownership, product approval/visibility, category and shop directories, global filters/sorts, legacy document visibility, pagination, and search.

### Health checks

After starting the backend, visit:

- `http://localhost:5000/api/health`
- `http://localhost:5000/api/health/db`

The database health endpoint returns HTTP 503 while Mongoose is disconnected; this is expected when the optional database connection is disabled.

## Security

- Keep `.env` and `.env.*` local; `.gitignore` excludes them while allowing `.env.example` files to be committed.
- Never put Atlas credentials, passwords, access tokens, or private keys in README files, source code, screenshots, or commits.
- The database connection error handling avoids logging the MongoDB URI.
- The User model hashes passwords on document saves and excludes the password field from normal queries. Authentication verifies passwords using the existing scrypt format.
- Product writes use explicit field allow-lists; vendor ownership and shop IDs come from the authenticated account, never the request body. Public queries require approved, active, and non-deleted products.
- Discovery responses select public fields only. Shop owner IDs, account email/phone, and private street address fields are not returned by the public shop APIs.
- JWT signing uses the private `JWT_SECRET`; the secret is never included in tokens or API responses. Bearer tokens expire after one hour.
- Login rejects invalid credentials with a generic message. Inactive accounts and invalid/missing tokens are rejected.
- Do not expose admin controls or rely on client-side role checks as authorization. Apply `authenticate` and `authorizeRoles` to future protected server routes.

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

1. Build out customer, vendor, and admin experiences beyond the current protected placeholders.
2. Add vendor approval/suspension workflows and an admin interface for product moderation.
3. Add cart, checkout, parent orders, and per-vendor orders.
4. Implement Cash on Delivery, select and integrate an online payment provider, and define payment state handling.
5. Add platform/vendor delivery assignment and order status tracking.
6. Add commission records and manual payout review.
7. Add reviews, notifications, and operational reporting.
8. Add refresh/revocation strategy, rate limiting, and deployment-specific security controls.
9. Expand automated tests, deployment configuration, monitoring, and backups.

These are future steps; they are not claims about current functionality.

## License

No license has been selected yet. All rights remain with the project owner unless a license is added.
