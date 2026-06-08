import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const root = process.cwd();
const indexPath = join(root, "index.html");
const readmePath = join(root, "README.md");

const checks = [];

function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
}

const html = readFileSync(indexPath, "utf8");
const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";

check("README exists", existsSync(readmePath));
check("README documents features", /功能亮点/.test(readme) && /购物车/.test(readme));
check("README documents local usage", /本地运行/.test(readme) && /npm start/.test(readme));
check("page has SEO description", /<meta\s+name="description"/i.test(html));
check("cart is persisted", /CART_STORAGE_KEY/.test(html) && /saveCart/.test(html));
check("favorites are persisted", /FAVORITES_STORAGE_KEY/.test(html) && /saveFavorites/.test(html));
check("products include stock and rating", /stock:\s*\d+/.test(html) && /rating:\s*[\d.]+/.test(html));
check("cart supports clear action", /id="clear-cart"/.test(html) && /clearCart/.test(html));
check("checkout confirmation modal exists", /id="checkout-modal"/.test(html) && /openCheckoutModal/.test(html));
check("filter buttons expose active state", /setSort\(/.test(html) && /data-sort/.test(html));

const runtimeErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (message) => runtimeErrors.push(message));
virtualConsole.on("jsdomError", (error) => runtimeErrors.push(error.message));

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "https://serein-select.test/",
  virtualConsole
});

const { document, localStorage } = dom.window;

function click(selector, name) {
  const element = document.querySelector(selector);
  check(`${name} exists`, element);
  element?.click();
  return element;
}

check("page script runs without console errors", runtimeErrors.length === 0);
check("renders 20 product cards", document.querySelectorAll(".product-card").length === 20);
check("checkout starts disabled", document.querySelector("#checkout-btn")?.disabled === true);

click(".product-card .add-to-cart", "add-to-cart button");
check("cart count updates after add", document.querySelector("#cart-count")?.textContent.trim() === "1 件");
check("cart is written to localStorage", /"quantity":1/.test(localStorage.getItem("serein-select-cart-v1") || ""));
check("checkout enables after add", document.querySelector("#checkout-btn")?.disabled === false);

click(".product-card .favorite-btn", "favorite button");
check("favorite is written to localStorage", /\[1\]/.test(localStorage.getItem("serein-select-favorites-v1") || ""));

click("#checkout-btn", "checkout button");
check("checkout modal opens", document.querySelector("#checkout-modal")?.classList.contains("show"));
check("checkout summary shows one item", document.querySelector("#checkout-items")?.textContent.trim() === "1 件");

click("#confirm-checkout", "confirm checkout button");
check("order count updates after checkout", document.querySelector("#orders-today")?.textContent.trim() === "1");
check("cart is empty after checkout", document.querySelector("#cart-count")?.textContent.trim() === "0 件");
check("checkout modal closes", !document.querySelector("#checkout-modal")?.classList.contains("show"));

const failed = checks.filter((item) => !item.pass);

for (const item of checks) {
  console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
