// Features (ids from availableFeatures.ts) that can be recognised from a demo store's rendered HTML, with the markup each one
// leaves behind. Pure and dependency-free so the Themes page (client) can import LIVE_CHECKABLE as well as the audit.
//
// A signature matches the page's MARKUP (tags, attributes, visible text) after inline <script>, <style> and comments are removed,
// so a library name inside a script bundle doesn't count as the feature being present. "Seen" is therefore reliable; "not seen"
// only means the markup wasn't on the pages read (home, first product, first collection of each preset): features that live
// behind a click, on another template, or only in JavaScript can be missed.

const SIGNATURES: Record<string, RegExp[]> = {
  // Cart & merchandising
  "pre-order": [/pre-?order/i],
  "cart-notes": [/name=["']note["']/i, /cart[-_]note/i],
  "gift-wrapping": [/gift[-_ ]?wrap/i],
  "in-store-pickups": [/pickup[-_]availability/i, /store[-_]availability/i],
  "quick-buy": [/quick[-_]?(add|buy)/i],
  "quick-view": [/quick[-_]?view/i],
  "sign-in-with-shop": [/<shop-login/i, /shop[-_]login[-_]button/i, /sign in with shop/i],
  "slide-out-cart": [/cart[-_]drawer/i, /mini[-_]cart/i, /side[-_]cart/i, /cart[-_]sidebar/i, /slide[-_]?(out|in)[-_]cart/i],
  "sticky-cart": [/sticky[-_](add[-_]to[-_]cart|atc|cart|bar)/i, /add[-_]to[-_]cart[-_-]+sticky/i],
  "recently-viewed": [/recently[-_ ]?viewed/i],
  "recommended-products": [/<product-recommendations/i, /recommendations\/products/i, /you may also like/i, /related products/i, /recommended products/i],
  "stock-counter": [/only \d+ (items? |units? )?left/i, /\d+ (items?|units?) left/i, /low stock/i, /stock[-_]counter/i, /inventory[-_](bar|status|counter)/i],
  "quantity-pricing": [/quantity[-_ ](rules|breaks?|price|pricing)/i, /volume[-_]pricing/i, /price[-_]break/i],
  "quick-order-list": [/quick[-_]order/i],
  "back-in-stock-alert": [/back[-_ ]in[-_ ]stock/i, /notify me when/i],
  // Content & promotion
  blogs: [/href=["'][^"']*\/blogs\/[a-z0-9-]+/i],
  "countdown-timer": [/(?:class|id|data-[\w-]+)=["'][^"']*count-?down/i],
  "in-menu-promos": [/menu[-_]promo/i, /mega[-_]menu__(promo|image|banner)/i, /menu[-_]banner/i],
  "press-coverage": [/as seen (in|on)/i, /featured (in|on)\b/i, /press[-_]logos?/i, /logo[-_]list/i],
  "product-badges": [/product[-_]badge/i, /card__badge/i, /badge--(sale|sold|new)/i, /class=["'][^"']*\bbadge\b/i],
  "promo-popups": [/(newsletter|promo|exit|email)[-_]popup/i, /popup[-_](modal|newsletter)/i, /data-popup/i],
  "promo-tiles": [/promo[-_]tile/i, /tile[-_]banner/i, /promo[-_]grid/i],
  // Trust & localization
  "age-verifier": [/age[-_]?(verif|gate|check)/i],
  // Media
  "image-hotspot": [/hotspot/i],
  "image-rollover": [/secondary[-_]image/i, /hover[-_]image/i, /image[-_]hover/i, /rollover/i, /card__media--hover/i],
  "image-zoom": [/image[-_]zoom/i, /zoom[-_]image/i, /product[-_]zoom/i, /data-zoom/i, /photoswipe/i, /pswp/i, /magnify/i],
  "before-after-image-slider": [/before[-_]?after/i, /image[-_]comparison/i, /compare[-_]slider/i],
  lookbooks: [/lookbook/i],
  slideshow: [/(?:class|id|data-[\w-]+)=["'][^"']*(slideshow|swiper|splide|slick|carousel|flickity|slider)/i],
  // Product page
  "color-swatches": [/(?:class|id|data-[\w-]+)=["'][^"']*swatch/i],
  "combined-listing": [/combined[-_]listing/i, /product[-_]group/i],
  "ingredients-nutritional-information": [/ingredients/i, /nutrition(al)?[-_ ](facts|info)/i],
  "product-options": [/variant[-_](picker|selects?)/i, /product-form__input/i, /name=["']options\[/i],
  "product-videos": [/product[-_]video/i, /data-media-type=["']video/i, /youtube(-nocookie)?\.com\/embed/i, /player\.vimeo\.com/i],
  "shipping-delivery-information": [/shipping[-_ ](info|policy|returns)/i, /estimated[-_ ]delivery/i, /delivery[-_ ](info|estimate)/i, /shipping[-_]calculator/i],
  "size-chart": [/size[-_ ]?(chart|guide)/i, /sizing[-_ ]guide/i],
  "usage-information": [/how to use/i, /usage[-_ ](info|instructions)/i, /directions for use/i],
  // Navigation & browsing
  "back-to-top-button": [/back[-_]to[-_]top/i, /scroll[-_]to[-_]top/i],
  breadcrumbs: [/breadcrumb/i],
  "enhanced-search": [/predictive[-_]search/i, /search[-_]suggest/i, /search\/suggest/i],
  "infinite-scroll": [/infinite[-_]?scroll/i, /load[-_]more/i],
  "mega-menu": [/mega[-_]?menu/i],
  "product-filtering-and-sorting": [/(?:class|id)=["'][^"']*(facets|filter-form|collection-filters)/i, /name=["']sort_by["']/i, /filter\.v\./i],
  "sticky-header": [/sticky[-_]header/i, /header[-_-]+sticky/i, /data-sticky/i, /is-sticky/i],
};

/** Feature ids a live demo store can confirm or contradict. Everything else is judged from the code and the Theme Store listing. */
export const LIVE_CHECKABLE: ReadonlySet<string> = new Set(Object.keys(SIGNATURES));

function markupOnly(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ");
}

/** Feature ids whose markup appears in this page's HTML. */
export function detectLiveFeatures(html: string): string[] {
  const markup = markupOnly(html);
  return Object.entries(SIGNATURES)
    .filter(([, patterns]) => patterns.some((p) => p.test(markup)))
    .map(([id]) => id);
}
