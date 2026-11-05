# Pakalale Project Documentation

## Pages

Route groups in parentheses, such as `(dashboard)`, organize the source files and are not part of the URL. Bracketed segments, such as `[userId]`, are dynamic route parameters.

### Public and Account Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page with an introduction to Pakalale, market locations, and shop/product statistics. |
| `/login` | Sign in and route users to the area for their account role. |
| `/signup` | Register as a customer or shop owner. |
| `/forgot-password` | Display the password-reset form. |

### Customer Pages

| Route | Purpose |
| --- | --- |
| `/customer` | Customer home with the community feed, trending shops, and market locations. |
| `/customer/chat` | Message shops and manage deal conversations with live chat. |
| `/customer/deals` | Search and filter the customer's deals by status. |
| `/customer/locations` | Browse and search market locations and their shop categories. |
| `/customer/locations/[locationId]` | Browse shops in a market, view shop products, and start a deal. |
| `/customer/notifications` | View and manage customer notifications. |
| `/customer/profile/[userId]` | View a user's profile, shop details, and posts; start a conversation. |
| `/customer/search` | Search products, shops, and locations; view search history and submit product-demand requests. |
| `/customer/settings` | Update customer profile, photo, preferences, notifications, and privacy settings. |

### Shop Owner Pages

| Route | Purpose |
| --- | --- |
| `/shop/analytics` | View shop performance metrics and top products. |
| `/shop/chat` | Message customers and handle deal conversations. |
| `/shop/deals` | Review customer deals and update their statuses. |
| `/shop/feed` | View and participate in the community feed. |
| `/shop/history` | Review deal history with status/date filters and summary totals. |
| `/shop/notifications` | View and manage shop notifications. |
| `/shop/orders` | View orders and filter by order status. |
| `/shop/overview` | Shop dashboard with views, revenue, ratings, deals, and recent activity. |
| `/shop/products` | Add, edit, search, and manage products and stock. |
| `/shop/profile/[userId]` | View a user's profile and posts, and message them. |
| `/shop/sales` | Summarize sales and revenue from completed deals. |
| `/shop/settings` | Edit shop details, images, hours, specialties, and verification information. |
| `/shop/virtual-shop` | Preview the shop storefront and product listings. |

### Admin Pages

| Route | Purpose |
| --- | --- |
| `/admin` | Platform overview with user, shop, product, and messaging statistics. |
| `/admin/shops` | Search shops and review verification status and documents. |
| `/admin/users` | Search and manage users by role. |

> Note: Shop sales and deal-history pages summarize deal conversations, while `/shop/orders` uses the separate orders flow.
