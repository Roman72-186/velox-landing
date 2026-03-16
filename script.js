/*
 * ═══════════════════════════════════════════════
 *  VELOX — Landing Page Scripts
 * ═══════════════════════════════════════════════
 *  Module 1: 3D Cube Animation (Three.js r128)
 *  Module 2: i18n (10 languages)
 *  Module 3: UI Interactions (lang dropdown)
 * ═══════════════════════════════════════════════
 */

/* ═══ MODULE 1: 3D Cube Animation ═══ */

(function() {
  const canvas = document.getElementById('heroCanvas');
  const W = 480, H = 480;

  // ── Three.js scene ──────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(4.5, 3.2, 5.5);
  camera.lookAt(0, 0, 0);

  // ── Lighting ─────────────────────────────────────────────
  // Very dim ambient — almost black
  const ambient = new THREE.AmbientLight(0x0a0f14, 1.0);
  scene.add(ambient);

  // Key light: cold blue-white from top-left front
  const keyLight = new THREE.DirectionalLight(0xc8e8ff, 1.6);
  keyLight.position.set(-3, 6, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  // Rim light: very faint blue from behind-right
  const rimLight = new THREE.DirectionalLight(0x40c4ff, 0.25);
  rimLight.position.set(4, -1, -3);
  scene.add(rimLight);

  // Fill light: barely visible, warm-neutral from below
  const fillLight = new THREE.DirectionalLight(0x111111, 0.4);
  fillLight.position.set(2, -4, 2);
  scene.add(fillLight);

  // ── Materials ─────────────────────────────────────────────
  // Dark base: almost pure black with slight roughness variation
  const matBase = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.75,
    metalness: 0.6,
  });

  // Slightly lighter face for top
  const matTop = new THREE.MeshStandardMaterial({
    color: 0x111418,
    roughness: 0.55,
    metalness: 0.7,
  });

  // Accent: very subtle blue tint for front face
  const matFront = new THREE.MeshStandardMaterial({
    color: 0x0c1018,
    roughness: 0.6,
    metalness: 0.65,
  });

  // Edge frame material - dark chrome
  const matEdge = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.3,
    metalness: 0.9,
  });

  // ── Build 3×3×3 Rubik-style cube ─────────────────────────
  const GRID = 3;
  const CELL = 0.9;       // cell size
  const GAP  = 0.04;      // gap between cells
  const STEP = CELL + GAP;
  const OFFSET = -STEP;   // center the 3×3×3 group

  const cubeGroup = new THREE.Group();

  // Per-face material assignment [+X, -X, +Y, -Y, +Z, -Z]
  // We'll use matTop for +Y, matFront for +Z, matBase for rest
  function makeFaceMaterials() {
    return [
      matBase.clone(),   // +X right
      matBase.clone(),   // -X left
      matTop.clone(),    // +Y top
      matBase.clone(),   // -Y bottom
      matFront.clone(),  // +Z front
      matBase.clone(),   // -Z back
    ];
  }

  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      for (let z = 0; z < GRID; z++) {
        const geo = new THREE.BoxGeometry(CELL, CELL, CELL, 1, 1, 1);
        const mats = makeFaceMaterials();

        // Slightly vary roughness/metalness per cell for texture
        mats.forEach(m => {
          m.roughness  += (Math.random() - 0.5) * 0.12;
          m.metalness  += (Math.random() - 0.5) * 0.10;
          m.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.018);
        });

        const mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(
          OFFSET + x * STEP,
          OFFSET + y * STEP,
          OFFSET + z * STEP
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        cubeGroup.add(mesh);
      }
    }
  }

  // ── Thin edge lines on the outer shell ───────────────────
  const edgeGeo = new THREE.BoxGeometry(STEP * GRID, STEP * GRID, STEP * GRID);
  const edgesGeo = new THREE.EdgesGeometry(edgeGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x1e2630,
    transparent: true,
    opacity: 0.6,
  });
  const edgeMesh = new THREE.LineSegments(edgesGeo, edgeMat);
  cubeGroup.add(edgeMesh);

  // ── Very faint glow plane (shadow/reflection) below cube ─
  const planeGeo = new THREE.PlaneGeometry(8, 8);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -2.4;
  plane.receiveShadow = true;
  scene.add(plane);

  scene.add(cubeGroup);

  // ── Initial rotation ──────────────────────────────────────
  cubeGroup.rotation.x = 0.38;
  cubeGroup.rotation.y = 0.62;

  // ── Animation loop ────────────────────────────────────────
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.004;

    // Slow primary rotation Y axis
    cubeGroup.rotation.y += 0.003;

    // Very gentle breathing on X
    cubeGroup.rotation.x = 0.38 + Math.sin(t * 0.4) * 0.04;

    // Subtle float
    cubeGroup.position.y = Math.sin(t * 0.5) * 0.06;

    renderer.render(scene, camera);
  }
  animate();

  // ── Resize handling ───────────────────────────────────────
  window.addEventListener('resize', () => {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const size = Math.min(wrap.clientWidth, wrap.clientHeight, 480);
    renderer.setSize(size, size);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  });
})();
/* ═══ MODULE 2: i18n — 10 languages ═══ */

