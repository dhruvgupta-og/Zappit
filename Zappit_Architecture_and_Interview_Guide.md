# Zappit - Comprehensive Architecture & Interview Guide

This document is designed to help you explain **Zappit** in a technical interview. It provides a deep dive into the technologies, the architecture, the order lifecycle, security implementations, and exactly how the entire system connects together.

---

## 1. Project Overview & Business Logic
**Zappit** is a hyper-local campus delivery platform that allows college students to order food and essentials from stores directly on or near their campus. 
*   **The Problem:** Campus students face friction ordering food to specific hostel blocks due to generic delivery apps not understanding campus layouts.
*   **The Solution:** A specialized, college-specific delivery network using custom geofencing (campuses), student profiles, and localized store onboarding.

### Core User Roles:
1.  **Customer (Student):** Browses stores mapped to their college, applies coupons, makes payments, and tracks orders.
2.  **Store Owner:** Manages their specific menu, toggles item availability, and updates order status (e.g., from "Confirmed" to "Preparing").
3.  **Delivery Partner:** Tracks active orders assigned to them and finalizes deliveries using a unique 6-digit OTP provided by the customer.
4.  **Admin:** A super-user who can onboard new colleges, add/remove stores, generate dynamic coupons, and change system-wide fees (delivery/platform fees).

---

## 2. Technology Stack Deep-Dive (MERN / Serverless Hybrid)

### 🎨 Frontend (Client-Side)
*   **React.js (Vite):** Chosen for lightning-fast Hot Module Replacement (HMR) during development and highly optimized production builds.
*   **Tailwind CSS & CSS Variables:** Used for responsive design. CSS variables allow for easy theming (e.g., dark mode or primary brand colors).
*   **React Router v6:** Manages client-side routing, protected routes (restricting access to dashboards based on roles), and URL parameters (e.g., `/track/:orderId`).
*   **Context API (`CartContext.jsx`):** Handles the global shopping cart state. It synchronizes with `localStorage` to ensure the cart survives page refreshes.

### ⚙️ Backend & APIs (Serverless)
*   **Vercel Serverless Functions (`web/api/`):** We use Node.js serverless functions instead of a traditional constantly-running Express server. This reduces hosting costs to $0 and scales infinitely. 
*   **Payment Gateway (Razorpay):** Integrated via serverless functions to ensure API secrets are never exposed to the frontend.
*   **Email Service (Resend API):** Dispatches beautiful HTML transactional emails (Order Confirmations & Welcome emails) instantly using Vercel functions.

### 🗄️ Database & Cloud (Firebase)
*   **Firestore (NoSQL):** Stores all JSON-like document data. It's heavily optimized using `getDocs` for static data (menus, stores) and `onSnapshot` for real-time WebSocket data (live order tracking).
*   **Firebase Authentication:** Handles secure user login (Google OAuth & Email/Password).
*   **Firebase Storage:** Hosts static media like Store Logos and Promotional Banners.
*   **Firebase Cloud Messaging (FCM):** Manages push notifications.

---

## 3. The Order Lifecycle (Step-by-Step Flow)

1.  **Cart & Checkout:** The user adds items to the cart. The frontend calculates dynamic platform and delivery fees (fetched from Firestore `config/fees`).
2.  **Payment Initiation:** The frontend calls `/api/create-order` with the final amount. The serverless function requests a secure `order_id` from Razorpay and sends it back.
3.  **Razorpay Widget & UPI Intents:** The user completes payment. For mobile browsers, a `callback_url` redirects the browser back to our `/api/verify-payment` function to prevent Javascript suspension issues when switching to UPI apps like FamPay.
4.  **Verification:** `verify-payment.js` uses a cryptographic hash (`HMAC SHA256`) to guarantee the payment is authentic, then redirects to `/payment-callback`.
5.  **Order Creation:** `PaymentCallback.jsx` writes the order to the Firestore `orders` collection with a unique 6-digit `delivery_otp` and clears the local cart.
6.  **Real-Time Tracking:** The user is sent to the tracking page, which uses `onSnapshot` to listen to changes. When a Store Owner marks the order as "Out for Delivery", the customer's screen updates instantly.
7.  **OTP Verification:** The delivery partner arrives, asks the customer for their OTP, and enters it into the Delivery Dashboard. If it matches, the order is marked "Delivered".

---

## 4. Security & Role Management

### Role-Based Access Control (RBAC)
Instead of putting user roles inside the `users` collection (which users could potentially modify), Zappit uses a secure, separate `staff` collection. 
*   A user logs in. The frontend checks if their `uid` exists in the `staff` collection.
*   If `role == 'admin'`, they get access to `/admin`.
*   If `role == 'store_owner'`, they get access to `/store-dashboard`.

### Firestore Security Rules
All database access is protected by Firebase Security Rules evaluated on Google's servers:
```javascript
// Example: Only allow admins to write to the coupons collection
match /coupons/{couponId} {
  allow read: if request.auth != null;
  allow write: if get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.role == 'admin';
}
```

---

## 5. Potential Interview Questions & Answers

**Q: How do you handle payments securely in Zappit?**
**A:** "I never trust the client frontend with the final price. When a user checks out, the frontend calculates the price and calls my Vercel serverless function (`create-order.js`). The server talks to Razorpay securely, generates an Order ID, and sends it back. After the user pays, Razorpay hits my `verify-payment.js` webhook, where I use a secret HMAC SHA256 signature to verify the payment is authentic before actually inserting the order into Firestore."

**Q: Why did you use `callback_url` for Razorpay instead of a standard Javascript handler?**
**A:** "During testing, I discovered a critical bug with Mobile Web browsers. When users selected UPI apps like FamPay or PhonePe, the browser tab would get suspended while they completed the payment in the UPI app. When they returned, the Javascript context was lost and the screen would freeze endlessly. I fixed this by passing a `callback_url` to Razorpay, forcing it to actively HTTP-redirect the browser back to my Vercel backend (`verify-payment.js`), completely solving the infinite loading loop."

**Q: How did you optimize your database reads to stay within Firebase's free tier limit?**
**A:** "Initially, my Admin Dashboard used continuous real-time WebSockets (`onSnapshot`) for Stores, Colleges, Banners, and Coupons. I quickly hit the 50,000 daily read quota limit because every change triggered massive document reads. I refactored the architecture so only 'Orders' uses a real-time listener (since they need to be tracked live), while everything else uses a one-time `getDocs` fetch on page load, drastically reducing my database operations."

**Q: How does your shopping cart persist across page reloads?**
**A:** "I built a custom Context API provider (`CartContext.jsx`) that wraps the application. Every time a user adds an item, the Context updates its internal React state and immediately serializes that state to the browser's `localStorage`. When the app loads, the Context initializes its state by lazily parsing `localStorage`, ensuring the user never loses their cart."

**Q: How do you prevent users from spoofing another person's order or viewing someone else's data?**
**A:** "I implemented strict Firestore Security Rules. A user can only read from the `orders` collection if the `user_id` on the document exactly matches their Firebase Authentication `request.auth.uid`. Store owners and delivery partners bypass this because the rules explicitly check the `staff` collection to verify their elevated roles before allowing the read."

**Q: Why use Vercel Serverless Functions instead of your Express server?**
**A:** "While I used Express for local testing, deploying a permanent Node.js server requires a server constantly running (like an AWS EC2 instance), which costs money. Vercel Serverless Functions only run exactly when an API route is hit, scaling perfectly from 0 to thousands of users instantly, while keeping hosting costs practically free."
