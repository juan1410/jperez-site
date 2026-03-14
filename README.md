# CSE 135 — HW5 Submission

## Links
- **Repository:** https://github.com/juan1410/jperez-site
- **Deployed Site:** https://reporting.jperez.site/login.html
- **Collector Site:** https://test.jperez.site

## Project Overview
An analytics dashboard built with JavaScript (frontend) and PHP (backend), backed by a MySQL database. The dashboard visualizes data collected by a custom `collector.js` script running on a test site, providing report for different categories.

## Use of AI
This project was built with some assistance of AI. AI was used for:
- Debugging errors during development
- Generating some SQL queries
- Debugging the chart and table rendering logic in JavaScript

**Observations on AI value:** AI was highly effective at debugging and finding repetitive JS render functions. However, it did require careful review of every output, particularly around security-sensitive code like authentication and session handling.

## Architecture
```
/public_html
├── dashboard.html      # SPA shell
├── login.html          # Login page
├── api.php             # All API endpoints
├── auth.php            # Auth helpers (requireAuth, checkUser, authenticate)
├── fpdf.php            # FPDF library for PDF export
├── /css
│   ├── dashboard.css
│   └── login.css
├── /js
│   ├── dashboard.js
│   └── login.js
└── /exports            # Generated PDF reports (web-accessible)
```

## Database Tables
- `users` — stores user accounts with roles
- `sections` — available dashboard sections
- `user_sections` — join table mapping analysts to their allowed sections
- `pageviews` — all collected analytics events
- `reports` — saved report snapshots with analyst comments

## Roadmap (Future / Time Permitting)
- **Sign up** - currently have no implementation of allowing anyone to sign up
- **Password reset** — no self-service password reset exists, admin must manually update
- **Email export** — allow PDF reports to be sent via email instead of just saving to URL
- **Real-time updates** — auto-refresh overview metrics every N seconds
- **Mobile sidebar** — sidebar is hidden on mobile, a hamburger menu would improve usability
- **Analyst comment editing** — currently comments are set at save time and would be better if it can be edited.
- **Pagination** — tables are capped at 50 rows, pagination would allow browsing more data