// ─── i18n: 10 languages ──────────────────────────────────
const TRANSLATIONS = {
  ru: {
    hero_badge:'Доступны для новых проектов',
    hero_title:'Разработка<br>цифровых<br><span class="highlight">продуктов</span>',
    hero_sub:'Запускаем цифровые продукты за 4–12 недель —<br>вы фокусируетесь на бизнесе, мы на коде.',
    btn_discuss:'Обсудить проект',
    btn_how:'Как мы работаем ↓',
    trust_label:'Нам доверяют команды из',
    stat1:'Продуктов запущено', stat2:'Недель — средний MVP',
    stat3:'В рамках бюджета', stat4:'Недель до запуска',
    sec_services_tag:'Что мы делаем', sec_services_h:'Полный цикл разработки',
    sec_process_tag:'Как мы работаем', sec_process_h:'От идеи до production',
    sec_stack_tag:'Технологии', sec_stack_h:'Production-grade стек',
    sec_projects_tag:'Кейсы', sec_projects_h:'Реальные результаты',
    sec_ai_tag:'ИИ-интеграции', sec_ai_h:'Умные продукты — быстрее',
    sec_contact_tag:'Связаться', sec_contact_h:'Обсудим ваш проект',
    btn_submit:'Получить бесплатный расчёт →',
    footer_copy:'© 2026 VELOX. Разработка цифровых продуктов.',
    nav_services:'Услуги', nav_process:'Процесс', nav_stack:'Стек',
    nav_projects:'Проекты', nav_ai:'ИИ', nav_cta:'Обсудить проект',
  },
  en: {
    hero_badge:'Available for new projects',
    hero_title:'Building digital<br>products<br><span class="highlight">end-to-end</span>',
    hero_sub:'We launch digital products in 4–12 weeks —<br>you focus on business, we handle the code.',
    btn_discuss:'Discuss a project',
    btn_how:'How we work ↓',
    trust_label:'Trusted by teams in',
    stat1:'Products launched', stat2:'Weeks — avg MVP',
    stat3:'On budget', stat4:'Weeks to launch',
    sec_services_tag:'What we do', sec_services_h:'Full-cycle development',
    sec_process_tag:'How we work', sec_process_h:'From idea to production',
    sec_stack_tag:'Technology', sec_stack_h:'Production-grade stack',
    sec_projects_tag:'Case studies', sec_projects_h:'Real results',
    sec_ai_tag:'AI integrations', sec_ai_h:'Smarter products, faster',
    sec_contact_tag:'Contact', sec_contact_h:'Let's talk about your project',
    btn_submit:'Get a free estimate →',
    footer_copy:'© 2026 VELOX. Digital product development.',
    nav_services:'Services', nav_process:'Process', nav_stack:'Stack',
    nav_projects:'Projects', nav_ai:'AI', nav_cta:'Discuss a project',
  },
  'en-gb': {
    hero_badge:'Available for new projects',
    hero_title:'Building digital<br>products<br><span class="highlight">end-to-end</span>',
    hero_sub:'We launch digital products in 4–12 weeks —<br>you focus on business, we handle the code.',
    
    btn_discuss:'Discuss a project',
    btn_how:'How we work ↓',
    trust_label:'Trusted by teams in',
    stat1:'Products launched', stat2:'Weeks — avg MVP',
    stat3:'On budget', stat4:'Weeks to launch',
    sec_services_tag:'What we do', sec_services_h:'Full-cycle development',
    sec_process_tag:'How we work', sec_process_h:'From idea to production',
    sec_stack_tag:'Technology', sec_stack_h:'Production-grade stack',
    sec_projects_tag:'Case studies', sec_projects_h:'Real results',
    sec_ai_tag:'AI integrations', sec_ai_h:'Smarter products, faster',
    sec_contact_tag:'Contact', sec_contact_h:'Let's discuss your project',
    btn_submit:'Get a free quote →',
    footer_copy:'© 2026 VELOX. Digital product development.',
    nav_services:'Services', nav_process:'Process', nav_stack:'Stack',
    nav_projects:'Projects', nav_ai:'AI', nav_cta:'Discuss a project',
  },
  fr: {
    hero_badge:'Disponibles pour de nouveaux projets',
    hero_title:'Développement de<br>produits<br><span class="highlight">numériques</span>',
    hero_sub:'Nous lançons des produits numériques en 4 à 12 semaines —<br>vous vous concentrez sur le business, nous sur le code.',
    
    btn_discuss:'Discuter du projet',
    btn_how:'Notre méthode ↓',
    trust_label:'Des équipes nous font confiance dans',
    stat1:'Produits lancés', stat2:'Semaines — MVP moyen',
    stat3:'Dans le budget', stat4:'Semaines jusqu'au lancement',
    sec_services_tag:'Ce que nous faisons', sec_services_h:'Développement complet',
    sec_process_tag:'Notre méthode', sec_process_h:'De l'idée à la production',
    sec_stack_tag:'Technologies', sec_stack_h:'Stack production-grade',
    sec_projects_tag:'Études de cas', sec_projects_h:'Résultats concrets',
    sec_ai_tag:'Intégrations IA', sec_ai_h:'Des produits plus intelligents',
    sec_contact_tag:'Contact', sec_contact_h:'Parlons de votre projet',
    btn_submit:'Obtenir un devis gratuit →',
    footer_copy:'© 2026 VELOX. Développement de produits numériques.',
    nav_services:'Services', nav_process:'Processus', nav_stack:'Stack',
    nav_projects:'Projets', nav_ai:'IA', nav_cta:'Discuter du projet',
  },
  de: {
    hero_badge:'Offen für neue Projekte',
    hero_title:'Entwicklung digitaler<br><span class="highlight">Produkte</span><br>aus einer Hand',
    hero_sub:'Wir launchen digitale Produkte in 4–12 Wochen —<br>Sie konzentrieren sich aufs Business, wir auf den Code.',
    
    btn_discuss:'Projekt besprechen',
    btn_how:'Unsere Methode ↓',
    trust_label:'Teams vertrauen uns aus',
    stat1:'Produkte gelauncht', stat2:'Wochen — Ø MVP',
    stat3:'Im Budget', stat4:'Wochen bis zum Launch',
    sec_services_tag:'Was wir tun', sec_services_h:'Vollständige Entwicklung',
    sec_process_tag:'Unsere Methode', sec_process_h:'Von der Idee zur Produktion',
    sec_stack_tag:'Technologien', sec_stack_h:'Production-grade Stack',
    sec_projects_tag:'Fallstudien', sec_projects_h:'Echte Ergebnisse',
    sec_ai_tag:'KI-Integrationen', sec_ai_h:'Klügere Produkte, schneller',
    sec_contact_tag:'Kontakt', sec_contact_h:'Sprechen wir über Ihr Projekt',
    btn_submit:'Kostenloses Angebot →',
    footer_copy:'© 2026 VELOX. Digitale Produktentwicklung.',
    nav_services:'Leistungen', nav_process:'Prozess', nav_stack:'Stack',
    nav_projects:'Projekte', nav_ai:'KI', nav_cta:'Projekt besprechen',
  },
  es: {
    hero_badge:'Disponibles para nuevos proyectos',
    hero_title:'Desarrollo de<br>productos<br><span class="highlight">digitales</span>',
    hero_sub:'Lanzamos productos digitales en 4–12 semanas —<br>tú te enfocas en el negocio, nosotros en el código.',
    
    btn_discuss:'Hablar del proyecto',
    btn_how:'Cómo trabajamos ↓',
    trust_label:'Equipos confían en nosotros de',
    stat1:'Productos lanzados', stat2:'Semanas — MVP promedio',
    stat3:'Dentro del presupuesto', stat4:'Semanas hasta el lanzamiento',
    sec_services_tag:'Qué hacemos', sec_services_h:'Desarrollo completo',
    sec_process_tag:'Cómo trabajamos', sec_process_h:'De la idea a producción',
    sec_stack_tag:'Tecnologías', sec_stack_h:'Stack production-grade',
    sec_projects_tag:'Casos de éxito', sec_projects_h:'Resultados reales',
    sec_ai_tag:'Integraciones de IA', sec_ai_h:'Productos más inteligentes',
    sec_contact_tag:'Contacto', sec_contact_h:'Hablemos de tu proyecto',
    btn_submit:'Obtener presupuesto gratuito →',
    footer_copy:'© 2026 VELOX. Desarrollo de productos digitales.',
    nav_services:'Servicios', nav_process:'Proceso', nav_stack:'Stack',
    nav_projects:'Proyectos', nav_ai:'IA', nav_cta:'Hablar del proyecto',
  },
  ca: {
    hero_badge:'Disponibles per a nous projectes',
    hero_title:'Desenvolupament de<br>productes<br><span class="highlight">digitals</span>',
    hero_sub:'Llancem productes digitals en 4–12 setmanes —<br>tu et centres en el negoci, nosaltres en el codi.',
    btn_discuss:'Parlar del projecte',
    btn_how:'Com treballem ↓',
    trust_label:'Equips confien en nosaltres de',
    stat1:'Productes llançats', stat2:'Setmanes — MVP mitjà',
    stat3:'Dins el pressupost', stat4:'Setmanes fins al llançament',
    sec_services_tag:'Què fem', sec_services_h:'Desenvolupament complet',
    sec_process_tag:'Com treballem', sec_process_h:'De la idea a producció',
    sec_stack_tag:'Tecnologies', sec_stack_h:'Stack production-grade',
    sec_projects_tag:'Casos d'èxit', sec_projects_h:'Resultats reals',
    sec_ai_tag:'Integracions d'IA', sec_ai_h:'Productes més intel·ligents',
    sec_contact_tag:'Contacte', sec_contact_h:'Parlem del teu projecte',
    btn_submit:'Obtenir pressupost gratuït →',
    footer_copy:'© 2026 VELOX. Desenvolupament de productes digitals.',
    nav_services:'Serveis', nav_process:'Procés', nav_stack:'Stack',
    nav_projects:'Projectes', nav_ai:'IA', nav_cta:'Parlar del projecte',
  },
  pl: {
    hero_badge:'Dostępni na nowe projekty',
    hero_title:'Tworzenie produktów<br><span class="highlight">cyfrowych</span><br>od A do Z',
    hero_sub:'Uruchamiamy produkty cyfrowe w 4–12 tygodni —<br>Ty skupiasz się na biznesie, my na kodzie.',
    btn_discuss:'Porozmawiaj o projekcie',
    btn_how:'Jak pracujemy ↓',
    trust_label:'Zaufały nam zespoły z',
    stat1:'Produktów uruchomionych', stat2:'Tygodnie — średnie MVP',
    stat3:'W budżecie', stat4:'Tygodnie do launchu',
    sec_services_tag:'Co robimy', sec_services_h:'Pełny cykl tworzenia',
    sec_process_tag:'Jak pracujemy', sec_process_h:'Od pomysłu do produkcji',
    sec_stack_tag:'Technologie', sec_stack_h:'Stack klasy produkcyjnej',
    sec_projects_tag:'Case study', sec_projects_h:'Realne wyniki',
    sec_ai_tag:'Integracje AI', sec_ai_h:'Inteligentniejsze produkty',
    sec_contact_tag:'Kontakt', sec_contact_h:'Porozmawiajmy o Twoim projekcie',
    btn_submit:'Bezpłatna wycena →',
    footer_copy:'© 2026 VELOX. Tworzenie produktów cyfrowych.',
    nav_services:'Usługi', nav_process:'Proces', nav_stack:'Stack',
    nav_projects:'Projekty', nav_ai:'AI', nav_cta:'Porozmawiaj o projekcie',
  },
  ar: {
    hero_badge:'متاحون لمشاريع جديدة',
    hero_title:'تطوير المنتجات<br><span class="highlight">الرقمية</span><br>بالكامل',
    hero_sub:'نطلق المنتجات الرقمية في 4–12 أسبوعاً —<br>أنت تركز على العمل، ونحن نتولى الكود.',
    btn_discuss:'ناقش مشروعك',
    btn_how:'كيف نعمل ↓',
    trust_label:'فرق تثق بنا من',
    stat1:'منتجاً تم إطلاقه', stat2:'أسابيع متوسط MVP',
    stat3:'ضمن الميزانية', stat4:'أسابيع حتى الإطلاق',
    sec_services_tag:'ما نفعله', sec_services_h:'تطوير متكامل',
    sec_process_tag:'كيف نعمل', sec_process_h:'من الفكرة إلى الإنتاج',
    sec_stack_tag:'التقنيات', sec_stack_h:'Stack للإنتاج',
    sec_projects_tag:'دراسات الحالة', sec_projects_h:'نتائج حقيقية',
    sec_ai_tag:'تكاملات الذكاء الاصطناعي', sec_ai_h:'منتجات أذكى وأسرع',
    sec_contact_tag:'تواصل معنا', sec_contact_h:'تحدث عن مشروعك',
    btn_submit:'احصل على تقدير مجاني ←',
    footer_copy:'© 2026 VELOX. تطوير المنتجات الرقمية.',
    nav_services:'الخدمات', nav_process:'العملية', nav_stack:'التقنيات',
    nav_projects:'المشاريع', nav_ai:'الذكاء الاصطناعي', nav_cta:'ناقش مشروعك',
  },
  ja: {
    hero_badge:'新規プロジェクト受付中',
    hero_title:'デジタル製品の<br>開発を<br><span class="highlight">お任せください</span>',
    hero_sub:'4〜12週間でデジタル製品をローンチ —<br>ビジネスに集中、コードは私たちにお任せ。',
    btn_discuss:'プロジェクトを相談',
    btn_how:'開発プロセス ↓',
    trust_label:'信頼されるチーム',
    stat1:'リリース済みプロダクト', stat2:'週：平均MVP期間',
    stat3:'予算内完了率', stat4:'週でローンチ',
    sec_services_tag:'サービス内容', sec_services_h:'フルサイクル開発',
    sec_process_tag:'開発プロセス', sec_process_h:'アイデアから本番環境へ',
    sec_stack_tag:'技術スタック', sec_stack_h:'プロダクショングレードの技術',
    sec_projects_tag:'実績', sec_projects_h:'実際の成果',
    sec_ai_tag:'AI統合', sec_ai_h:'スマートな製品を、より早く',
    sec_contact_tag:'お問い合わせ', sec_contact_h:'プロジェクトについて話しましょう',
    btn_submit:'無料見積もりを取得 →',
    footer_copy:'© 2026 VELOX. デジタルプロダクト開発。',
    nav_services:'サービス', nav_process:'プロセス', nav_stack:'スタック',
    nav_projects:'実績', nav_ai:'AI', nav_cta:'相談する',
  },
};

