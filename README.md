# HelpHub - A-Z Home Services

A small full-stack home-services booking project built with React, Express, and MySQL. Customers book services, workers manage assigned jobs, and admins monitor enrollments and completed work.

## Features

- Customer and worker registration/sign-in with bcrypt password hashes and JWT authentication.
- Service catalog backed by MySQL with name/category search and starting prices.
- Customers create bookings, view their own bookings, and cancel pending or confirmed bookings.
- Workers maintain a basic profile, claim unassigned service requests, and move assigned work through `confirmed -> in_progress -> completed`.
- Admins view customer/worker enrollments, assign available workers, update booking statuses, and see live booking and revenue totals.
- Backend role checks protect customer, worker, and admin endpoints.

Admin accounts are created from the backend terminal. Public registration only supports customer and worker roles.

## Requirements

- Node.js and npm
- Git
- XAMPP with Apache and MySQL
- A browser

## Database Setup

1. Start Apache and MySQL in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`.
3. Choose **Import**, select `database/az_home_services.sql`, and run the import. The script creates `az_home_services` and its tables without dropping existing data.
4. Import `database/seed_services.sql` to add the sample service catalog. The seed script does not delete existing rows.

The sample starting prices are Appliance Diagnosis: Rs 650, Home Cleaning: Rs 750, Plumbing Repair: Rs 750, and Electrical Service: Rs 800. Prices are stored in the database; a booking saves its price at booking time.

## Environment Setup

Run these commands from the project root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edit `backend/.env` to match your local MySQL setup. The template uses database `az_home_services`, MySQL user `root`, an empty password, and API port `5001`.

Generate a JWT secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `JWT_SECRET` in `backend/.env`. Keep `.env` files private; Git ignores them.

The frontend API URL should be `http://localhost:5001/api` in `frontend/.env`.

## Install and Run

Install backend packages:

```powershell
cd backend
npm install
```

Start the API in a backend terminal:

```powershell
npm run dev
```

The API listens at `http://localhost:5001`.

Install frontend packages in a second terminal:

```powershell
cd frontend
npm install
```

Start the site:

```powershell
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. The backend CORS setting allows that origin.

Check the API and database:

- `http://localhost:5001/api/health`
- `http://localhost:5001/api/health/db`

## Create the First Admin

From the `backend` folder, run this once:

```powershell
npm run create-admin
```

Enter the admin name, email, and password when prompted. Password input is hidden. Then sign in through the site and open **Admin dashboard**.

## Demo Flow

1. Register a customer and a worker from the site.
2. Sign in as the customer, select a service, choose a future date/time, and create a booking.
3. Sign in as a worker and accept the unassigned service request, or sign in as the admin to assign a worker.
4. Sign in as the assigned worker and update the booking through each allowed status until it is completed.
5. Return to the admin dashboard and refresh to see the completed count and revenue summary update.

## Booking Rules

- Customers can only view their own bookings.
- Customers can cancel bookings that are `pending` or `confirmed`.
- Available workers can claim unassigned pending bookings. Only one worker can claim a request; its address is shown only after it is accepted.
- An assigned worker can only update their own booking, one step at a time: `pending -> confirmed -> in_progress -> completed`.
- Admins assign available workers to pending bookings and can manage permitted status changes.
- Booking prices are copied from the current service price when the booking is created. Later price changes do not alter existing bookings.

## API Summary

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public, customer/worker only | Create a customer or worker account |
| `POST` | `/api/auth/login` | Public | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Signed in | Read the current user |
| `GET` | `/api/services?search=` | Public | List/search active services |
| `GET` | `/api/workers?availability=available` | Public | List worker enrollment profiles |
| `GET`, `PATCH` | `/api/workers/me` | Worker | Read/update own profile |
| `POST` | `/api/bookings` | Customer | Create a booking |
| `GET` | `/api/bookings/mine` | Customer | List own bookings |
| `POST` | `/api/bookings/:id/cancel` | Customer | Cancel an eligible booking |
| `GET` | `/api/bookings/worker` | Worker | List assigned bookings |
| `GET` | `/api/bookings/worker/available` | Worker | List unassigned pending service requests |
| `POST` | `/api/bookings/:id/accept` | Available worker | Claim an unassigned request |
| `PATCH` | `/api/bookings/:id/status` | Assigned worker | Advance a booking status |
| `GET` | `/api/admin/dashboard` | Admin | Read live summary totals |
| `GET` | `/api/admin/users` | Admin | List customer/worker enrollments |
| `GET` | `/api/admin/bookings` | Admin | List bookings |
| `GET` | `/api/admin/workers` | Admin | List available workers for assignment |
| `PATCH` | `/api/admin/bookings/:id/assign` | Admin | Assign an available worker |
| `PATCH` | `/api/admin/bookings/:id/status` | Admin | Update a permitted booking status |

Authenticated requests use `Authorization: Bearer <token>`.

## Project Structure

```text
HelpHub/
  backend/
    config/db.js
    create-admin.js
    server.js
  database/
    az_home_services.sql
    seed_services.sql
  frontend/
    src/components/
    src/pages/
    src/services/api.js
    src/App.jsx
```
