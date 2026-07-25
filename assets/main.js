function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${path}`);
  return res.json();
}

function fillText(root, data) {
  qsa("[data-field]", root).forEach((el) => {
    const key = el.getAttribute("data-field");
    if (data[key] !== undefined && data[key] !== "") {
      if (el.hasAttribute("data-html")) {
        el.innerHTML = String(data[key]).split("\n\n").map(p => `<p>${p}</p>`).join("");
      } else {
        el.textContent = data[key];
      }
    }
  });
  qsa("[data-href]", root).forEach((el) => {
    const key = el.getAttribute("data-href");
    if (data[key]) el.setAttribute("href", data[key]);
  });
  qsa("[data-bg]", root).forEach((el) => {
    const key = el.getAttribute("data-bg");
    if (data[key]) el.style.backgroundImage = `url('${data[key]}')`;
  });
  qsa("[data-src]", root).forEach((el) => {
    const key = el.getAttribute("data-src");
    if (data[key]) el.setAttribute("src", data[key]);
  });
}

function renderNews(root, workshops) {
  const grid = qs("[data-news]", root);
  if (!grid) return;
  const items = (workshops.items || []).filter(Boolean);
  if (!items.length) {
    grid.innerHTML = `<p class="news-empty">Momentálně žádné vypsané termíny.</p>`;
    return;
  }
  grid.innerHTML = items.map((w) => `
    <div class="news-card">
      ${w.image
        ? `<div class="photo" style="background-image:url('${w.image}')"></div>`
        : `<div class="photo placeholder-photo">Fotka akce</div>`}
      <div class="body">
        ${w.tag ? `<div class="tag">${w.tag}</div>` : ""}
        <h3>${w.title}</h3>
        ${w.link ? `<a class="btn" href="${w.link}" target="_blank" rel="noopener">${w.title}</a>` : ""}
      </div>
    </div>
  `).join("");
}

function measureRatio(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve((img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 0.8);
    img.onerror = () => resolve(0.8);
    img.src = src;
  });
}

async function renderGallery(root, gallery) {
  const grid = qs("[data-gallery]", root);
  if (!grid) return;
  const items = (gallery.items || []).filter((g) => g && g.image);
  if (!items.length) {
    grid.innerHTML = `<p class="news-empty">Zatím žádné fotky.</p>`;
    return;
  }
  const colCount = window.innerWidth <= 700 ? 2 : 3;
  const ratios = await Promise.all(items.map((it) => measureRatio(it.image)));
  const cols = Array.from({ length: colCount }, () => ({ height: 0, el: document.createElement("div") }));
  cols.forEach((c) => { c.el.className = "gallery-col"; });

  items.forEach((it, i) => {
    const ratio = ratios[i] || 0.8;
    const shortest = cols.reduce((a, b) => (a.height <= b.height ? a : b));
    const a = document.createElement("a");
    a.href = it.image;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", it.caption || "");
    const img = document.createElement("img");
    img.src = it.image;
    img.alt = it.caption || "";
    img.loading = "lazy";
    a.appendChild(img);
    shortest.el.appendChild(a);
    shortest.height += 1 / ratio;
  });

  grid.innerHTML = "";
  cols.forEach((c) => grid.appendChild(c.el));
}

function initNavToggle() {
  const toggle = qs(".nav-toggle");
  const nav = qs("nav.primary-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  qsa("a", nav).forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
}

function initHeroFallback(site) {
  const video = qs(".hero-media");
  if (!video) return;
  if (site.hero_video) {
    if (site.hero_poster) video.setAttribute("poster", site.hero_poster);
  } else if (site.hero_poster) {
    video.remove();
    const hero = qs(".hero");
    hero.style.backgroundImage = `url('${site.hero_poster}')`;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  } else {
    video.remove();
  }
}

function initHeaderScroll() {
  const header = qs(".site-header.on-hero");
  if (!header) return;
  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function reapplyHashScroll() {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (!target) return;
  target.scrollIntoView({ behavior: "auto", block: "start" });
}

window.addEventListener("load", reapplyHashScroll);

function waitForImages() {
  const imgs = qsa("img");
  return Promise.all(imgs.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }));
}

document.addEventListener("DOMContentLoaded", async () => {
  initNavToggle();
  initHeaderScroll();
  try {
    const [site, workshops, gallery] = await Promise.all([
      loadJSON("/content/site.json"),
      loadJSON("/content/workshops.json").catch(() => ({ items: [] })),
      loadJSON("/content/gallery.json").catch(() => ({ items: [] })),
    ]);
    fillText(document, site);
    initHeroFallback(site);
    renderNews(document, workshops);
    await renderGallery(document, gallery);
    await waitForImages();
    reapplyHashScroll();
  } catch (err) {
    console.error(err);
  }
});