// Nav link keys in order
const NAV_KEYS = ['nav_services','nav_process','nav_stack','nav_projects','nav_ai'];

let currentLang = 'ru';

function applyLang(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  // Translate all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // Nav links (data-ru / data-ja approach replaced by full i18n)
  const navLinks = document.querySelectorAll('.nav-links a:not(.nav-cta)');
  navLinks.forEach((a, i) => {
    const key = NAV_KEYS[i];
    if (key && t[key]) a.textContent = t[key];
  });

  // RTL for Arabic
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  // Update dropdown button label
  const labels = {
    ru:'RU', en:'EN', 'en-gb':'GB', fr:'FR', de:'DE',
    es:'ES', ca:'CA', pl:'PL', ar:'AR', ja:'JA'
  };
  const cur = document.getElementById('langCurrent');
  if (cur) cur.textContent = labels[lang] || lang.toUpperCase();

  // Mark active option
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  currentLang = lang;
  localStorage.setItem('lang', lang);
}

function toggleLangMenu() {
  const menu  = document.getElementById('langMenu');
  const arrow = document.getElementById('langArrow');
  const isOpen = menu.classList.toggle('open');
  arrow.classList.toggle('open', isOpen);
}

function setLang(lang) {
  applyLang(lang);
  // Close menu
  document.getElementById('langMenu').classList.remove('open');
  document.getElementById('langArrow').classList.remove('open');
}

// Close on outside click
document.addEventListener('click', e => {
  const dropdown = document.getElementById('langDropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    document.getElementById('langMenu').classList.remove('open');
    document.getElementById('langArrow').classList.remove('open');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  applyLang(localStorage.getItem('lang') || 'en');

  // ─── Burger menu ───
  const burger = document.getElementById('burgerBtn');
  const navLinks = document.getElementById('navLinks');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('open');
      navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', isOpen);
    });
    // Close burger on nav link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('open');
        navLinks.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
});
