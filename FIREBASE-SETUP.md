# JMX Remodeling — Firebase production setup

This project can run locally without Firebase. To publish admin changes for every visitor and manage images from any device, complete this one-time setup.

## 1. Create a Firebase project
1. Open Firebase Console and create a project for JMX Remodeling.
2. Add a **Web app** to that project.
3. Copy the Firebase web configuration values into `admin-config.js` under `firebase.config`.
4. Set `firebase.enabled` to `true`.
5. Put the exact Google email allowed to administer the site in `allowedGoogleEmail`.
6. For the final hosted site, set `productionMode` to `true`.

The Firebase web config is designed to be included in browser code. Never put service-account JSON, private keys, bank credentials, card numbers or payment API secret keys in this project.

## 2. Enable Google Sign-In
In Firebase Console → Authentication → Sign-in method, enable **Google**. Add your production domain under Authentication → Settings → Authorized domains.

## 3. Create Firestore
Create a Firestore database. This site publishes its settings to:

`sites/jmx-public`

Replace `YOUR_ADMIN_EMAIL@gmail.com` in `firestore.rules` with the same authorized admin email, then deploy those rules.

The rules allow the public website to read only the published site document and allow only the authorized signed-in Google account to write it.

## 4. Enable Firebase Storage
Enable Storage. Replace `YOUR_ADMIN_EMAIL@gmail.com` in `storage.rules`, then deploy the rules.

Uploaded website images are stored under `jmx-site-assets/`. Public visitors may read these website images; only the authorized admin account may upload or replace them. Uploads are limited to image files under 10 MB.

## 5. Publish from Admin
Open `admin.html`, sign in with the authorized Google account, edit the site and click **Publish Changes**. Text, theme, SEO, payments and other settings go to Firestore. Images uploaded from Admin go to Firebase Storage and their public URLs are stored in the published settings.

The public `index.html` automatically loads the Firestore settings on page load when Firebase is enabled.

## 6. SEO, Search Console and Analytics
In Admin → **SEO & Marketing** you can set:
- Site title and meta description
- Keywords and canonical URL
- Social sharing image
- Google Search Console verification token
- Google Business Profile and review links
- Structured Local Business data
- Google Analytics 4 Measurement ID (`G-...`)

When Analytics is enabled, the public site loads GA4 and can record clicks on phone, WhatsApp, email, Facebook, estimate and payment buttons.

## 7. Google Search Console
Add the production domain to Google Search Console. If you choose the HTML-tag verification method, paste only the `content` verification token into Admin → SEO & Marketing → Google Search Console verification, publish, then complete verification in Search Console.

## 8. Recommended deployment checks
- Use HTTPS and a real domain.
- Test Admin login on the production domain.
- Confirm unauthorized Google accounts cannot write.
- Test image upload and replacement from a second device.
- Test the public site in a private/incognito window to verify cloud-published changes are visible without an admin login.
- Add only truthful license, insurance, warranty and testimonial information.
- Configure payment links only with public hosted checkout URLs; never store secret payment credentials in the website.

## 9. Traffic counters
This version includes public page-load counters stored in Firestore:
- `traffic/global`
- `traffic/monthly_YYYY-MM`

The public site adds +1 to both counters on every page load. The monthly document name changes automatically on the first day of each month using the America/Chicago timezone, so the new month starts from zero without deleting historical month documents. The all-time document never resets.

Deploy the included `firestore.rules`. They permit public visitors only to increment these counter documents by exactly one and prevent public reads, decrements, deletes or arbitrary field edits. Only the authorized admin account can read the totals in Admin → Traffic Counters.

These counters measure page loads, not unique people. Bots, repeated visits and browser refreshes may increase them. Use Google Analytics 4 alongside them for deeper traffic analysis.
