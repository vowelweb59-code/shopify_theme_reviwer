// A finer cut than Shopify's categories: what an app says it does, read from its name and tagline.
// An app can match several topics. Used to split a category into niches ("Email marketing › SMS") and
// to compare one topic across categories. Add a line to make a topic visible; patterns match whole words.

type Topic = { key: string; label: string; pattern: RegExp };
const t = (key: string, label: string, pattern: string): Topic => ({ key, label, pattern: new RegExp(`\\b(?:${pattern})`, "i") });

export const TOPICS: Topic[] = [
  // reaching customers
  t("sms", "SMS & WhatsApp", "sms|text messag|whatsapp|texting"),
  t("email", "Email", "e-?mail|newsletter"),
  t("popup", "Popups & lead capture", "pop[- ]?ups?|lead capture|opt-?in|spin.to.win|exit.intent"),
  t("push", "Push notifications", "push notif|web push"),
  t("abandoned-cart", "Abandoned cart & recovery", "abandoned|cart recover|recover(?:y|ing)"),
  t("back-in-stock", "Back in stock alerts", "back.in.stock|restock|stock alert|notify me"),
  t("social", "Social media", "social media|instagram|facebook|tiktok|pinterest|snapchat|youtube|ugc|influencer"),
  t("ads", "Ads & pixels", "ads?\\b|advertis|pixel|google shopping|meta ads|retarget|conversion api|capi\\b"),
  t("feed", "Product feeds", "product feed|data ?feed|feed manager|merchant center"),
  t("seo", "SEO", "seo|search engine|meta tags?|json-?ld|schema markup|sitemap|broken links?|redirect"),
  t("image-opt", "Image & speed optimization", "image optimi|compress|page speed|lazy.?load|site speed|core web vitals|performance"),
  t("blog", "Blog & content", "blog|article|content creat|copywrit"),
  t("affiliate", "Affiliate & referral", "affiliate|referral|refer a friend|ambassador"),
  // converting
  t("reviews", "Reviews & ratings", "reviews?|ratings?|testimonial|stars?\\b"),
  t("trust", "Trust badges & social proof", "trust|badge|social proof|sales notif|recent sales|verified"),
  t("upsell", "Upsell & cross-sell", "upsell|up-sell|cross-?sell|recommendation|frequently bought|post.purchase|one.click"),
  t("bundles", "Bundles & volume discounts", "bundl|volume discount|quantity (?:break|discount)|mix (?:&|and) match|tiered"),
  t("discounts", "Discounts & promotions", "discount|coupon|promo|flash sale|automatic discount|bogo"),
  t("countdown", "Countdown & urgency", "countdown|timer|urgency|scarcity|stock counter|announcement bar"),
  t("gift", "Gift cards & gifting", "gift"),
  t("loyalty", "Loyalty & rewards", "loyalty|rewards?|points|vip|membership"),
  t("preorder", "Pre-orders & waitlists", "pre-?order|waitlist|backorder|coming soon"),
  t("wishlist", "Wishlist", "wishlist|wish list|save for later"),
  t("checkout", "Checkout customization", "checkout|express pay|buy now|one-?page|order bump|cart drawer|sticky (?:cart|add)"),
  t("payments", "Payments", "payment|pay later|buy now pay later|bnpl|klarna|cod\\b|cash on delivery|installment"),
  t("subscriptions", "Subscriptions", "subscription|recurring|subscribe (?:&|and) save|membership box"),
  t("cart", "Cart", "\\bcart"),
  t("search", "Search & filters", "search|filter|navigation|mega ?menu|collection page|merchandis"),
  t("options", "Product options & variants", "product options?|variants?|swatch|custom fields?|size chart|size guide|bundle builder"),
  t("customizer", "Personalization & custom products", "personali[sz]|customi[sz]er|engrav|monogram|product builder|made.to.order|print.?on.?demand|pod\\b"),
  t("quiz", "Quizzes & guided selling", "quiz|product finder|recommend(?:er)? tool|survey"),
  t("chat", "Live chat & support", "live chat|chatbot|help ?desk|customer support|support ticket|faq|inbox"),
  t("ai", "AI", "\\bai\\b|artificial intelligence|gpt|chatgpt|generative|llm|machine learning"),
  // building
  t("pagebuilder", "Page builders", "page ?builder|landing page|drag.and.drop|theme (?:builder|customi)"),
  t("media", "Images, video & media", "video|gallery|slideshow|carousel|zoom|3d\\b|augmented"),
  t("forms", "Forms", "contact form|forms?\\b|form builder"),
  t("compliance", "Privacy, cookies & legal", "gdpr|cookie|privacy|consent|ccpa|terms|polic(?:y|ies)|age verif|legal|compliance"),
  t("accessibility", "Accessibility", "accessib|ada\\b|wcag"),
  t("translation", "Translation & languages", "translat|multi-?language|language|localiz|hreflang"),
  t("currency", "Currency & international", "currenc|international|geo-?(?:locat|target|ip)|cross-?border|duties"),
  t("tax", "Tax & invoicing", "\\btax|vat|invoice|receipt|accounting|bookkeep|quickbooks|xero"),
  t("b2b", "B2B & wholesale", "b2b|wholesale|trade|reseller|net terms|quote|request a quote|rfq"),
  t("marketplace", "Marketplaces & channels", "marketplace|amazon|ebay|etsy|walmart|tiktok shop|google (?:&|and) youtube|multichannel|omnichannel|sync"),
  t("pos", "In-person & POS", "pos\\b|point of sale|in-?store|retail|pickup|click (?:&|and) collect|store locator"),
  t("digital", "Digital products & courses", "digital (?:product|download|good)|download|course|ebook|license key|membership content|software"),
  t("booking", "Bookings & rentals", "booking|appointment|rental|reservation|scheduling|tickets?\\b"),
  // fulfilling
  t("shipping", "Shipping rates & labels", "shipping|delivery|carrier|label|freight|rates?\\b|free shipping bar|estimated delivery"),
  t("tracking", "Order tracking & notifications", "track|order status|notification|shipment"),
  t("returns", "Returns & exchanges", "return|exchange|refund|warranty|rma|claims?"),
  t("fulfilment", "Fulfilment & 3PL", "fulfil|3pl|warehouse|supplier|sourcing|vendor"),
  t("dropshipping", "Dropshipping & import", "dropship|aliexpress|import products|cj\\b|spocket|print.on.demand"),
  t("orders", "Order management", "order (?:management|editing|edit|manager|export)|bulk (?:edit|order)|edit order|order tags|fraud"),
  t("inventory", "Inventory", "inventory|stock (?:management|level|sync)|reorder|purchase order|barcode|sku"),
  // running
  t("analytics", "Analytics & reporting", "analytics|report|dashboard|insights|attribution|kpi|metrics|ga4|heatmap|session record"),
  t("automation", "Workflow automation", "automat|workflow|zapier|connector|webhook"),
  t("fraud", "Fraud & security", "fraud|security|risk|chargeback|spam|bot\\b|malware"),
  t("bulk", "Bulk editing & data", "bulk|csv|import|export|migrat|spreadsheet|backup"),
  t("staff", "Team & admin tools", "staff|team|permission|collaborat"),
  t("customer-accounts", "Customer accounts", "customer account|login|sign.?in|account page|portal|profile"),
];

export const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOPICS.map((x) => [x.key, x.label]));

/** The topics an app's name and tagline mention, in table order. */
export function topicsOfApp(name: string, tagline: string | null): string[] {
  const text = `${name}. ${tagline ?? ""}`;
  return TOPICS.filter((x) => x.pattern.test(text)).map((x) => x.key);
}
