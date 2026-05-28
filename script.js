/*
 * ═══════════════════════════════════════════════
 *  Queen of Spades Tech — Landing Page Scripts
 * ═══════════════════════════════════════════════
 *  Module 1: 3D Gyroscope animation (Three.js r128)
 *  Module 2: i18n (10 languages)
 *  Module 3: UI Interactions (lang dropdown)
 * ═══════════════════════════════════════════════
 */

/* ═══ MODULE 1: 3D Gyroscope — Armillary Sphere ═══ */
(function () {
  if (typeof THREE === 'undefined') return;

  var container = document.getElementById('hero-3d');
  var canvas = document.getElementById('heroCanvas');
  if (!container || !canvas) return;

  // ─── CONFIG ───
  var CONFIG = {
    camera: { fov: 45, near: 0.1, far: 100, z: 10 },
    lights: {
      ambientIntensity: 1.2,
      dir1Color: 0xeaf3ff, dir1Intensity: 3.0, dir1Position: { x: 5, y: 6, z: 7 },
      dir2Color: 0x8aa8ff, dir2Intensity: 2.0, dir2Position: { x: -6, y: -3, z: 4 },
      dir3Color: 0xffffff, dir3Intensity: 1.5, dir3Position: { x: 0, y: -5, z: 3 },
      point1Color: 0xffffff, point1Intensity: 2.5, point1Distance: 50, point1Position: { x: 0, y: 2, z: 8 }
    },
    materials: {
      metalLight: { color: 0xdce9ff, metalness: 1, roughness: 0.16 },
      metalDark:  { color: 0x162131, metalness: 1, roughness: 0.20 }
    },
    rings: [
      { radius: 2.60, width: 0.51, height: 0.20, material: 'dark',  initialRotation: { x: 0, y: 0, z: 0 },           gimbalAxis: [0, 1, 0],         gimbalSpeed: 0.3  },
      { radius: 2.10, width: 0.33, height: 0.13, material: 'light', initialRotation: { x: 1.5708, y: 0, z: 0 },       gimbalAxis: [1, 0, 0],         gimbalSpeed: 0.25 },
      { radius: 1.75, width: 0.24, height: 0.11, material: 'light', initialRotation: { x: 0.7854, y: 0.7854, z: 0 },  gimbalAxis: [0.707, 0.707, 0], gimbalSpeed: 0.2  },
      { radius: 1.45, width: 0.29, height: 0.09, material: 'dark',  initialRotation: { x: 0, y: 0.7854, z: 1.0472 },  gimbalAxis: [0, 0.707, 0.707], gimbalSpeed: 0.35 },
      { radius: 1.15, width: 0.20, height: 0.08, material: 'light', initialRotation: { x: 1.0472, y: 0, z: 0.7854 },  gimbalAxis: [0.707, 0, 0.707], gimbalSpeed: 0.25 }
    ]
  };

  // ─── Scene / Camera / Renderer ───
  var scene = new THREE.Scene();
  // No scene.background → transparent (alpha: true)

  var w = container.clientWidth;
  var h = container.clientHeight;

  var camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, w / h, CONFIG.camera.near, CONFIG.camera.far);
  camera.position.set(0, 0, CONFIG.camera.z);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // ─── Lights ───
  scene.add(new THREE.AmbientLight(0xffffff, CONFIG.lights.ambientIntensity));

  var dir1 = new THREE.DirectionalLight(CONFIG.lights.dir1Color, CONFIG.lights.dir1Intensity);
  dir1.position.set(CONFIG.lights.dir1Position.x, CONFIG.lights.dir1Position.y, CONFIG.lights.dir1Position.z);
  scene.add(dir1);

  var dir2 = new THREE.DirectionalLight(CONFIG.lights.dir2Color, CONFIG.lights.dir2Intensity);
  dir2.position.set(CONFIG.lights.dir2Position.x, CONFIG.lights.dir2Position.y, CONFIG.lights.dir2Position.z);
  scene.add(dir2);

  var dir3 = new THREE.DirectionalLight(CONFIG.lights.dir3Color, CONFIG.lights.dir3Intensity);
  dir3.position.set(CONFIG.lights.dir3Position.x, CONFIG.lights.dir3Position.y, CONFIG.lights.dir3Position.z);
  scene.add(dir3);

  var point1 = new THREE.PointLight(CONFIG.lights.point1Color, CONFIG.lights.point1Intensity, CONFIG.lights.point1Distance);
  point1.position.set(CONFIG.lights.point1Position.x, CONFIG.lights.point1Position.y, CONFIG.lights.point1Position.z);
  scene.add(point1);

  // ─── Materials ───
  var materialMetalLight = new THREE.MeshStandardMaterial(CONFIG.materials.metalLight);
  var materialMetalDark  = new THREE.MeshStandardMaterial(CONFIG.materials.metalDark);

  // ─── Circle curve for rings (ES6 class — required by Three.js r128) ───
  class CircleCurve extends THREE.Curve {
    constructor(radius) {
      super();
      this.radius = radius;
    }
    getPoint(t) {
      var a = t * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * this.radius, Math.sin(a) * this.radius, 0);
    }
  }

  // ─── Helpers ───
  function createRectShape(width, height, cornerRadius) {
    var shape = new THREE.Shape();
    var hw = width / 2, hh = height / 2;
    var r = Math.min(cornerRadius || 0, hw, hh);
    if (r <= 0) {
      shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
    } else {
      shape.moveTo(-hw + r, -hh);
      shape.lineTo(hw - r, -hh);  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
      shape.lineTo(hw, hh - r);   shape.quadraticCurveTo(hw, hh, hw - r, hh);
      shape.lineTo(-hw + r, hh);  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
      shape.lineTo(-hw, -hh + r); shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    }
    return shape;
  }

  function createRectRing(radius, width, height, material, steps) {
    var shape = createRectShape(width, height, 0.06);
    var path = new CircleCurve(radius);
    var geometry = new THREE.ExtrudeGeometry(shape, { steps: steps, bevelEnabled: false, extrudePath: path });
    geometry.center();
    return new THREE.Mesh(geometry, material);
  }

  // ─── Create rings ───
  var isMobile = window.innerWidth < 768;
  var ringSteps = isMobile ? 130 : 260;
  var rings = [];

  CONFIG.rings.forEach(function (cfg) {
    var mat = cfg.material === 'dark' ? materialMetalDark : materialMetalLight;
    var ring = createRectRing(cfg.radius, cfg.width, cfg.height, mat, ringSteps);
    var axis = new THREE.Vector3(cfg.gimbalAxis[0], cfg.gimbalAxis[1], cfg.gimbalAxis[2]).normalize();
    ring.rotation.set(cfg.initialRotation.x, cfg.initialRotation.y, cfg.initialRotation.z);
    ring.userData = {
      gimbalAxis: axis,
      gimbalSpeed: cfg.gimbalSpeed,
      initialQuaternion: ring.quaternion.clone()
    };
    scene.add(ring);
    rings.push(ring);
  });

  // ─── Animation (seamless loop) ───
  var clock = new THREE.Clock();
  var LOOP_DURATION = 40 * Math.PI; // ~126 sec
  var _gimbalQuat = new THREE.Quaternion();
  var animationId = null;
  var isVisible = true;

  function animate() {
    if (!isVisible) { animationId = null; return; }
    animationId = requestAnimationFrame(animate);

    var t = clock.getElapsedTime();
    var loopT = t % LOOP_DURATION;

    rings.forEach(function (ring) {
      var angle = ring.userData.gimbalSpeed * loopT;
      _gimbalQuat.setFromAxisAngle(ring.userData.gimbalAxis, angle);
      ring.quaternion.copy(ring.userData.initialQuaternion).multiply(_gimbalQuat);
    });

    renderer.render(scene, camera);
  }

  // ─── IntersectionObserver — stop render off-screen ───
  var visibilityObserver = new IntersectionObserver(function (entries) {
    isVisible = entries[0].isIntersecting;
    if (isVisible && !animationId) animate();
  }, { threshold: 0.1 });
  visibilityObserver.observe(container);

  animate();

  // ─── ResizeObserver — adapt to container size ───
  var resizeObserver = new ResizeObserver(function () {
    var cw = container.clientWidth;
    var ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
  resizeObserver.observe(container);
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
    sec_services_desc:'От архитектуры до деплоя. Специализируемся на продуктах, которые масштабируются и монетизируются.',
    svc1_name:'MVP за 4–8 недель', svc1_desc:'Быстрое создание минимального жизнеспособного продукта с основными функциями, интеграцией данных и тестированием на рынке. Запускаем без лишних затрат — только то, что нужно для проверки гипотезы.', svc1_tag:'Time-to-market',
    svc2_name:'SaaS-платформы', svc2_desc:'Масштабируемые платформы с подписками, защищённым хранением данных и аналитикой пользователей. Идеально для стартапов и малого бизнеса с планами на рост.', svc2_tag:'Масштабируемо',
    svc3_name:'Маркетплейсы', svc3_desc:'Системы с каталогами товаров, онлайн-платежами, отзывами и модерацией. Соединяем продавцов и покупателей через надёжную инфраструктуру.', svc3_tag:'B2B / B2C',
    svc4_name:'Админ-панели и дашборды', svc4_desc:'Удобные интерфейсы для управления данными с гибкими ролями доступа, дашбордами и аналитикой в реальном времени. Ваша команда работает эффективнее.', svc4_tag:'Role-based',
    svc5_name:'Автоматизация', svc5_desc:'Скрипты и системы, которые упрощают рутинные задачи, интегрируются с существующими инструментами и экономят время вашей команды. Меньше ручной работы — больше результатов.', svc5_tag:'No-ops',
    svc6_name:'ИИ-интеграции', svc6_desc:'Добавляем умные функции: чат-боты, анализ данных, RAG-системы, автоклассификация. Ваш продукт становится конкурентнее без переписывания с нуля.', svc6_tag:'AI-first',
    sec_process_tag:'Как мы работаем', sec_process_h:'От идеи до production',
    sec_process_desc:'Прозрачный процесс, предсказуемые сроки. Никаких сюрпризов — только рабочий продукт.',
    step1_title:'Discovery и User Stories', step1_desc:'Погружаемся в идею, пишем пользовательские истории (что реально нужно юзеру) и создаём API-first дизайн. Всё работает слаженно через чёткие интерфейсы с первого дня.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Архитектура и стек', step2_desc:'Выбираем подход, где всё масштабируется. Event-driven или microservices-ready — зависит от ваших целей роста.', step2_tag1:'Event-driven', step2_tag2:'Микросервисы', step2_tag3:'Cloud-native',
    step3_title:'Спринт-разработка', step3_desc:'Короткие 2-недельные итерации. Trunk-based разработка и feature flags — новые фичи включаются без риска для стабильности.', step3_tag1:'2-недельные спринты', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD и безопасность', step4_desc:'Автоматические обновления с zero downtime с первого дня. OWASP Top 10 и сканирование зависимостей — безопасность встроена, а не прикручена.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Запуск и передача', step5_desc:'Observability из коробки — OpenTelemetry + Prometheus/Grafana. Вы видите, где узкие места. Полная передача с документацией и обучением команды.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Типичный таймлайн MVP', timeline_phase1:'Исследование', timeline_phase2:'Архитектура и дизайн', timeline_phase3:'Разработка (спринты)', timeline_phase4:'QA и безопасность', timeline_phase5:'Запуск',
    sec_stack_tag:'Технологии', sec_stack_h:'Production-grade стек',
    sec_stack_desc:'Проверенные инструменты, никакого хайпа. Каждый выбор осознан.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Инфраструктура и DevOps', stack_cat4:'AI & ML',
    sec_projects_tag:'Кейсы', sec_projects_h:'Реальные результаты',
    sec_projects_desc:'Анонимные кейсы наших клиентов. Реальные цифры, реальные сроки.',
    proj1_type:'B2B SaaS · Автоматизация', proj1_title:'Платформа для управления операциями', proj1_desc:'CRM-подобная система для B2B компании с 50+ сотрудниками. Автоматизация рутинных задач, интеграция с ERP, дашборды для менеджеров в реальном времени. Полный цикл: discovery → production.',
    proj2_type:'Маркетплейс · B2C', proj2_title:'Маркетплейс профессиональных услуг', proj2_desc:'Платформа для фрилансеров и клиентов со встроенным эскроу, отзывами, видео-презентациями и AI-подбором талантов по запросу.',
    proj3_type:'SaaS · EdTech', proj3_title:'LMS-платформа для корпоративного обучения', proj3_desc:'Система управления обучением с тестами, сертификатами, аналитикой прогресса и интеграцией с HR-системой. Мультитенантная архитектура.',
    metric_weeks:'Недель', metric_budget:'Бюджет', metric_users:'Юзеров за 2 месяца', metric_manual:'Ручной работы',
    metric_signups:'Регистраций за 1 мес', metric_rating:'Рейтинг юзеров', metric_clients:'Корп. клиентов', metric_trained:'Обучено сотрудников',
    sec_ai_tag:'ИИ-интеграции', sec_ai_h:'Умные продукты — быстрее',
    sec_ai_desc:'Не переписываем ваш продукт с нуля. Встраиваем ИИ там, где он даёт максимум отдачи.',
    ai1_title:'RAG-системы', ai1_desc:'Точные ответы на основе ваших данных. Бот, который знает вашу документацию, договоры или базу знаний — без галлюцинаций.',
    ai2_title:'Кастомные ассистенты', ai2_desc:'Чат-боты с характером вашего бренда, встроенные в ваш продукт. Поддержка, продажи, онбординг — 24/7 без роста команды.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'Дотренируем модели на ваших данных. Специализированный ИИ для медицины, юриспруденции, финансов или любой другой ниши.',
    ai4_title:'Голосовые интерфейсы', ai4_desc:'Whisper + LLM + TTS — голосовые боты для колл-центров, поиска и автоматизации звонков. Работает на 40+ языках.',
    sec_contact_tag:'Связаться', sec_contact_h:'Обсудим ваш проект',
    sec_contact_desc:'Бесплатная оценка стоимости и сроков в течение 24 часов. Без обязательств.',
    contact_subtitle:'Начнём с разговора', contact_text:'Расскажите о своей идее — и мы оценим сроки, стоимость и техническую сторону. Первая консультация бесплатна и ни к чему не обязывает.',
    form_type_label:'Тип проекта', form_select_placeholder:'Выберите...', form_opt_saas:'SaaS-платформа', form_opt_marketplace:'Маркетплейс', form_opt_admin:'Админ-панель', form_opt_automation:'Автоматизация', form_opt_ai:'ИИ-интеграция', form_opt_other:'Другое',
    form_desc_label:'Описание проекта', form_desc_placeholder:'Расскажите о вашей идее, целевой аудитории и ключевых функциях...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'Отвечаем в течение 24 часов · Никакого спама · Полная конфиденциальность',
    btn_submit:'Получить бесплатный расчёт →',
    footer_copy:'© 2026 Queen of Spades Tech. Разработка цифровых продуктов.',
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
    sec_services_desc:'From architecture to deployment. We specialize in products that scale and monetize.',
    svc1_name:'MVP in 4–8 weeks', svc1_desc:'Rapid creation of a minimum viable product with core features, data integration, and market testing. We launch without unnecessary costs — only what\'s needed to validate your hypothesis.', svc1_tag:'Time-to-market',
    svc2_name:'SaaS Platforms', svc2_desc:'Scalable platforms with subscriptions, secure data storage, and user analytics. Perfect for startups and small businesses with growth plans.', svc2_tag:'Scalable',
    svc3_name:'Marketplaces', svc3_desc:'Systems with product catalogs, online payments, reviews, and moderation. We connect sellers and buyers through reliable infrastructure.', svc3_tag:'B2B / B2C',
    svc4_name:'Admin Panels & Dashboards', svc4_desc:'User-friendly interfaces for data management with flexible access roles, dashboards, and real-time analytics. Your team works more efficiently.', svc4_tag:'Role-based',
    svc5_name:'Automation', svc5_desc:'Scripts and systems that simplify routine tasks, integrate with existing tools, and save your team\'s time. Less manual work — more results.', svc5_tag:'No-ops',
    svc6_name:'AI Integrations', svc6_desc:'We add smart features: chatbots, data analysis, RAG systems, auto-classification. Your product becomes more competitive without rewriting from scratch.', svc6_tag:'AI-first',
    sec_process_tag:'How we work', sec_process_h:'From idea to production',
    sec_process_desc:'Transparent process, predictable timelines. No surprises — just a working product.',
    step1_title:'Discovery & User Stories', step1_desc:'We dive into the idea, write user stories (what the user actually needs) and create an API-first design. Everything works smoothly through clear interfaces from day one.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Architecture & Stack', step2_desc:'We choose an approach where everything scales. Event-driven or microservices-ready — depending on your growth goals.', step2_tag1:'Event-driven', step2_tag2:'Microservices', step2_tag3:'Cloud-native',
    step3_title:'Sprint-based Development', step3_desc:'Short 2-week iterations. Trunk-based development and feature flags — new features are toggled on without risking stability.', step3_tag1:'2-week sprints', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD & Security', step4_desc:'Automatic updates with zero downtime from day one. OWASP Top 10 and dependency scanning — security is built in, not bolted on.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Launch & Handoff', step5_desc:'Observability out of the box — OpenTelemetry + Prometheus/Grafana. You can see where bottlenecks are. Full handoff with documentation and team training.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Typical MVP timeline', timeline_phase1:'Discovery', timeline_phase2:'Architecture & design', timeline_phase3:'Development (sprints)', timeline_phase4:'QA & security', timeline_phase5:'Launch',
    sec_stack_tag:'Technology', sec_stack_h:'Production-grade stack',
    sec_stack_desc:'Battle-tested tools, no hype. Every choice is intentional.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infrastructure & DevOps', stack_cat4:'AI & ML',
    sec_projects_tag:'Case studies', sec_projects_h:'Real results',
    sec_projects_desc:'Anonymous case studies from our clients. Real numbers, real timelines.',
    proj1_type:'B2B SaaS · Automation', proj1_title:'Operations management platform', proj1_desc:'CRM-like system for a B2B company with 50+ employees. Automation of routine tasks, ERP integration, real-time dashboards for managers. Full cycle: discovery → production.',
    proj2_type:'Marketplace · B2C', proj2_title:'Professional services marketplace', proj2_desc:'A platform for freelancers and clients with built-in escrow, reviews, video presentations, and AI-powered talent matching on demand.',
    proj3_type:'SaaS · EdTech', proj3_title:'LMS platform for corporate training', proj3_desc:'A learning management system with tests, certificates, progress analytics, and HR system integration. Multi-tenant architecture.',
    metric_weeks:'Weeks', metric_budget:'Budget', metric_users:'Users / 2 months', metric_manual:'Manual work',
    metric_signups:'Signups in 1st month', metric_rating:'User rating', metric_clients:'Enterprise clients', metric_trained:'Employees trained',
    sec_ai_tag:'AI integrations', sec_ai_h:'Smarter products, faster',
    sec_ai_desc:'We don\'t rewrite your product from scratch. We embed AI where it delivers maximum impact.',
    ai1_title:'RAG Systems', ai1_desc:'Precise answers based on your data. A bot that knows your documentation, contracts, or knowledge base — without hallucinations.',
    ai2_title:'Custom Assistants', ai2_desc:'Chatbots with your brand\'s personality, integrated into your product. Support, sales, onboarding — 24/7 without growing your team.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'We fine-tune models on your data. Specialized AI for healthcare, legal, finance, or any other niche.',
    ai4_title:'Voice Interfaces', ai4_desc:'Whisper + LLM + TTS — voice bots for call centers, search, and call automation. Works in 40+ languages.',
    sec_contact_tag:'Contact', sec_contact_h:'Let\'s talk about your project',
    sec_contact_desc:'Free cost and timeline estimate within 24 hours. No obligations.',
    contact_subtitle:'Let\'s start with a conversation', contact_text:'Tell us about your idea — and we\'ll estimate timelines, costs, and the technical side. The first consultation is free and comes with no obligations.',
    form_type_label:'Project type', form_select_placeholder:'Select...', form_opt_saas:'SaaS Platform', form_opt_marketplace:'Marketplace', form_opt_admin:'Admin Panel', form_opt_automation:'Automation', form_opt_ai:'AI Integration', form_opt_other:'Other',
    form_desc_label:'Project description', form_desc_placeholder:'Tell us about your idea, target audience, and key features...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'We respond within 24 hours · No spam · Full confidentiality',
    btn_submit:'Get a free estimate →',
    footer_copy:'© 2026 Queen of Spades Tech. Digital product development.',
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
    sec_services_desc:'From architecture to deployment. We specialise in products that scale and monetise.',
    svc1_name:'MVP in 4–8 weeks', svc1_desc:'Rapid creation of a minimum viable product with core features, data integration, and market testing. We launch without unnecessary costs — only what\'s needed to validate your hypothesis.', svc1_tag:'Time-to-market',
    svc2_name:'SaaS Platforms', svc2_desc:'Scalable platforms with subscriptions, secure data storage, and user analytics. Perfect for startups and small businesses with growth plans.', svc2_tag:'Scalable',
    svc3_name:'Marketplaces', svc3_desc:'Systems with product catalogues, online payments, reviews, and moderation. We connect sellers and buyers through reliable infrastructure.', svc3_tag:'B2B / B2C',
    svc4_name:'Admin Panels & Dashboards', svc4_desc:'User-friendly interfaces for data management with flexible access roles, dashboards, and real-time analytics. Your team works more efficiently.', svc4_tag:'Role-based',
    svc5_name:'Automation', svc5_desc:'Scripts and systems that simplify routine tasks, integrate with existing tools, and save your team\'s time. Less manual work — more results.', svc5_tag:'No-ops',
    svc6_name:'AI Integrations', svc6_desc:'We add smart features: chatbots, data analysis, RAG systems, auto-classification. Your product becomes more competitive without rewriting from scratch.', svc6_tag:'AI-first',
    sec_process_tag:'How we work', sec_process_h:'From idea to production',
    sec_process_desc:'Transparent process, predictable timelines. No surprises — just a working product.',
    step1_title:'Discovery & User Stories', step1_desc:'We dive into the idea, write user stories (what the user actually needs) and create an API-first design. Everything works smoothly through clear interfaces from day one.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Architecture & Stack', step2_desc:'We choose an approach where everything scales. Event-driven or microservices-ready — depending on your growth goals.', step2_tag1:'Event-driven', step2_tag2:'Microservices', step2_tag3:'Cloud-native',
    step3_title:'Sprint-based Development', step3_desc:'Short 2-week iterations. Trunk-based development and feature flags — new features are toggled on without risking stability.', step3_tag1:'2-week sprints', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD & Security', step4_desc:'Automatic updates with zero downtime from day one. OWASP Top 10 and dependency scanning — security is built in, not bolted on.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Launch & Handoff', step5_desc:'Observability out of the box — OpenTelemetry + Prometheus/Grafana. You can see where bottlenecks are. Full handoff with documentation and team training.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Typical MVP timeline', timeline_phase1:'Discovery', timeline_phase2:'Architecture & design', timeline_phase3:'Development (sprints)', timeline_phase4:'QA & security', timeline_phase5:'Launch',
    sec_stack_tag:'Technology', sec_stack_h:'Production-grade stack',
    sec_stack_desc:'Battle-tested tools, no hype. Every choice is intentional.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infrastructure & DevOps', stack_cat4:'AI & ML',
    sec_projects_tag:'Case studies', sec_projects_h:'Real results',
    sec_projects_desc:'Anonymous case studies from our clients. Real numbers, real timelines.',
    proj1_type:'B2B SaaS · Automation', proj1_title:'Operations management platform', proj1_desc:'CRM-like system for a B2B company with 50+ employees. Automation of routine tasks, ERP integration, real-time dashboards for managers. Full cycle: discovery → production.',
    proj2_type:'Marketplace · B2C', proj2_title:'Professional services marketplace', proj2_desc:'A platform for freelancers and clients with built-in escrow, reviews, video presentations, and AI-powered talent matching on demand.',
    proj3_type:'SaaS · EdTech', proj3_title:'LMS platform for corporate training', proj3_desc:'A learning management system with tests, certificates, progress analytics, and HR system integration. Multi-tenant architecture.',
    metric_weeks:'Weeks', metric_budget:'Budget', metric_users:'Users / 2 months', metric_manual:'Manual work',
    metric_signups:'Signups in 1st month', metric_rating:'User rating', metric_clients:'Enterprise clients', metric_trained:'Employees trained',
    sec_ai_tag:'AI integrations', sec_ai_h:'Smarter products, faster',
    sec_ai_desc:'We don\'t rewrite your product from scratch. We embed AI where it delivers maximum impact.',
    ai1_title:'RAG Systems', ai1_desc:'Precise answers based on your data. A bot that knows your documentation, contracts, or knowledge base — without hallucinations.',
    ai2_title:'Custom Assistants', ai2_desc:'Chatbots with your brand\'s personality, integrated into your product. Support, sales, onboarding — 24/7 without growing your team.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'We fine-tune models on your data. Specialised AI for healthcare, legal, finance, or any other niche.',
    ai4_title:'Voice Interfaces', ai4_desc:'Whisper + LLM + TTS — voice bots for call centres, search, and call automation. Works in 40+ languages.',
    sec_contact_tag:'Contact', sec_contact_h:'Let\'s discuss your project',
    sec_contact_desc:'Free cost and timeline estimate within 24 hours. No obligations.',
    contact_subtitle:'Let\'s start with a conversation', contact_text:'Tell us about your idea — and we\'ll estimate timelines, costs, and the technical side. The first consultation is free and comes with no obligations.',
    form_type_label:'Project type', form_select_placeholder:'Select...', form_opt_saas:'SaaS Platform', form_opt_marketplace:'Marketplace', form_opt_admin:'Admin Panel', form_opt_automation:'Automation', form_opt_ai:'AI Integration', form_opt_other:'Other',
    form_desc_label:'Project description', form_desc_placeholder:'Tell us about your idea, target audience, and key features...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'We respond within 24 hours · No spam · Full confidentiality',
    btn_submit:'Get a free quote →',
    footer_copy:'© 2026 Queen of Spades Tech. Digital product development.',
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
    stat3:'Dans le budget', stat4:"Semaines jusqu'au lancement",
    sec_services_tag:'Ce que nous faisons', sec_services_h:'Développement complet',
    sec_services_desc:'De l\'architecture au déploiement. Nous nous spécialisons dans les produits qui évoluent et se monétisent.',
    svc1_name:'MVP en 4–8 semaines', svc1_desc:'Création rapide d\'un produit minimum viable avec fonctionnalités essentielles, intégration de données et test marché. Nous lançons sans coûts superflus — uniquement ce qui est nécessaire pour valider votre hypothèse.', svc1_tag:'Time-to-market',
    svc2_name:'Plateformes SaaS', svc2_desc:'Plateformes évolutives avec abonnements, stockage sécurisé des données et analytique utilisateur. Parfait pour les startups et petites entreprises avec des plans de croissance.', svc2_tag:'Évolutif',
    svc3_name:'Marketplaces', svc3_desc:'Systèmes avec catalogues produits, paiements en ligne, avis et modération. Nous connectons vendeurs et acheteurs via une infrastructure fiable.', svc3_tag:'B2B / B2C',
    svc4_name:'Panneaux Admin & Dashboards', svc4_desc:'Interfaces conviviales pour la gestion des données avec rôles d\'accès flexibles, tableaux de bord et analytique en temps réel. Votre équipe travaille plus efficacement.', svc4_tag:'Basé sur les rôles',
    svc5_name:'Automatisation', svc5_desc:'Scripts et systèmes qui simplifient les tâches routinières, s\'intègrent aux outils existants et économisent le temps de votre équipe. Moins de travail manuel — plus de résultats.', svc5_tag:'No-ops',
    svc6_name:'Intégrations IA', svc6_desc:'Nous ajoutons des fonctionnalités intelligentes : chatbots, analyse de données, systèmes RAG, auto-classification. Votre produit devient plus compétitif sans réécriture complète.', svc6_tag:'IA d\'abord',
    sec_process_tag:'Notre méthode', sec_process_h:"De l'idée à la production",
    sec_process_desc:'Processus transparent, délais prévisibles. Pas de surprises — juste un produit fonctionnel.',
    step1_title:'Discovery & User Stories', step1_desc:'Nous plongeons dans l\'idée, rédigeons des user stories (ce dont l\'utilisateur a réellement besoin) et créons un design API-first. Tout fonctionne harmonieusement via des interfaces claires dès le premier jour.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Architecture & Stack', step2_desc:'Nous choisissons une approche où tout évolue. Event-driven ou microservices-ready — selon vos objectifs de croissance.', step2_tag1:'Event-driven', step2_tag2:'Microservices', step2_tag3:'Cloud-native',
    step3_title:'Développement par Sprints', step3_desc:'Itérations courtes de 2 semaines. Développement trunk-based et feature flags — les nouvelles fonctionnalités sont activées sans risque pour la stabilité.', step3_tag1:'Sprints de 2 semaines', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD & Sécurité', step4_desc:'Mises à jour automatiques sans interruption dès le premier jour. OWASP Top 10 et analyse des dépendances — la sécurité est intégrée, pas ajoutée.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Lancement & Passation', step5_desc:'Observabilité prête à l\'emploi — OpenTelemetry + Prometheus/Grafana. Vous voyez où sont les goulots d\'étranglement. Passation complète avec documentation et formation de l\'équipe.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Timeline MVP typique', timeline_phase1:'Discovery', timeline_phase2:'Architecture & design', timeline_phase3:'Développement (sprints)', timeline_phase4:'QA & sécurité', timeline_phase5:'Lancement',
    sec_stack_tag:'Technologies', sec_stack_h:'Stack production-grade',
    sec_stack_desc:'Outils éprouvés, pas de hype. Chaque choix est intentionnel.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infrastructure & DevOps', stack_cat4:'IA & ML',
    sec_projects_tag:'Études de cas', sec_projects_h:'Résultats concrets',
    sec_projects_desc:'Études de cas anonymes de nos clients. Vrais chiffres, vrais délais.',
    proj1_type:'SaaS B2B · Automatisation', proj1_title:'Plateforme de gestion des opérations', proj1_desc:'Système type CRM pour entreprise B2B avec 50+ employés. Automatisation des tâches routinières, intégration ERP, dashboards temps réel pour managers. Cycle complet : discovery → production.',
    proj2_type:'Marketplace · B2C', proj2_title:'Marketplace de services professionnels', proj2_desc:'Plateforme pour freelances et clients avec escrow intégré, avis, présentations vidéo et matching IA des talents à la demande.',
    proj3_type:'SaaS · EdTech', proj3_title:'Plateforme LMS pour formation d\'entreprise', proj3_desc:'Système de gestion de l\'apprentissage avec tests, certificats, analytique de progression et intégration système RH. Architecture multi-tenant.',
    metric_weeks:'Semaines', metric_budget:'Budget', metric_users:'Utilisateurs / 2 mois', metric_manual:'Travail manuel',
    metric_signups:'Inscriptions 1er mois', metric_rating:'Note utilisateur', metric_clients:'Clients entreprise', metric_trained:'Employés formés',
    sec_ai_tag:'Intégrations IA', sec_ai_h:'Des produits plus intelligents, plus vite',
    sec_ai_desc:'Nous ne réécrivons pas votre produit de zéro. Nous intégrons l\'IA là où elle a le plus d\'impact.',
    ai1_title:'Systèmes RAG', ai1_desc:'Réponses précises basées sur vos données. Un bot qui connaît votre documentation, contrats ou base de connaissances — sans hallucinations.',
    ai2_title:'Assistants Personnalisés', ai2_desc:'Chatbots avec la personnalité de votre marque, intégrés à votre produit. Support, ventes, onboarding — 24/7 sans agrandir votre équipe.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'Nous affinons les modèles sur vos données. IA spécialisée pour santé, juridique, finance ou tout autre secteur.',
    ai4_title:'Interfaces Vocales', ai4_desc:'Whisper + LLM + TTS — bots vocaux pour centres d\'appels, recherche et automatisation d\'appels. Fonctionne en 40+ langues.',
    sec_contact_tag:'Contact', sec_contact_h:'Parlons de votre projet',
    sec_contact_desc:'Estimation gratuite des coûts et délais sous 24 heures. Sans engagement.',
    contact_subtitle:'Commençons par une conversation', contact_text:'Parlez-nous de votre idée — nous estimerons les délais, coûts et l\'aspect technique. La première consultation est gratuite et sans engagement.',
    form_type_label:'Type de projet', form_select_placeholder:'Sélectionner...', form_opt_saas:'Plateforme SaaS', form_opt_marketplace:'Marketplace', form_opt_admin:'Panneau Admin', form_opt_automation:'Automatisation', form_opt_ai:'Intégration IA', form_opt_other:'Autre',
    form_desc_label:'Description du projet', form_desc_placeholder:'Parlez-nous de votre idée, public cible et fonctionnalités clés...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'Nous répondons sous 24 heures · Pas de spam · Confidentialité totale',
    btn_submit:'Obtenir un devis gratuit →',
    footer_copy:'© 2026 Queen of Spades Tech. Développement de produits numériques.',
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
    sec_services_desc:'Von Architektur bis Deployment. Wir spezialisieren uns auf Produkte, die skalieren und monetarisieren.',
    svc1_name:'MVP in 4–8 Wochen', svc1_desc:'Schnelle Erstellung eines minimal funktionsfähigen Produkts mit Kernfunktionen, Datenintegration und Markttests. Wir launchen ohne unnötige Kosten — nur das, was zur Validierung Ihrer Hypothese nötig ist.', svc1_tag:'Time-to-market',
    svc2_name:'SaaS-Plattformen', svc2_desc:'Skalierbare Plattformen mit Abonnements, sicherer Datenspeicherung und Nutzeranalyse. Perfekt für Startups und kleine Unternehmen mit Wachstumsplänen.', svc2_tag:'Skalierbar',
    svc3_name:'Marktplätze', svc3_desc:'Systeme mit Produktkatalogen, Online-Zahlungen, Bewertungen und Moderation. Wir verbinden Verkäufer und Käufer über zuverlässige Infrastruktur.', svc3_tag:'B2B / B2C',
    svc4_name:'Admin-Panels & Dashboards', svc4_desc:'Benutzerfreundliche Interfaces zur Datenverwaltung mit flexiblen Zugriffsrollen, Dashboards und Echtzeit-Analytik. Ihr Team arbeitet effizienter.', svc4_tag:'Rollenbasiert',
    svc5_name:'Automatisierung', svc5_desc:'Skripte und Systeme, die Routineaufgaben vereinfachen, sich in bestehende Tools integrieren und die Zeit Ihres Teams sparen. Weniger Handarbeit — mehr Ergebnisse.', svc5_tag:'No-ops',
    svc6_name:'KI-Integrationen', svc6_desc:'Wir fügen intelligente Features hinzu: Chatbots, Datenanalyse, RAG-Systeme, Auto-Klassifizierung. Ihr Produkt wird wettbewerbsfähiger ohne komplette Neuentwicklung.', svc6_tag:'KI-first',
    sec_process_tag:'Unsere Methode', sec_process_h:'Von der Idee zur Produktion',
    sec_process_desc:'Transparenter Prozess, vorhersehbare Zeitpläne. Keine Überraschungen — nur ein funktionierendes Produkt.',
    step1_title:'Discovery & User Stories', step1_desc:'Wir tauchen in die Idee ein, schreiben User Stories (was der Nutzer wirklich braucht) und erstellen ein API-first Design. Alles funktioniert reibungslos über klare Schnittstellen vom ersten Tag an.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Architektur & Stack', step2_desc:'Wir wählen einen Ansatz, bei dem alles skaliert. Event-driven oder Microservices-ready — je nach Ihren Wachstumszielen.', step2_tag1:'Event-driven', step2_tag2:'Microservices', step2_tag3:'Cloud-native',
    step3_title:'Sprint-basierte Entwicklung', step3_desc:'Kurze 2-Wochen-Iterationen. Trunk-based Development und Feature Flags — neue Features werden ohne Stabilitätsrisiko aktiviert.', step3_tag1:'2-Wochen-Sprints', step3_tag2:'Feature Flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD & Sicherheit', step4_desc:'Automatische Updates ohne Ausfallzeiten vom ersten Tag an. OWASP Top 10 und Dependency-Scanning — Sicherheit ist eingebaut, nicht nachgerüstet.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Launch & Übergabe', step5_desc:'Observability aus der Box — OpenTelemetry + Prometheus/Grafana. Sie sehen, wo Engpässe sind. Vollständige Übergabe mit Dokumentation und Team-Training.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Typische MVP-Timeline', timeline_phase1:'Discovery', timeline_phase2:'Architektur & Design', timeline_phase3:'Entwicklung (Sprints)', timeline_phase4:'QA & Sicherheit', timeline_phase5:'Launch',
    sec_stack_tag:'Technologien', sec_stack_h:'Production-grade Stack',
    sec_stack_desc:'Bewährte Tools, kein Hype. Jede Wahl ist bewusst.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infrastruktur & DevOps', stack_cat4:'KI & ML',
    sec_projects_tag:'Fallstudien', sec_projects_h:'Echte Ergebnisse',
    sec_projects_desc:'Anonyme Fallstudien unserer Kunden. Echte Zahlen, echte Zeitpläne.',
    proj1_type:'B2B SaaS · Automatisierung', proj1_title:'Operations-Management-Plattform', proj1_desc:'CRM-ähnliches System für B2B-Unternehmen mit 50+ Mitarbeitern. Automatisierung von Routineaufgaben, ERP-Integration, Echtzeit-Dashboards für Manager. Vollzyklus: Discovery → Produktion.',
    proj2_type:'Marktplatz · B2C', proj2_title:'Marktplatz für professionelle Dienstleistungen', proj2_desc:'Plattform für Freelancer und Kunden mit integriertem Escrow, Bewertungen, Video-Präsentationen und KI-gestütztem Talent-Matching auf Abruf.',
    proj3_type:'SaaS · EdTech', proj3_title:'LMS-Plattform für Unternehmensschulung', proj3_desc:'Learning-Management-System mit Tests, Zertifikaten, Fortschrittsanalyse und HR-System-Integration. Multi-Tenant-Architektur.',
    metric_weeks:'Wochen', metric_budget:'Budget', metric_users:'Nutzer / 2 Monate', metric_manual:'Handarbeit',
    metric_signups:'Anmeldungen 1. Monat', metric_rating:'Nutzerbewertung', metric_clients:'Enterprise-Kunden', metric_trained:'Geschulte Mitarbeiter',
    sec_ai_tag:'KI-Integrationen', sec_ai_h:'Klügere Produkte, schneller',
    sec_ai_desc:'Wir schreiben Ihr Produkt nicht von Grund auf neu. Wir integrieren KI dort, wo sie maximale Wirkung erzielt.',
    ai1_title:'RAG-Systeme', ai1_desc:'Präzise Antworten basierend auf Ihren Daten. Ein Bot, der Ihre Dokumentation, Verträge oder Wissensdatenbank kennt — ohne Halluzinationen.',
    ai2_title:'Custom Assistants', ai2_desc:'Chatbots mit der Persönlichkeit Ihrer Marke, integriert in Ihr Produkt. Support, Vertrieb, Onboarding — 24/7 ohne Teamvergrößerung.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'Wir trainieren Modelle auf Ihren Daten. Spezialisierte KI für Gesundheitswesen, Recht, Finanzen oder jede andere Nische.',
    ai4_title:'Sprachschnittstellen', ai4_desc:'Whisper + LLM + TTS — Sprachbots für Callcenter, Suche und Anrufautomatisierung. Funktioniert in 40+ Sprachen.',
    sec_contact_tag:'Kontakt', sec_contact_h:'Sprechen wir über Ihr Projekt',
    sec_contact_desc:'Kostenlose Kosten- und Zeitschätzung innerhalb von 24 Stunden. Unverbindlich.',
    contact_subtitle:'Beginnen wir mit einem Gespräch', contact_text:'Erzählen Sie uns von Ihrer Idee — und wir schätzen Zeitpläne, Kosten und die technische Seite. Die erste Beratung ist kostenlos und unverbindlich.',
    form_type_label:'Projekttyp', form_select_placeholder:'Auswählen...', form_opt_saas:'SaaS-Plattform', form_opt_marketplace:'Marktplatz', form_opt_admin:'Admin-Panel', form_opt_automation:'Automatisierung', form_opt_ai:'KI-Integration', form_opt_other:'Sonstiges',
    form_desc_label:'Projektbeschreibung', form_desc_placeholder:'Erzählen Sie uns von Ihrer Idee, Zielgruppe und Hauptfunktionen...', form_contact_label:'E-Mail', form_contact_placeholder:'email@example.com',
    form_note:'Wir antworten innerhalb von 24 Stunden · Kein Spam · Volle Vertraulichkeit',
    btn_submit:'Kostenloses Angebot →',
    footer_copy:'© 2026 Queen of Spades Tech. Digitale Produktentwicklung.',
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
    sec_services_desc:'De arquitectura a despliegue. Nos especializamos en productos que escalan y monetizan.',
    svc1_name:'MVP en 4–8 semanas', svc1_desc:'Creación rápida de un producto mínimo viable con funciones clave, integración de datos y pruebas de mercado. Lanzamos sin costos innecesarios — solo lo necesario para validar tu hipótesis.', svc1_tag:'Time-to-market',
    svc2_name:'Plataformas SaaS', svc2_desc:'Plataformas escalables con suscripciones, almacenamiento seguro de datos y análisis de usuarios. Perfecto para startups y pequeñas empresas con planes de crecimiento.', svc2_tag:'Escalable',
    svc3_name:'Marketplaces', svc3_desc:'Sistemas con catálogos de productos, pagos online, reseñas y moderación. Conectamos vendedores y compradores a través de infraestructura confiable.', svc3_tag:'B2B / B2C',
    svc4_name:'Paneles Admin & Dashboards', svc4_desc:'Interfaces amigables para gestión de datos con roles de acceso flexibles, dashboards y análisis en tiempo real. Tu equipo trabaja más eficientemente.', svc4_tag:'Basado en roles',
    svc5_name:'Automatización', svc5_desc:'Scripts y sistemas que simplifican tareas rutinarias, se integran con herramientas existentes y ahorran tiempo a tu equipo. Menos trabajo manual — más resultados.', svc5_tag:'No-ops',
    svc6_name:'Integraciones de IA', svc6_desc:'Agregamos características inteligentes: chatbots, análisis de datos, sistemas RAG, auto-clasificación. Tu producto se vuelve más competitivo sin reescribir desde cero.', svc6_tag:'IA primero',
    sec_process_tag:'Cómo trabajamos', sec_process_h:'De la idea a producción',
    sec_process_desc:'Proceso transparente, plazos predecibles. Sin sorpresas — solo un producto funcional.',
    step1_title:'Discovery & User Stories', step1_desc:'Nos sumergimos en la idea, escribimos historias de usuario (lo que el usuario realmente necesita) y creamos un diseño API-first. Todo funciona sin problemas a través de interfaces claras desde el primer día.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Arquitectura & Stack', step2_desc:'Elegimos un enfoque donde todo escala. Event-driven o microservices-ready — dependiendo de tus objetivos de crecimiento.', step2_tag1:'Event-driven', step2_tag2:'Microservicios', step2_tag3:'Cloud-native',
    step3_title:'Desarrollo basado en Sprints', step3_desc:'Iteraciones cortas de 2 semanas. Desarrollo trunk-based y feature flags — nuevas características se activan sin arriesgar la estabilidad.', step3_tag1:'Sprints de 2 semanas', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD & Seguridad', step4_desc:'Actualizaciones automáticas sin tiempo de inactividad desde el primer día. OWASP Top 10 y escaneo de dependencias — la seguridad está integrada, no añadida.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Lanzamiento & Traspaso', step5_desc:'Observabilidad lista para usar — OpenTelemetry + Prometheus/Grafana. Puedes ver dónde están los cuellos de botella. Traspaso completo con documentación y capacitación del equipo.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Timeline típico de MVP', timeline_phase1:'Discovery', timeline_phase2:'Arquitectura y diseño', timeline_phase3:'Desarrollo (sprints)', timeline_phase4:'QA y seguridad', timeline_phase5:'Lanzamiento',
    sec_stack_tag:'Tecnologías', sec_stack_h:'Stack production-grade',
    sec_stack_desc:'Herramientas probadas en batalla, sin hype. Cada elección es intencional.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infraestructura & DevOps', stack_cat4:'IA & ML',
    sec_projects_tag:'Casos de éxito', sec_projects_h:'Resultados reales',
    sec_projects_desc:'Casos anónimos de nuestros clientes. Números reales, plazos reales.',
    proj1_type:'SaaS B2B · Automatización', proj1_title:'Plataforma de gestión de operaciones', proj1_desc:'Sistema tipo CRM para empresa B2B con 50+ empleados. Automatización de tareas rutinarias, integración ERP, dashboards en tiempo real para gerentes. Ciclo completo: discovery → producción.',
    proj2_type:'Marketplace · B2C', proj2_title:'Marketplace de servicios profesionales', proj2_desc:'Plataforma para freelancers y clientes con escrow integrado, reseñas, presentaciones de video y matching de talento impulsado por IA bajo demanda.',
    proj3_type:'SaaS · EdTech', proj3_title:'Plataforma LMS para formación corporativa', proj3_desc:'Sistema de gestión del aprendizaje con pruebas, certificados, análisis de progreso e integración con sistema RH. Arquitectura multi-tenant.',
    metric_weeks:'Semanas', metric_budget:'Presupuesto', metric_users:'Usuarios / 2 meses', metric_manual:'Trabajo manual',
    metric_signups:'Registros 1er mes', metric_rating:'Calificación usuario', metric_clients:'Clientes empresa', metric_trained:'Empleados capacitados',
    sec_ai_tag:'Integraciones de IA', sec_ai_h:'Productos más inteligentes, más rápido',
    sec_ai_desc:'No reescribimos tu producto desde cero. Integramos IA donde genera máximo impacto.',
    ai1_title:'Sistemas RAG', ai1_desc:'Respuestas precisas basadas en tus datos. Un bot que conoce tu documentación, contratos o base de conocimiento — sin alucinaciones.',
    ai2_title:'Asistentes Personalizados', ai2_desc:'Chatbots con la personalidad de tu marca, integrados en tu producto. Soporte, ventas, onboarding — 24/7 sin hacer crecer tu equipo.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'Ajustamos modelos con tus datos. IA especializada para salud, legal, finanzas o cualquier otro nicho.',
    ai4_title:'Interfaces de Voz', ai4_desc:'Whisper + LLM + TTS — bots de voz para call centers, búsqueda y automatización de llamadas. Funciona en 40+ idiomas.',
    sec_contact_tag:'Contacto', sec_contact_h:'Hablemos de tu proyecto',
    sec_contact_desc:'Estimación gratuita de costo y plazos en 24 horas. Sin compromiso.',
    contact_subtitle:'Empecemos con una conversación', contact_text:'Cuéntanos sobre tu idea — y estimaremos plazos, costos y el lado técnico. La primera consulta es gratuita y sin compromiso.',
    form_type_label:'Tipo de proyecto', form_select_placeholder:'Seleccionar...', form_opt_saas:'Plataforma SaaS', form_opt_marketplace:'Marketplace', form_opt_admin:'Panel Admin', form_opt_automation:'Automatización', form_opt_ai:'Integración IA', form_opt_other:'Otro',
    form_desc_label:'Descripción del proyecto', form_desc_placeholder:'Cuéntanos sobre tu idea, audiencia objetivo y características clave...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'Respondemos en 24 horas · Sin spam · Confidencialidad total',
    btn_submit:'Obtener presupuesto gratuito →',
    footer_copy:'© 2026 Queen of Spades Tech. Desarrollo de productos digitales.',
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
    sec_services_desc:'D\'arquitectura a desplegament. Ens especialitzem en productes que escalen i monetitzen.',
    svc1_name:'MVP en 4–8 setmanes', svc1_desc:'Creació ràpida d\'un producte mínim viable amb funcions clau, integració de dades i proves de mercat. Llancem sense costos innecessaris — només el necessari per validar la teva hipòtesi.', svc1_tag:'Time-to-market',
    svc2_name:'Plataformes SaaS', svc2_desc:'Plataformes escalables amb subscripcions, emmagatzematge segur de dades i anàlisi d\'usuaris. Perfecte per startups i petites empreses amb plans de creixement.', svc2_tag:'Escalable',
    svc3_name:'Marketplaces', svc3_desc:'Sistemes amb catàlegs de productes, pagaments online, ressenyes i moderació. Connectem venedors i compradors a través d\'infraestructura fiable.', svc3_tag:'B2B / B2C',
    svc4_name:'Panells Admin & Dashboards', svc4_desc:'Interfícies amigables per gestió de dades amb rols d\'accés flexibles, dashboards i anàlisi en temps real. El teu equip treballa més eficientment.', svc4_tag:'Basat en rols',
    svc5_name:'Automatització', svc5_desc:'Scripts i sistemes que simplifiquen tasques rutinàries, s\'integren amb eines existents i estalvien temps al teu equip. Menys treball manual — més resultats.', svc5_tag:'No-ops',
    svc6_name:'Integracions d\'IA', svc6_desc:'Afegim característiques intel·ligents: chatbots, anàlisi de dades, sistemes RAG, auto-classificació. El teu producte es torna més competitiu sense reescriure des de zero.', svc6_tag:'IA primer',
    sec_process_tag:'Com treballem', sec_process_h:'De la idea a producció',
    sec_process_desc:'Procés transparent, terminis previsibles. Sense sorpreses — només un producte funcional.',
    step1_title:'Discovery & User Stories', step1_desc:'Ens submergim en la idea, escrivim històries d\'usuari (el que l\'usuari realment necessita) i creem un disseny API-first. Tot funciona sense problemes a través d\'interfícies clares des del primer dia.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Arquitectura & Stack', step2_desc:'Triem un enfocament on tot escala. Event-driven o microservices-ready — depenent dels teus objectius de creixement.', step2_tag1:'Event-driven', step2_tag2:'Microserveis', step2_tag3:'Cloud-native',
    step3_title:'Desenvolupament basat en Sprints', step3_desc:'Iteracions curtes de 2 setmanes. Desenvolupament trunk-based i feature flags — noves característiques s\'activen sense arriscar l\'estabilitat.', step3_tag1:'Sprints de 2 setmanes', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD & Seguretat', step4_desc:'Actualitzacions automàtiques sense temps d\'inactivitat des del primer dia. OWASP Top 10 i escaneig de dependències — la seguretat està integrada, no afegida.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Llançament & Traspàs', step5_desc:'Observabilitat llesta per usar — OpenTelemetry + Prometheus/Grafana. Pots veure on estan els colls d\'ampolla. Traspàs complet amb documentació i capacitació de l\'equip.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Timeline típic de MVP', timeline_phase1:'Discovery', timeline_phase2:'Arquitectura i disseny', timeline_phase3:'Desenvolupament (sprints)', timeline_phase4:'QA i seguretat', timeline_phase5:'Llançament',
    sec_stack_tag:'Tecnologies', sec_stack_h:'Stack production-grade',
    sec_stack_desc:'Eines provades en batalla, sense hype. Cada elecció és intencional.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infraestructura & DevOps', stack_cat4:'IA & ML',
    sec_projects_tag:"Casos d'èxit", sec_projects_h:'Resultats reals',
    sec_projects_desc:'Casos anònims dels nostres clients. Números reals, terminis reals.',
    proj1_type:'SaaS B2B · Automatització', proj1_title:'Plataforma de gestió d\'operacions', proj1_desc:'Sistema tipus CRM per empresa B2B amb 50+ empleats. Automatització de tasques rutinàries, integració ERP, dashboards en temps real per gerents. Cicle complet: discovery → producció.',
    proj2_type:'Marketplace · B2C', proj2_title:'Marketplace de serveis professionals', proj2_desc:'Plataforma per freelancers i clients amb escrow integrat, ressenyes, presentacions de vídeo i matching de talent impulsat per IA sota demanda.',
    proj3_type:'SaaS · EdTech', proj3_title:'Plataforma LMS per formació corporativa', proj3_desc:'Sistema de gestió de l\'aprenentatge amb proves, certificats, anàlisi de progrés i integració amb sistema RH. Arquitectura multi-tenant.',
    metric_weeks:'Setmanes', metric_budget:'Pressupost', metric_users:'Usuaris / 2 mesos', metric_manual:'Treball manual',
    metric_signups:'Registres 1r mes', metric_rating:'Qualificació usuari', metric_clients:'Clients empresa', metric_trained:'Empleats capacitats',
    sec_ai_tag:'Integracions d\'IA', sec_ai_h:'Productes més intel·ligents, més ràpid',
    sec_ai_desc:'No reescrivim el teu producte des de zero. Integrem IA on genera màxim impacte.',
    ai1_title:'Sistemes RAG', ai1_desc:'Respostes precises basades en les teves dades. Un bot que coneix la teva documentació, contractes o base de coneixement — sense al·lucinacions.',
    ai2_title:'Assistents Personalitzats', ai2_desc:'Chatbots amb la personalitat de la teva marca, integrats en el teu producte. Suport, vendes, onboarding — 24/7 sense fer créixer el teu equip.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'Ajustem models amb les teves dades. IA especialitzada per salut, legal, finances o qualsevol altre nínxol.',
    ai4_title:'Interfícies de Veu', ai4_desc:'Whisper + LLM + TTS — bots de veu per call centers, cerca i automatització de trucades. Funciona en 40+ idiomes.',
    sec_contact_tag:'Contacte', sec_contact_h:'Parlem del teu projecte',
    sec_contact_desc:'Estimació gratuïta de cost i terminis en 24 hores. Sense compromís.',
    contact_subtitle:'Comencem amb una conversa', contact_text:'Explica\'ns la teva idea — i estimarem terminis, costos i el costat tècnic. La primera consulta és gratuïta i sense compromís.',
    form_type_label:'Tipus de projecte', form_select_placeholder:'Seleccionar...', form_opt_saas:'Plataforma SaaS', form_opt_marketplace:'Marketplace', form_opt_admin:'Panell Admin', form_opt_automation:'Automatització', form_opt_ai:'Integració IA', form_opt_other:'Altre',
    form_desc_label:'Descripció del projecte', form_desc_placeholder:'Explica\'ns la teva idea, audiència objectiu i característiques clau...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'Responem en 24 hores · Sense spam · Confidencialitat total',
    btn_submit:'Obtenir pressupost gratuït →',
    footer_copy:'© 2026 Queen of Spades Tech. Desenvolupament de productes digitals.',
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
    sec_services_desc:'Od architektury do wdrożenia. Specjalizujemy się w produktach, które skalują się i monetyzują.',
    svc1_name:'MVP w 4–8 tygodni', svc1_desc:'Szybkie stworzenie minimalnego produktu z kluczowymi funkcjami, integracją danych i testami rynkowymi. Uruchamiamy bez zbędnych kosztów — tylko to, co potrzebne do walidacji hipotezy.', svc1_tag:'Time-to-market',
    svc2_name:'Platformy SaaS', svc2_desc:'Skalowalne platformy z subskrypcjami, bezpiecznym przechowywaniem danych i analizą użytkowników. Idealne dla startupów i małych firm z planami wzrostu.', svc2_tag:'Skalowalne',
    svc3_name:'Marketplace', svc3_desc:'Systemy z katalogami produktów, płatnościami online, recenzjami i moderacją. Łączymy sprzedawców i kupujących przez niezawodną infrastrukturę.', svc3_tag:'B2B / B2C',
    svc4_name:'Panele Admin i Dashboardy', svc4_desc:'Przyjazne interfejsy do zarządzania danymi z elastycznymi rolami dostępu, dashboardami i analizą w czasie rzeczywistym. Twój zespół pracuje efektywniej.', svc4_tag:'Oparte na rolach',
    svc5_name:'Automatyzacja', svc5_desc:'Skrypty i systemy upraszczające rutynowe zadania, integrujące się z istniejącymi narzędziami i oszczędzające czas zespołu. Mniej pracy ręcznej — więcej wyników.', svc5_tag:'No-ops',
    svc6_name:'Integracje AI', svc6_desc:'Dodajemy inteligentne funkcje: chatboty, analiza danych, systemy RAG, auto-klasyfikacja. Twój produkt staje się bardziej konkurencyjny bez przepisywania od zera.', svc6_tag:'AI-first',
    sec_process_tag:'Jak pracujemy', sec_process_h:'Od pomysłu do produkcji',
    sec_process_desc:'Przejrzysty proces, przewidywalne terminy. Bez niespodzianek — tylko działający produkt.',
    step1_title:'Discovery i User Stories', step1_desc:'Zagłębiamy się w pomysł, piszemy user stories (co użytkownik faktycznie potrzebuje) i tworzymy design API-first. Wszystko działa płynnie przez jasne interfejsy od pierwszego dnia.', step1_tag1:'User Stories', step1_tag2:'API-first', step1_tag3:'Figma',
    step2_title:'Architektura i Stack', step2_desc:'Wybieramy podejście, w którym wszystko się skaluje. Event-driven lub microservices-ready — w zależności od celów wzrostu.', step2_tag1:'Event-driven', step2_tag2:'Mikroserwisy', step2_tag3:'Cloud-native',
    step3_title:'Rozwój oparty na Sprintach', step3_desc:'Krótkie 2-tygodniowe iteracje. Rozwój trunk-based i feature flags — nowe funkcje włączane bez ryzyka utraty stabilności.', step3_tag1:'2-tygodniowe sprinty', step3_tag2:'Feature flags', step3_tag3:'Trunk-based',
    step4_title:'CI/CD i Bezpieczeństwo', step4_desc:'Automatyczne aktualizacje bez przestojów od pierwszego dnia. OWASP Top 10 i skanowanie zależności — bezpieczeństwo wbudowane, nie doklejone.', step4_tag1:'Zero-downtime', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'Launch i Przekazanie', step5_desc:'Observability od razu — OpenTelemetry + Prometheus/Grafana. Widzisz, gdzie są wąskie gardła. Pełne przekazanie z dokumentacją i szkoleniem zespołu.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'Docs',
    timeline_label:'// Typowy timeline MVP', timeline_phase1:'Discovery', timeline_phase2:'Architektura i design', timeline_phase3:'Rozwój (sprinty)', timeline_phase4:'QA i bezpieczeństwo', timeline_phase5:'Launch',
    sec_stack_tag:'Technologie', sec_stack_h:'Stack klasy produkcyjnej',
    sec_stack_desc:'Sprawdzone narzędzia, bez hype. Każdy wybór jest intencjonalny.',
    stack_cat1:'Frontend', stack_cat2:'Backend', stack_cat3:'Infrastruktura i DevOps', stack_cat4:'AI & ML',
    sec_projects_tag:'Case study', sec_projects_h:'Realne wyniki',
    sec_projects_desc:'Anonimowe case study naszych klientów. Prawdziwe liczby, prawdziwe terminy.',
    proj1_type:'SaaS B2B · Automatyzacja', proj1_title:'Platforma zarządzania operacjami', proj1_desc:'System CRM-like dla firmy B2B z 50+ pracownikami. Automatyzacja rutynowych zadań, integracja ERP, dashboardy real-time dla menedżerów. Pełny cykl: discovery → produkcja.',
    proj2_type:'Marketplace · B2C', proj2_title:'Marketplace usług profesjonalnych', proj2_desc:'Platforma dla freelancerów i klientów z wbudowanym escrow, recenzjami, prezentacjami wideo i dopasowaniem talentów AI na żądanie.',
    proj3_type:'SaaS · EdTech', proj3_title:'Platforma LMS do szkoleń korporacyjnych', proj3_desc:'System zarządzania nauczaniem z testami, certyfikatami, analizą postępów i integracją z systemem HR. Architektura multi-tenant.',
    metric_weeks:'Tygodni', metric_budget:'Budżet', metric_users:'Użytkowników / 2 miesiące', metric_manual:'Pracy ręcznej',
    metric_signups:'Rejestracji 1. miesiąc', metric_rating:'Ocena użytkowników', metric_clients:'Klientów enterprise', metric_trained:'Przeszkolonych pracowników',
    sec_ai_tag:'Integracje AI', sec_ai_h:'Inteligentniejsze produkty, szybciej',
    sec_ai_desc:'Nie przepisujemy produktu od zera. Osadzamy AI tam, gdzie daje maksymalny efekt.',
    ai1_title:'Systemy RAG', ai1_desc:'Precyzyjne odpowiedzi oparte na Twoich danych. Bot, który zna Twoją dokumentację, kontrakty lub bazę wiedzy — bez halucynacji.',
    ai2_title:'Niestandardowi Asystenci', ai2_desc:'Chatboty z osobowością Twojej marki, zintegrowane z produktem. Wsparcie, sprzedaż, onboarding — 24/7 bez powiększania zespołu.',
    ai3_title:'Fine-tuning LLM', ai3_desc:'Dostrajamy modele na Twoich danych. Wyspecjalizowane AI dla zdrowia, prawnego, finansów lub innej niszy.',
    ai4_title:'Interfejsy Głosowe', ai4_desc:'Whisper + LLM + TTS — boty głosowe dla call center, wyszukiwania i automatyzacji połączeń. Działa w 40+ językach.',
    sec_contact_tag:'Kontakt', sec_contact_h:'Porozmawiajmy o Twoim projekcie',
    sec_contact_desc:'Bezpłatna wycena kosztów i terminów w 24 godziny. Bez zobowiązań.',
    contact_subtitle:'Zacznijmy od rozmowy', contact_text:'Opowiedz nam o pomyśle — oszacujemy terminy, koszty i stronę techniczną. Pierwsza konsultacja jest bezpłatna i bez zobowiązań.',
    form_type_label:'Typ projektu', form_select_placeholder:'Wybierz...', form_opt_saas:'Platforma SaaS', form_opt_marketplace:'Marketplace', form_opt_admin:'Panel Admin', form_opt_automation:'Automatyzacja', form_opt_ai:'Integracja AI', form_opt_other:'Inne',
    form_desc_label:'Opis projektu', form_desc_placeholder:'Opowiedz o pomyśle, grupie docelowej i kluczowych funkcjach...', form_contact_label:'Email', form_contact_placeholder:'email@example.com',
    form_note:'Odpowiadamy w 24 godziny · Bez spamu · Pełna poufność',
    btn_submit:'Bezpłatna wycena →',
    footer_copy:'© 2026 Queen of Spades Tech. Tworzenie produktów cyfrowych.',
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
    sec_services_desc:'من البنية المعمارية إلى النشر. نتخصص في منتجات قابلة للتوسع والتحقيق الربحية.',
    svc1_name:'MVP في 4–8 أسابيع', svc1_desc:'إنشاء سريع لمنتج قابل للاستخدام الأدنى مع الميزات الأساسية وتكامل البيانات واختبار السوق. نطلق بدون تكاليف غير ضرورية — فقط ما يلزم للتحقق من فرضيتك.', svc1_tag:'سرعة الوصول للسوق',
    svc2_name:'منصات SaaS', svc2_desc:'منصات قابلة للتوسع مع اشتراكات وتخزين آمن للبيانات وتحليلات المستخدمين. مثالية للشركات الناشئة والشركات الصغيرة ذات خطط النمو.', svc2_tag:'قابل للتوسع',
    svc3_name:'الأسواق الإلكترونية', svc3_desc:'أنظمة مع كتالوجات المنتجات والمدفوعات عبر الإنترنت والمراجعات والإشراف. نربط البائعين والمشترين عبر بنية تحتية موثوقة.', svc3_tag:'B2B / B2C',
    svc4_name:'لوحات الإدارة ولوحات المعلومات', svc4_desc:'واجهات سهلة الاستخدام لإدارة البيانات مع أدوار وصول مرنة ولوحات معلومات وتحليلات فورية. فريقك يعمل بكفاءة أكبر.', svc4_tag:'قائم على الأدوار',
    svc5_name:'الأتمتة', svc5_desc:'نصوص برمجية وأنظمة تبسط المهام الروتينية وتتكامل مع الأدوات الحالية وتوفر وقت فريقك. عمل يدوي أقل — نتائج أكثر.', svc5_tag:'لا عمليات',
    svc6_name:'تكاملات الذكاء الاصطناعي', svc6_desc:'نضيف ميزات ذكية: روبوتات الدردشة وتحليل البيانات وأنظمة RAG والتصنيف التلقائي. منتجك يصبح أكثر تنافسية دون إعادة الكتابة من الصفر.', svc6_tag:'الذكاء الاصطناعي أولاً',
    sec_process_tag:'كيف نعمل', sec_process_h:'من الفكرة إلى الإنتاج',
    sec_process_desc:'عملية شفافة، جداول زمنية متوقعة. لا مفاجآت — فقط منتج يعمل.',
    step1_title:'الاكتشاف وقصص المستخدمين', step1_desc:'نغوص في الفكرة ونكتب قصص المستخدمين (ما يحتاجه المستخدم فعلاً) ونصمم تصميماً قائماً على API أولاً. كل شيء يعمل بسلاسة من خلال واجهات واضحة من اليوم الأول.', step1_tag1:'قصص المستخدمين', step1_tag2:'API أولاً', step1_tag3:'Figma',
    step2_title:'البنية المعمارية والتقنيات', step2_desc:'نختار نهجاً حيث كل شيء قابل للتوسع. قائم على الأحداث أو جاهز للخدمات الصغيرة — بناءً على أهداف نموك.', step2_tag1:'قائم على الأحداث', step2_tag2:'الخدمات الصغيرة', step2_tag3:'سحابي أصلي',
    step3_title:'تطوير قائم على السبرينت', step3_desc:'دورات قصيرة من أسبوعين. تطوير قائم على الجذع وأعلام الميزات — الميزات الجديدة يتم تفعيلها دون المخاطرة بالاستقرار.', step3_tag1:'سبرينتات أسبوعين', step3_tag2:'أعلام الميزات', step3_tag3:'قائم على الجذع',
    step4_title:'CI/CD والأمان', step4_desc:'تحديثات تلقائية بدون توقف من اليوم الأول. OWASP Top 10 ومسح التبعيات — الأمان مدمج وليس مضافاً.', step4_tag1:'بدون توقف', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'الإطلاق والتسليم', step5_desc:'قابلية المراقبة جاهزة — OpenTelemetry + Prometheus/Grafana. يمكنك رؤية أين تكمن الاختناقات. تسليم كامل مع وثائق وتدريب للفريق.', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'الوثائق',
    timeline_label:'// الجدول الزمني النموذجي لـ MVP', timeline_phase1:'الاكتشاف', timeline_phase2:'البنية المعمارية والتصميم', timeline_phase3:'التطوير (سبرينتات)', timeline_phase4:'ضمان الجودة والأمان', timeline_phase5:'الإطلاق',
    sec_stack_tag:'التقنيات', sec_stack_h:'Stack للإنتاج',
    sec_stack_desc:'أدوات مختبرة في المعركة، لا دعاية. كل اختيار مقصود.',
    stack_cat1:'الواجهة الأمامية', stack_cat2:'الخلفية', stack_cat3:'البنية التحتية وDevOps', stack_cat4:'الذكاء الاصطناعي والتعلم الآلي',
    sec_projects_tag:'دراسات الحالة', sec_projects_h:'نتائج حقيقية',
    sec_projects_desc:'دراسات حالة مجهولة من عملائنا. أرقام حقيقية، جداول زمنية حقيقية.',
    proj1_type:'SaaS B2B · أتمتة', proj1_title:'منصة إدارة العمليات', proj1_desc:'نظام شبيه بـ CRM لشركة B2B مع 50+ موظف. أتمتة المهام الروتينية، تكامل ERP، لوحات معلومات فورية للمديرين. دورة كاملة: الاكتشاف → الإنتاج.',
    proj2_type:'سوق إلكتروني · B2C', proj2_title:'سوق الخدمات المهنية', proj2_desc:'منصة للمستقلين والعملاء مع ضمان مدمج ومراجعات وعروض فيديو ومطابقة مواهب مدعومة بالذكاء الاصطناعي عند الطلب.',
    proj3_type:'SaaS · EdTech', proj3_title:'منصة LMS للتدريب الشركات', proj3_desc:'نظام إدارة التعلم مع اختبارات وشهادات وتحليلات التقدم وتكامل نظام الموارد البشرية. بنية متعددة المستأجرين.',
    metric_weeks:'أسابيع', metric_budget:'الميزانية', metric_users:'مستخدمين / شهرين', metric_manual:'العمل اليدوي',
    metric_signups:'تسجيلات الشهر الأول', metric_rating:'تقييم المستخدم', metric_clients:'عملاء الشركات', metric_trained:'موظفين مدربين',
    sec_ai_tag:'تكاملات الذكاء الاصطناعي', sec_ai_h:'منتجات أذكى، بشكل أسرع',
    sec_ai_desc:'لا نعيد كتابة منتجك من الصفر. نضمن الذكاء الاصطناعي حيث يحقق أقصى تأثير.',
    ai1_title:'أنظمة RAG', ai1_desc:'إجابات دقيقة بناءً على بياناتك. روبوت يعرف وثائقك أو عقودك أو قاعدة معرفتك — بدون هلوسة.',
    ai2_title:'مساعدون مخصصون', ai2_desc:'روبوتات دردشة بشخصية علامتك التجارية، مدمجة في منتجك. الدعم، المبيعات، الإعداد — 24/7 دون تكبير فريقك.',
    ai3_title:'ضبط دقيق لـ LLM', ai3_desc:'نقوم بضبط النماذج بناءً على بياناتك. ذكاء اصطناعي متخصص للرعاية الصحية أو القانونية أو المالية أو أي تخصص آخر.',
    ai4_title:'واجهات صوتية', ai4_desc:'Whisper + LLM + TTS — روبوتات صوتية لمراكز الاتصال والبحث وأتمتة المكالمات. يعمل بأكثر من 40 لغة.',
    sec_contact_tag:'تواصل معنا', sec_contact_h:'لنتحدث عن مشروعك',
    sec_contact_desc:'تقدير مجاني للتكلفة والجدول الزمني في غضون 24 ساعة. بدون التزامات.',
    contact_subtitle:'لنبدأ بمحادثة', contact_text:'أخبرنا عن فكرتك — وسنقدر الجداول الزمنية والتكاليف والجانب التقني. الاستشارة الأولى مجانية وبدون التزامات.',
    form_type_label:'نوع المشروع', form_select_placeholder:'اختر...', form_opt_saas:'منصة SaaS', form_opt_marketplace:'سوق إلكتروني', form_opt_admin:'لوحة إدارة', form_opt_automation:'أتمتة', form_opt_ai:'تكامل الذكاء الاصطناعي', form_opt_other:'آخر',
    form_desc_label:'وصف المشروع', form_desc_placeholder:'أخبرنا عن فكرتك والجمهور المستهدف والميزات الرئيسية...', form_contact_label:'البريد الإلكتروني', form_contact_placeholder:'email@example.com',
    form_note:'نرد خلال 24 ساعة · لا بريد مزعج · سرية تامة',
    btn_submit:'احصل على تقدير مجاني ←',
    footer_copy:'© 2026 Queen of Spades Tech. تطوير المنتجات الرقمية.',
    nav_services:'الخدمات', nav_process:'العملية', nav_stack:'التقنيات',
    nav_projects:'المشاريع', nav_ai:'الذكاء الاصطناعي', nav_cta:'ناقش مشروعك',
  },
  ja: {
    hero_badge:'新規プロジェクト受付中',
    hero_title:'デジタル<br>製品の<br>開発を<br><span class="highlight">お任せください</span>',
    hero_sub:'4〜12週間でデジタル製品をローンチ —<br>ビジネスに集中、コードは私たちにお任せ。',
    btn_discuss:'プロジェクトを相談',
    btn_how:'開発プロセス ↓',
    trust_label:'信頼されるチーム',
    stat1:'リリース済みプロダクト', stat2:'週：平均MVP期間',
    stat3:'予算内完了率', stat4:'週でローンチ',
    sec_services_tag:'サービス内容', sec_services_h:'フルサイクル開発',
    sec_services_desc:'アーキテクチャからデプロイまで。スケールして収益化する製品に特化。',
    svc1_name:'4〜8週間でMVP', svc1_desc:'コア機能、データ統合、市場テストを備えた最小限の実用可能な製品の迅速な作成。仮説を検証するために必要なものだけ、不要なコストなしでローンチします。', svc1_tag:'市場投入時間',
    svc2_name:'SaaSプラットフォーム', svc2_desc:'サブスクリプション、安全なデータストレージ、ユーザー分析を備えたスケーラブルなプラットフォーム。成長計画を持つスタートアップや中小企業に最適。', svc2_tag:'スケーラブル',
    svc3_name:'マーケットプレイス', svc3_desc:'商品カタログ、オンライン決済、レビュー、モデレーション機能を備えたシステム。信頼性の高いインフラを通じて売り手と買い手を結びます。', svc3_tag:'B2B / B2C',
    svc4_name:'管理パネル＆ダッシュボード', svc4_desc:'柔軟なアクセスロール、ダッシュボード、リアルタイム分析を備えたデータ管理のためのユーザーフレンドリーなインターフェース。チームの生産性が向上します。', svc4_tag:'ロールベース',
    svc5_name:'自動化', svc5_desc:'定型タスクを簡素化し、既存ツールと統合し、チームの時間を節約するスクリプトとシステム。手作業を減らし、結果を増やします。', svc5_tag:'No-ops',
    svc6_name:'AI統合', svc6_desc:'チャットボット、データ分析、RAGシステム、自動分類などのスマート機能を追加。ゼロから書き直すことなく、製品の競争力を高めます。', svc6_tag:'AIファースト',
    sec_process_tag:'開発プロセス', sec_process_h:'アイデアから本番環境へ',
    sec_process_desc:'透明なプロセス、予測可能なタイムライン。サプライズなし — 動作する製品のみ。',
    step1_title:'ディスカバリー＆ユーザーストーリー', step1_desc:'アイデアに深く入り込み、ユーザーストーリー（ユーザーが実際に必要とするもの）を書き、APIファーストのデザインを作成。初日から明確なインターフェースを通じてすべてがスムーズに動作します。', step1_tag1:'ユーザーストーリー', step1_tag2:'APIファースト', step1_tag3:'Figma',
    step2_title:'アーキテクチャ＆スタック', step2_desc:'すべてがスケールするアプローチを選択。イベント駆動型またはマイクロサービス対応 — 成長目標に応じて。', step2_tag1:'イベント駆動型', step2_tag2:'マイクロサービス', step2_tag3:'クラウドネイティブ',
    step3_title:'スプリントベース開発', step3_desc:'短い2週間のイテレーション。トランクベース開発とフィーチャーフラグ — 安定性を損なうことなく新機能を有効化。', step3_tag1:'2週間スプリント', step3_tag2:'フィーチャーフラグ', step3_tag3:'トランクベース',
    step4_title:'CI/CD＆セキュリティ', step4_desc:'初日からゼロダウンタイムの自動更新。OWASP Top 10と依存関係スキャン — セキュリティは後付けではなく組み込み。', step4_tag1:'ゼロダウンタイム', step4_tag2:'OWASP', step4_tag3:'GitHub Actions',
    step5_title:'ローンチ＆引き継ぎ', step5_desc:'すぐに使える監視性 — OpenTelemetry + Prometheus/Grafana。ボトルネックの場所がわかります。ドキュメントとチームトレーニング付きの完全な引き継ぎ。', step5_tag1:'OpenTelemetry', step5_tag2:'Grafana', step5_tag3:'ドキュメント',
    timeline_label:'// 典型的なMVPタイムライン', timeline_phase1:'ディスカバリー', timeline_phase2:'アーキテクチャ＆デザイン', timeline_phase3:'開発（スプリント）', timeline_phase4:'QA＆セキュリティ', timeline_phase5:'ローンチ',
    sec_stack_tag:'技術スタック', sec_stack_h:'プロダクショングレードの技術',
    sec_stack_desc:'実戦で証明されたツール、誇大広告なし。すべての選択は意図的。',
    stack_cat1:'フロントエンド', stack_cat2:'バックエンド', stack_cat3:'インフラ＆DevOps', stack_cat4:'AI＆ML',
    sec_projects_tag:'実績', sec_projects_h:'実際の成果',
    sec_projects_desc:'クライアントの匿名ケーススタディ。実際の数字、実際のタイムライン。',
    proj1_type:'B2B SaaS · 自動化', proj1_title:'業務管理プラットフォーム', proj1_desc:'50人以上の従業員を持つB2B企業向けのCRM型システム。定型タスクの自動化、ERP統合、マネージャー向けリアルタイムダッシュボード。フルサイクル：ディスカバリー → 本番環境。',
    proj2_type:'マーケットプレイス · B2C', proj2_title:'プロフェッショナルサービスマーケットプレイス', proj2_desc:'フリーランサーとクライアント向けプラットフォーム。エスクロー統合、レビュー、ビデオプレゼンテーション、オンデマンドのAI駆動タレントマッチング。',
    proj3_type:'SaaS · EdTech', proj3_title:'企業研修向けLMSプラットフォーム', proj3_desc:'テスト、証明書、進捗分析、HRシステム統合を備えた学習管理システム。マルチテナントアーキテクチャ。',
    metric_weeks:'週', metric_budget:'予算', metric_users:'ユーザー / 2ヶ月', metric_manual:'手作業',
    metric_signups:'初月サインアップ', metric_rating:'ユーザー評価', metric_clients:'エンタープライズクライアント', metric_trained:'トレーニング済み従業員',
    sec_ai_tag:'AI統合', sec_ai_h:'スマートな製品を、より早く',
    sec_ai_desc:'製品をゼロから書き直しません。最大の効果をもたらす場所にAIを組み込みます。',
    ai1_title:'RAGシステム', ai1_desc:'データに基づいた正確な回答。ドキュメント、契約、ナレッジベースを知っているボット — 幻覚なし。',
    ai2_title:'カスタムアシスタント', ai2_desc:'ブランドの個性を持つチャットボットを製品に統合。サポート、営業、オンボーディング — チームを増やさずに24/7対応。',
    ai3_title:'LLMのファインチューニング', ai3_desc:'データに基づいてモデルをファインチューニング。医療、法務、金融、またはその他のニッチに特化したAI。',
    ai4_title:'音声インターフェース', ai4_desc:'Whisper + LLM + TTS — コールセンター、検索、通話自動化のための音声ボット。40以上の言語で動作。',
    sec_contact_tag:'お問い合わせ', sec_contact_h:'プロジェクトについて話しましょう',
    sec_contact_desc:'24時間以内に無料のコストとタイムライン見積もり。義務なし。',
    contact_subtitle:'会話から始めましょう', contact_text:'アイデアを教えてください — タイムライン、コスト、技術面を見積もります。最初の相談は無料で義務はありません。',
    form_type_label:'プロジェクトタイプ', form_select_placeholder:'選択...', form_opt_saas:'SaaSプラットフォーム', form_opt_marketplace:'マーケットプレイス', form_opt_admin:'管理パネル', form_opt_automation:'自動化', form_opt_ai:'AI統合', form_opt_other:'その他',
    form_desc_label:'プロジェクト説明', form_desc_placeholder:'アイデア、ターゲットオーディエンス、主要機能について教えてください...', form_contact_label:'メール', form_contact_placeholder:'email@example.com',
    form_note:'24時間以内に返信 · スパムなし · 完全な機密保持',
    btn_submit:'無料見積もりを取得 →',
    footer_copy:'© 2026 Queen of Spades Tech. デジタルプロダクト開発。',
    nav_services:'サービス', nav_process:'プロセス', nav_stack:'スタック',
    nav_projects:'実績', nav_ai:'AI', nav_cta:'相談する',
  },
};

// ─── EXTRA translations (subpages + missed strings on index) ───
const EXTRA_TRANSLATIONS = {
  en: {
    cmn_skip:'Skip to content', cmn_link_priv:'Privacy Policy', cmn_link_terms:'Terms', cmn_link_contact:'Contact',
    cmn_bc_home:'Home', cmn_kicker_legal:'Legal', cmn_kicker_service:'Service', cmn_related_h:'Related services',
    idx_disc_all:'Explore all services', idx_disc_mvp:'MVP development', idx_disc_saas:'SaaS development', idx_disc_mkt:'Marketplace development', idx_disc_ai:'AI integration',
    idx_tl_w1:'Wk 1–2', idx_tl_w2:'Wk 3–4', idx_tl_w3:'Wk 5–8', idx_tl_w4:'Wk 9', idx_tl_w5:'Wk 10',
    title_index:'Queen of Spades Tech — MVP, SaaS & AI Product Development',
    title_contact:'Contact — Queen of Spades Tech', title_priv:'Privacy Policy — Queen of Spades Tech',
    title_terms:'Terms of Service — Queen of Spades Tech', title_svc:'Services — Queen of Spades Tech',
    title_mvp:'MVP Development — Queen of Spades Tech', title_saas:'SaaS Development — Queen of Spades Tech',
    title_mkt:'Marketplace Development — Queen of Spades Tech', title_aii:'AI Integration — Queen of Spades Tech',
    title_404:'404 — Queen of Spades Tech',
    pg_contact_bc:'Contact', pg_contact_kicker:'Contact',
    pg_contact_h:'Start with a clear project conversation.',
    pg_contact_lead:'Share your product idea, current constraints, and timeline. We will review the request and come back with a practical next step, scope signal, and delivery direction.',
    pg_contact_c1_h:'What to expect',
    pg_contact_c1_p:'We use the website form to collect only the essentials needed to evaluate a project: product type, short description, and your email.',
    pg_contact_d1_l:'Response window', pg_contact_d1_v:'Usually within 24 business hours.',
    pg_contact_d2_l:'Best fit', pg_contact_d2_v:'MVPs, SaaS platforms, marketplaces, internal systems, and AI-enabled product features.',
    pg_contact_d3_l:'Before we reply', pg_contact_d3_v:'We review feasibility, timeline pressure, and whether the request is best handled as discovery, prototype, MVP, or production build.',
    pg_priv_bc:'Privacy Policy', pg_priv_h:'Privacy Policy',
    pg_priv_lead:'This policy explains how Queen of Spades Tech collects, uses, stores, and protects personal information submitted through the website or during business communication.',
    pg_priv_1h:'Who we are', pg_priv_1p:'Queen of Spades Tech is a digital product studio focused on MVP delivery, SaaS platforms, marketplaces, custom software, and AI integrations. For privacy-related requests, contact <a href="mailto:hello@queenofspades.tech">hello@queenofspades.tech</a>.',
    pg_priv_2h:'What we collect', pg_priv_2p:'We may collect contact details, project descriptions, company information you voluntarily submit, technical metadata such as IP address, and limited analytics required to operate, secure, and improve the website.',
    pg_priv_3h:'How we use your information',
    pg_priv_3l1:'Respond to enquiries and prepare project estimates.',
    pg_priv_3l2:'Communicate about ongoing or potential work.',
    pg_priv_3l3:'Maintain website security, logs, and fraud protection.',
    pg_priv_3l4:'Comply with legal or contractual obligations.',
    pg_priv_4h:'Legal basis', pg_priv_4p:'We process information when it is necessary to respond to your request, to take steps before entering into a contract, to operate the website securely, or when we have a legitimate business interest that does not override your privacy rights.',
    pg_priv_5h:'Data retention', pg_priv_5p:'We keep enquiry and project communication only for as long as needed to process your request, maintain records, meet legal obligations, and protect legitimate business interests. When the data is no longer needed, it is deleted or anonymized.',
    pg_priv_6h:'Third-party services', pg_priv_6p:'We may use infrastructure, analytics, email, hosting, and communication providers to operate the website and process enquiries. These providers only receive the data necessary for their role and are expected to apply appropriate safeguards.',
    pg_priv_7h:'Your rights', pg_priv_7p:'Depending on your jurisdiction, you may have the right to request access, correction, deletion, restriction, objection, or portability of your personal data. To exercise these rights, email us at <a href="mailto:hello@queenofspades.tech">hello@queenofspades.tech</a>.',
    pg_priv_8h:'Updates', pg_priv_8p:'We may update this policy when our services, legal obligations, or operational practices change. Last updated: March 21, 2026.',
    pg_terms_bc:'Terms', pg_terms_h:'Terms of Service',
    pg_terms_lead:'These terms govern access to the Queen of Spades Tech website and describe the general framework for interacting with our digital product studio.',
    pg_terms_1h:'Website use', pg_terms_1p:'By accessing this website, you agree to use it lawfully and in a manner that does not interfere with security, availability, or the experience of other users.',
    pg_terms_2h:'Informational content', pg_terms_2p:'Website materials are provided for general business and informational purposes. They do not constitute legal, financial, or technical guarantees unless explicitly confirmed in a signed agreement.',
    pg_terms_3h:'Project estimates and proposals', pg_terms_3p:'Any timeline, cost estimate, or implementation scope shared before contract signature is indicative and may change after discovery, specification, or technical validation.',
    pg_terms_4h:'Intellectual property', pg_terms_4p:'Unless otherwise agreed in writing, all intellectual property rights in website content, visual design, branding, and proprietary materials remain with Queen of Spades Tech or their respective owners.',
    pg_terms_5h:'Client materials', pg_terms_5p:'You confirm that any materials, data, or instructions you provide may be used by us only for evaluating or delivering the requested work, subject to confidentiality and contract terms where applicable.',
    pg_terms_6h:'External links', pg_terms_6p:'The website may link to third-party services and platforms. We are not responsible for the availability, content, or policies of those external resources.',
    pg_terms_7h:'Limitation of liability', pg_terms_7p:'To the maximum extent allowed by law, Queen of Spades Tech is not liable for indirect, incidental, or consequential damages arising from website use, service interruptions, or reliance on informational content.',
    pg_terms_8h:'Changes', pg_terms_8p:'We may update these terms to reflect changes in the website, our services, or legal requirements. Continued use of the website after updates means you accept the revised terms. Last updated: March 21, 2026.',
    pg_svc_bc:'Services', pg_svc_kicker:'Services',
    pg_svc_h:'Product development services built for launch, growth, and clarity.',
    pg_svc_lead:'We help founders and teams move from idea to production without bloated scope. Each service line is designed around shipping a usable product fast and keeping the architecture clean enough to scale.',
    pg_svc_c1_h:'How we structure engagements',
    pg_svc_c1_p:'We usually start with a short discovery pass, define the smallest useful scope, and move into staged delivery. That keeps cost and timeline predictable while leaving room for iteration.',
    pg_svc_c1_d1_l:'Typical engagement', pg_svc_c1_d1_v:'Discovery, design direction, architecture, build, QA, launch support.',
    pg_svc_c1_d2_l:'Delivery style', pg_svc_c1_d2_v:'Fast iterations, direct communication, practical tradeoff decisions, and production-minded implementation.',
    pg_svc_c1_d3_l:'Best for', pg_svc_c1_d3_v:'Teams that need momentum, technical clarity, and a partner who can own delivery end-to-end.',
    pg_svc_c2_h:'What we can help with',
    pg_svc_c2_p:'Our strongest work sits at the intersection of product thinking, clean engineering, and business goals. The service pages below break out the most common engagement paths.',
    pg_svc_cta_s:'Need help picking the right path?',
    pg_svc_cta_t:'If you are unsure whether you need discovery, an MVP, or a larger build, we can map that in one conversation.',
    pg_svc_cta_b:'Open contact page',
    pg_svc_lines_h:'Core service lines',
    pg_svc_l_mvp_e:'Launch fast', pg_svc_l_mvp_t:'MVP Development', pg_svc_l_mvp_c:'Validate a product idea with the smallest complete version that users can actually try, buy, or adopt.',
    pg_svc_l_saas_e:'Recurring revenue', pg_svc_l_saas_t:'SaaS Development', pg_svc_l_saas_c:'Build subscription-based software with account structure, permissions, billing logic, and admin visibility.',
    pg_svc_l_mkt_e:'Two-sided products', pg_svc_l_mkt_t:'Marketplace Development', pg_svc_l_mkt_c:'Create buyer-seller platforms with catalog, search, onboarding, reviews, and operational controls.',
    pg_svc_l_ai_e:'AI enablement', pg_svc_l_ai_t:'AI Integration', pg_svc_l_ai_c:'Add assistants, retrieval, classification, workflow automation, and other AI features to existing or new products.',
    pg_mvp_bc:'MVP Development',
    pg_mvp_h:'MVP development with enough speed to launch and enough structure to keep building.',
    pg_mvp_lead:'We help founders and product teams scope the smallest version that proves the idea, reaches users quickly, and avoids expensive rewrites right after launch.',
    pg_mvp_c1_h:'What is usually included',
    pg_mvp_d1_l:'Scope shaping', pg_mvp_d1_v:'Feature prioritization, user flow mapping, and practical sequencing around launch value.',
    pg_mvp_d2_l:'Core build', pg_mvp_d2_v:'Frontend, backend, database, auth, admin visibility, and the critical product loop.',
    pg_mvp_d3_l:'Launch support', pg_mvp_d3_v:'Deployment, QA, analytics basics, and handoff notes for the next build stage.',
    pg_mvp_c2_h:'Best fit',
    pg_mvp_c2_p:'This service is a good fit when you need a real product in market fast, but still want sane architecture, delivery discipline, and a clear next step after validation.',
    pg_mvp_d4_l:'Typical use cases', pg_mvp_d4_v:'Founder-led startups, internal venture teams, pilot products, and pre-seed launches.',
    pg_mvp_d5_l:'Common outcome', pg_mvp_d5_v:'A launchable first version that proves demand, supports demos, and is usable by actual early customers.',
    pg_mvp_ap_h:'How we approach MVP scope',
    pg_mvp_ap_p:'We focus on the smallest complete product loop instead of stacking nice-to-have features. That usually means one strong user journey, one workable admin path, and only the integrations that are necessary for launch.',
    pg_mvp_ul1:'Define the user action that proves value fastest.',
    pg_mvp_ul2:'Build around the fewest features needed to complete that action.',
    pg_mvp_ul3:'Keep the technical base clean enough for iteration after launch.',
    pg_mvp_cta_s:'Need an MVP estimate?',
    pg_mvp_cta_t:'Share the product idea, target audience, and what the first release must prove.',
    pg_mvp_cta_b:'Request estimate',
    pg_mvp_r_saas_e:'Next stage', pg_mvp_r_saas_c:'For products that are moving from launch to recurring revenue, account structure, and operational scale.',
    pg_mvp_r_ai_e:'Feature acceleration', pg_mvp_r_ai_c:'For teams that want to add assistants, search, classification, or workflow automation to the MVP.',
    pg_saas_bc:'SaaS Development',
    pg_saas_h:'SaaS development for products that need recurring revenue, account logic, and operational trust.',
    pg_saas_lead:'We build subscription-based products with the infrastructure and workflows teams usually start needing as soon as usage grows: permissions, billing flow, admin visibility, and stable core data models.',
    pg_saas_c1_h:'Common SaaS building blocks',
    pg_saas_d1_l:'Accounts and roles', pg_saas_d1_v:'Teams, workspaces, account boundaries, permissions, and audit-aware admin actions.',
    pg_saas_d2_l:'Revenue mechanics', pg_saas_d2_v:'Plans, usage logic, billing events, upgrade paths, and support for operational visibility.',
    pg_saas_d3_l:'Platform stability', pg_saas_d3_v:'Clear data structure, internal tooling, logs, QA coverage, and deployment readiness.',
    pg_saas_c2_h:'When teams call us',
    pg_saas_c2_p:'Usually when the product has to stop behaving like a prototype and start acting like a durable business system. That often means more than just adding features.',
    pg_saas_ul1:'Subscription logic needs to be reliable.',
    pg_saas_ul2:'Multiple user roles are becoming hard to manage.',
    pg_saas_ul3:'Internal operations need admin tooling and visibility.',
    pg_saas_ul4:'Growth depends on cleaner architecture.',
    pg_saas_op_h:'What we optimize for',
    pg_saas_op_p:'In SaaS products, the real work is usually in the edges: onboarding, permission boundaries, account-level data handling, support tooling, and how changes roll out over time. We keep the product usable for customers and manageable for the team behind it.',
    pg_saas_cta_s:'Planning a SaaS build or refactor?',
    pg_saas_cta_t:'We can review the product model, expected billing flow, and operational constraints before implementation starts.',
    pg_saas_cta_b:'Discuss the product',
    pg_saas_r_mvp_e:'Earlier stage', pg_saas_r_mvp_c:'For teams still defining the first launchable product version and the minimum scope that proves value.',
    pg_saas_r_ai_e:'Product enhancement', pg_saas_r_ai_c:'For SaaS teams that want search, assistants, classification, or automation embedded into the platform.',
    pg_mkt_bc:'Marketplace Development',
    pg_mkt_h:'Marketplace development for products that need trust, liquidity, and operational control.',
    pg_mkt_lead:'Marketplace products are rarely just a catalog and checkout. They need onboarding logic, search quality, moderation, transaction flows, and admin tooling that keeps both sides of the market moving.',
    pg_mkt_c1_h:'Typical marketplace scope',
    pg_mkt_d1_l:'Participant flows', pg_mkt_d1_v:'Buyer and seller onboarding, profile states, role-specific actions, and account quality checks.',
    pg_mkt_d2_l:'Trust systems', pg_mkt_d2_v:'Reviews, moderation, approval queues, dispute-aware flows, and visibility for platform operators.',
    pg_mkt_d3_l:'Commercial logic', pg_mkt_d3_v:'Listings, payments, fees, matching, status tracking, and support for operational edge cases.',
    pg_mkt_c2_h:'What usually matters most',
    pg_mkt_c2_p:'In marketplaces, growth depends on more than features. Conversion, trust, and operational clarity all shape whether supply and demand can actually meet.',
    pg_mkt_ul1:'Search and discovery need to make good matches quickly.',
    pg_mkt_ul2:'Operational teams need internal tools, not spreadsheet workarounds.',
    pg_mkt_ul3:'The transaction path must feel safe for both sides.',
    pg_mkt_ul4:'Rules and moderation have to be enforceable inside the product.',
    pg_mkt_ap_h:'How we keep marketplace builds practical',
    pg_mkt_ap_p:'We break the platform into the essential loops first: supply creation, demand discovery, trust signals, and transaction completion. That helps the team launch a strong first version instead of getting buried in admin complexity too early.',
    pg_mkt_cta_s:'Working on a two-sided platform?',
    pg_mkt_cta_t:'Tell us who the users are, how they meet, and where trust or transaction risk appears in the flow.',
    pg_mkt_cta_b:'Start the conversation',
    pg_mkt_r_mvp_e:'Launch path', pg_mkt_r_mvp_c:'For marketplaces that need a focused first release to test liquidity, matching, and willingness to transact.',
    pg_mkt_r_ai_e:'Marketplace intelligence', pg_mkt_r_ai_c:'For ranking, classification, summarization, support assistants, and quality control inside the platform.',
    pg_aii_bc:'AI Integration',
    pg_aii_h:'AI integration for products that need practical automation, better retrieval, and smarter user flows.',
    pg_aii_lead:'We add AI where it creates actual leverage inside the product: support, search, summarization, classification, internal tooling, and workflow acceleration. The goal is usefulness, not novelty.',
    pg_aii_c1_h:'Where AI tends to help most',
    pg_aii_d1_l:'Customer-facing experiences', pg_aii_d1_v:'Assistants, guided search, knowledge retrieval, onboarding help, and message drafting.',
    pg_aii_d2_l:'Internal operations', pg_aii_d2_v:'Classification, summarization, routing, triage, enrichment, and repetitive workflow reduction.',
    pg_aii_d3_l:'Decision support', pg_aii_d3_v:'Document understanding, structured extraction, and product features driven by your own business data.',
    pg_aii_c2_h:'How we keep it usable',
    pg_aii_c2_p:'Good AI features need more than model calls. They need the right context, fallback behavior, evaluation logic, and a product flow that remains reliable when the model output is imperfect.',
    pg_aii_ul1:'We define the exact task the AI feature should improve.',
    pg_aii_ul2:'We connect the right data sources and guardrails.',
    pg_aii_ul3:'We make the feature measurable and testable in context.',
    pg_aii_ep_h:'Typical engagement paths',
    pg_aii_ep_p:'Sometimes AI integration is a standalone feature project. Sometimes it is part of a broader platform build. We can work either way, as long as the product goal is clear.',
    pg_aii_l_mvp_e:'Fast launch', pg_aii_l_mvp_t:'AI-first MVP', pg_aii_l_mvp_c:'Launch a focused product where the AI feature is central to the first user value proposition.',
    pg_aii_l_saas_e:'Platform layer', pg_aii_l_saas_t:'SaaS enhancement', pg_aii_l_saas_c:'Embed assistants, retrieval, and automation into an existing SaaS platform without rewriting core flows.',
    pg_aii_cta_s:'Have an AI feature in mind?',
    pg_aii_cta_t:'Send the use case, source data, and where the current workflow is breaking down.',
    pg_aii_cta_b:'Discuss AI integration',
    pg_404_code:'Error 404',
    pg_404_h:'The page drifted out of orbit.',
    pg_404_lead:'The address may have changed or the page no longer exists. You can return to the homepage, browse our services, or jump straight to the contact page.',
    pg_404_btn_home:'Go to homepage',
    pg_404_btn_services:'Browse services',
    pg_404_btn_contact:'Open contact page',
  },
  ru: {
    cmn_skip:'Перейти к содержимому', cmn_link_priv:'Политика конфиденциальности', cmn_link_terms:'Условия', cmn_link_contact:'Контакты',
    cmn_bc_home:'Главная', cmn_kicker_legal:'Юридическое', cmn_kicker_service:'Услуга', cmn_related_h:'Связанные услуги',
    idx_disc_all:'Все услуги', idx_disc_mvp:'Разработка MVP', idx_disc_saas:'Разработка SaaS', idx_disc_mkt:'Разработка маркетплейсов', idx_disc_ai:'ИИ-интеграции',
    idx_tl_w1:'Нед. 1–2', idx_tl_w2:'Нед. 3–4', idx_tl_w3:'Нед. 5–8', idx_tl_w4:'Нед. 9', idx_tl_w5:'Нед. 10',
    title_index:'Queen of Spades Tech — разработка MVP, SaaS и ИИ-продуктов',
    title_contact:'Контакты — Queen of Spades Tech', title_priv:'Политика конфиденциальности — Queen of Spades Tech',
    title_terms:'Условия использования — Queen of Spades Tech', title_svc:'Услуги — Queen of Spades Tech',
    title_mvp:'Разработка MVP — Queen of Spades Tech', title_saas:'Разработка SaaS — Queen of Spades Tech',
    title_mkt:'Разработка маркетплейсов — Queen of Spades Tech', title_aii:'ИИ-интеграция — Queen of Spades Tech',
    title_404:'404 — Queen of Spades Tech',
    pg_contact_bc:'Контакты', pg_contact_kicker:'Контакты',
    pg_contact_h:'Начнём с чёткого разговора о вашем проекте.',
    pg_contact_lead:'Расскажите об идее продукта, текущих ограничениях и сроках. Мы рассмотрим запрос и вернёмся с практичным следующим шагом, оценкой объёма и направлением реализации.',
    pg_contact_c1_h:'Чего ожидать',
    pg_contact_c1_p:'Через форму на сайте мы собираем только то, что нужно для оценки проекта: тип продукта, короткое описание и ваш email.',
    pg_contact_d1_l:'Время ответа', pg_contact_d1_v:'Обычно в течение 24 рабочих часов.',
    pg_contact_d2_l:'С чем работаем лучше всего', pg_contact_d2_v:'MVP, SaaS-платформы, маркетплейсы, внутренние системы и продуктовые ИИ-функции.',
    pg_contact_d3_l:'Что мы делаем до ответа', pg_contact_d3_v:'Оцениваем реализуемость, давление сроков и какой формат подходит лучше: discovery, прототип, MVP или production-сборка.',
    pg_priv_bc:'Политика конфиденциальности', pg_priv_h:'Политика конфиденциальности',
    pg_priv_lead:'Эта политика описывает, как Queen of Spades Tech собирает, использует, хранит и защищает персональные данные, переданные через сайт или в ходе деловой переписки.',
    pg_priv_1h:'Кто мы', pg_priv_1p:'Queen of Spades Tech — студия разработки цифровых продуктов: MVP, SaaS-платформы, маркетплейсы, кастомное ПО и ИИ-интеграции. По вопросам конфиденциальности пишите на <a href="mailto:hello@queenofspades.tech">hello@queenofspades.tech</a>.',
    pg_priv_2h:'Что мы собираем', pg_priv_2p:'Мы можем собирать контактные данные, описания проектов, сведения о компании, которые вы передаёте добровольно, технические метаданные (например, IP-адрес) и минимальную аналитику для работы, защиты и улучшения сайта.',
    pg_priv_3h:'Как мы используем информацию',
    pg_priv_3l1:'Отвечать на запросы и готовить оценки проектов.',
    pg_priv_3l2:'Вести коммуникацию по текущей или потенциальной работе.',
    pg_priv_3l3:'Поддерживать безопасность сайта, логирование и защиту от мошенничества.',
    pg_priv_3l4:'Выполнять юридические или договорные обязательства.',
    pg_priv_4h:'Правовое основание', pg_priv_4p:'Мы обрабатываем информацию, когда это необходимо для ответа на ваш запрос, шагов перед заключением договора, безопасной работы сайта или когда у нас есть законный деловой интерес, не превосходящий ваши права на конфиденциальность.',
    pg_priv_5h:'Срок хранения', pg_priv_5p:'Мы храним переписку по запросам и проектам только столько, сколько нужно для обработки запроса, ведения учёта, выполнения юридических обязательств и защиты законных деловых интересов. Когда данные больше не нужны — мы их удаляем или анонимизируем.',
    pg_priv_6h:'Сторонние сервисы', pg_priv_6p:'Мы можем использовать поставщиков инфраструктуры, аналитики, email, хостинга и коммуникации для работы сайта и обработки запросов. Эти поставщики получают только те данные, которые нужны для их роли, и должны применять соответствующие меры защиты.',
    pg_priv_7h:'Ваши права', pg_priv_7p:'В зависимости от юрисдикции у вас могут быть права на доступ, исправление, удаление, ограничение, возражение или перенос ваших персональных данных. Чтобы воспользоваться этими правами, напишите нам на <a href="mailto:hello@queenofspades.tech">hello@queenofspades.tech</a>.',
    pg_priv_8h:'Обновления', pg_priv_8p:'Мы можем обновлять эту политику при изменении услуг, юридических требований или операционных практик. Последнее обновление: 21 марта 2026.',
    pg_terms_bc:'Условия', pg_terms_h:'Условия использования',
    pg_terms_lead:'Эти условия регулируют доступ к сайту Queen of Spades Tech и описывают общие принципы взаимодействия с нашей студией разработки цифровых продуктов.',
    pg_terms_1h:'Использование сайта', pg_terms_1p:'Заходя на сайт, вы соглашаетесь использовать его законно и так, чтобы не нарушать безопасность, доступность или работу других пользователей.',
    pg_terms_2h:'Информационный контент', pg_terms_2p:'Материалы сайта предоставлены для общих деловых и информационных целей. Они не являются юридическими, финансовыми или техническими гарантиями, если это не подтверждено явно в подписанном договоре.',
    pg_terms_3h:'Оценки и предложения', pg_terms_3p:'Любые сроки, оценки стоимости или объёмы работ, озвученные до подписания договора, носят ориентировочный характер и могут измениться после discovery, спецификации или технической валидации.',
    pg_terms_4h:'Интеллектуальная собственность', pg_terms_4p:'Если иное не согласовано в письменном виде, все права интеллектуальной собственности на контент сайта, визуальный дизайн, брендинг и проприетарные материалы принадлежат Queen of Spades Tech или их правообладателям.',
    pg_terms_5h:'Материалы клиента', pg_terms_5p:'Вы подтверждаете, что материалы, данные или инструкции, которые вы предоставляете, могут использоваться нами только для оценки или выполнения запрошенной работы, в рамках конфиденциальности и условий договора, где применимо.',
    pg_terms_6h:'Внешние ссылки', pg_terms_6p:'Сайт может ссылаться на сторонние сервисы и платформы. Мы не отвечаем за доступность, контент или политики этих внешних ресурсов.',
    pg_terms_7h:'Ограничение ответственности', pg_terms_7p:'В максимально допустимой законом степени Queen of Spades Tech не несёт ответственности за косвенные, случайные или последующие убытки, возникающие из использования сайта, перерывов в работе или доверия к информационному контенту.',
    pg_terms_8h:'Изменения', pg_terms_8p:'Мы можем обновлять эти условия при изменениях сайта, услуг или юридических требований. Продолжение использования сайта после обновлений означает согласие с новой редакцией. Последнее обновление: 21 марта 2026.',
    pg_svc_bc:'Услуги', pg_svc_kicker:'Услуги',
    pg_svc_h:'Услуги по разработке продуктов с понятным запуском, ростом и прозрачностью.',
    pg_svc_lead:'Помогаем фаундерам и командам пройти путь от идеи до production без раздутого scope. Каждое направление построено так, чтобы быстро выпускать рабочий продукт и держать архитектуру достаточно чистой для роста.',
    pg_svc_c1_h:'Как мы структурируем работу',
    pg_svc_c1_p:'Обычно начинаем с короткой discovery-фазы, определяем минимальный полезный scope и переходим к поэтапной поставке. Это держит стоимость и сроки предсказуемыми и оставляет место для итераций.',
    pg_svc_c1_d1_l:'Типичная работа', pg_svc_c1_d1_v:'Discovery, дизайн-направление, архитектура, разработка, QA, поддержка запуска.',
    pg_svc_c1_d2_l:'Стиль работы', pg_svc_c1_d2_v:'Быстрые итерации, прямая коммуникация, практичные компромиссы и production-минд реализация.',
    pg_svc_c1_d3_l:'Кому подходит', pg_svc_c1_d3_v:'Командам, которым нужны темп, техническая ясность и партнёр, способный взять доставку полностью на себя.',
    pg_svc_c2_h:'С чем мы можем помочь',
    pg_svc_c2_p:'Наша сильная сторона — на пересечении продуктового мышления, чистой инженерии и бизнес-целей. На страницах услуг ниже показаны самые частые форматы работы.',
    pg_svc_cta_s:'Нужна помощь с выбором направления?',
    pg_svc_cta_t:'Если не уверены, нужны ли вам discovery, MVP или более крупная сборка — мы можем разобраться за один разговор.',
    pg_svc_cta_b:'Открыть страницу контактов',
    pg_svc_lines_h:'Основные направления услуг',
    pg_svc_l_mvp_e:'Быстрый запуск', pg_svc_l_mvp_t:'Разработка MVP', pg_svc_l_mvp_c:'Проверьте идею продукта в минимальной полноценной версии, которой пользователи смогут реально воспользоваться, купить или принять.',
    pg_svc_l_saas_e:'Регулярная выручка', pg_svc_l_saas_t:'Разработка SaaS', pg_svc_l_saas_c:'Подписочный продукт со структурой аккаунтов, ролями, биллинговой логикой и видимостью для администраторов.',
    pg_svc_l_mkt_e:'Двусторонние продукты', pg_svc_l_mkt_t:'Разработка маркетплейсов', pg_svc_l_mkt_c:'Платформы покупатель-продавец с каталогом, поиском, онбордингом, отзывами и операционным контролем.',
    pg_svc_l_ai_e:'ИИ-возможности', pg_svc_l_ai_t:'ИИ-интеграция', pg_svc_l_ai_c:'Добавляем ассистентов, retrieval, классификацию, автоматизацию воркфлоу и другие ИИ-функции в новые и существующие продукты.',
    pg_mvp_bc:'Разработка MVP',
    pg_mvp_h:'Разработка MVP — достаточно быстрая для запуска и достаточно структурированная, чтобы строить дальше.',
    pg_mvp_lead:'Помогаем фаундерам и продуктовым командам определить минимальную версию, которая проверит идею, быстро дойдёт до пользователей и не потребует дорогостоящих переписываний сразу после запуска.',
    pg_mvp_c1_h:'Что обычно включено',
    pg_mvp_d1_l:'Формирование scope', pg_mvp_d1_v:'Приоритизация функций, маппинг пользовательских флоу и практичная последовательность вокруг ценности запуска.',
    pg_mvp_d2_l:'Базовая сборка', pg_mvp_d2_v:'Фронтенд, бэкенд, БД, авторизация, видимость для админов и критический продуктовый цикл.',
    pg_mvp_d3_l:'Поддержка запуска', pg_mvp_d3_v:'Деплой, QA, основы аналитики и передача с заметками для следующего этапа.',
    pg_mvp_c2_h:'Кому подходит',
    pg_mvp_c2_p:'Услуга подходит, когда нужен реальный продукт на рынке быстро, но при этом важна здоровая архитектура, дисциплина доставки и понятный следующий шаг после валидации.',
    pg_mvp_d4_l:'Типичные сценарии', pg_mvp_d4_v:'Стартапы под лидерством фаундера, внутренние венчурные команды, пилотные продукты и pre-seed запуски.',
    pg_mvp_d5_l:'Обычный результат', pg_mvp_d5_v:'Запускаемая первая версия, которая подтверждает спрос, годится для демо и реально используется первыми клиентами.',
    pg_mvp_ap_h:'Как мы подходим к scope MVP',
    pg_mvp_ap_p:'Фокусируемся на минимальном полном продуктовом цикле, а не на накоплении nice-to-have функций. Обычно это один сильный пользовательский путь, один рабочий админ-сценарий и только те интеграции, которые нужны для запуска.',
    pg_mvp_ul1:'Определяем действие пользователя, которое быстрее всего подтверждает ценность.',
    pg_mvp_ul2:'Собираем минимальный набор функций для этого действия.',
    pg_mvp_ul3:'Держим техническую основу чистой для итераций после запуска.',
    pg_mvp_cta_s:'Нужна оценка MVP?',
    pg_mvp_cta_t:'Расскажите идею продукта, аудиторию и что должен подтвердить первый релиз.',
    pg_mvp_cta_b:'Запросить оценку',
    pg_mvp_r_saas_e:'Следующий этап', pg_mvp_r_saas_c:'Для продуктов, переходящих от запуска к регулярной выручке, аккаунтам и операционному масштабу.',
    pg_mvp_r_ai_e:'Ускорение функций', pg_mvp_r_ai_c:'Для команд, которые хотят добавить в MVP ассистентов, поиск, классификацию или автоматизацию воркфлоу.',
    pg_saas_bc:'Разработка SaaS',
    pg_saas_h:'Разработка SaaS для продуктов, которым нужна регулярная выручка, аккаунтная логика и операционная надёжность.',
    pg_saas_lead:'Строим подписочные продукты с инфраструктурой и воркфлоу, которые команды обычно начинают требовать, как только растёт использование: права, биллинг, видимость для админов и стабильные модели данных.',
    pg_saas_c1_h:'Типичные строительные блоки SaaS',
    pg_saas_d1_l:'Аккаунты и роли', pg_saas_d1_v:'Команды, воркспейсы, границы аккаунтов, права и админ-действия с аудитом.',
    pg_saas_d2_l:'Механика выручки', pg_saas_d2_v:'Тарифы, usage-логика, биллинговые события, апгрейды и поддержка операционной видимости.',
    pg_saas_d3_l:'Стабильность платформы', pg_saas_d3_v:'Чёткая структура данных, внутренние инструменты, логи, покрытие QA и готовность к деплою.',
    pg_saas_c2_h:'Когда к нам обращаются',
    pg_saas_c2_p:'Обычно когда продукт должен перестать вести себя как прототип и начать работать как устойчивая бизнес-система. Это часто значит больше, чем просто добавление функций.',
    pg_saas_ul1:'Логика подписки должна быть надёжной.',
    pg_saas_ul2:'Множественные роли становится сложно поддерживать.',
    pg_saas_ul3:'Внутренним операциям нужны админ-инструменты и видимость.',
    pg_saas_ul4:'Рост зависит от более чистой архитектуры.',
    pg_saas_op_h:'На что мы оптимизируем',
    pg_saas_op_p:'В SaaS-продуктах настоящая работа обычно на границах: онбординг, права доступа, обработка данных на уровне аккаунта, инструменты поддержки и то, как изменения раскатываются со временем. Продукт остаётся удобным для клиентов и управляемым для команды.',
    pg_saas_cta_s:'Планируете сборку или рефакторинг SaaS?',
    pg_saas_cta_t:'Мы можем разобрать продуктовую модель, ожидаемый биллинг-флоу и операционные ограничения до начала разработки.',
    pg_saas_cta_b:'Обсудить продукт',
    pg_saas_r_mvp_e:'Ранний этап', pg_saas_r_mvp_c:'Для команд, которые ещё определяют первую запускаемую версию и минимальный scope для проверки ценности.',
    pg_saas_r_ai_e:'Улучшение продукта', pg_saas_r_ai_c:'Для SaaS-команд, которым нужны поиск, ассистенты, классификация или автоматизация, встроенные в платформу.',
    pg_mkt_bc:'Разработка маркетплейсов',
    pg_mkt_h:'Разработка маркетплейсов для продуктов, которым нужны доверие, ликвидность и операционный контроль.',
    pg_mkt_lead:'Маркетплейс редко сводится к каталогу и оплате. Нужна логика онбординга, качественный поиск, модерация, транзакционные флоу и админ-инструменты, которые держат обе стороны рынка в движении.',
    pg_mkt_c1_h:'Типичный scope маркетплейса',
    pg_mkt_d1_l:'Флоу участников', pg_mkt_d1_v:'Онбординг покупателей и продавцов, состояния профилей, ролевые действия и проверка качества аккаунтов.',
    pg_mkt_d2_l:'Системы доверия', pg_mkt_d2_v:'Отзывы, модерация, очереди подтверждения, флоу с учётом споров и видимость для операторов платформы.',
    pg_mkt_d3_l:'Коммерческая логика', pg_mkt_d3_v:'Листинги, платежи, комиссии, мэтчинг, отслеживание статусов и поддержка операционных edge-кейсов.',
    pg_mkt_c2_h:'Что обычно важнее всего',
    pg_mkt_c2_p:'На маркетплейсе рост зависит не только от функций. Конверсия, доверие и операционная ясность определяют, смогут ли спрос и предложение реально встретиться.',
    pg_mkt_ul1:'Поиск и обнаружение должны быстро находить хорошие совпадения.',
    pg_mkt_ul2:'Операционным командам нужны внутренние инструменты, а не обходные решения в таблицах.',
    pg_mkt_ul3:'Путь сделки должен ощущаться безопасным для обеих сторон.',
    pg_mkt_ul4:'Правила и модерация должны быть применимыми внутри продукта.',
    pg_mkt_ap_h:'Как мы делаем маркетплейс-сборки практичными',
    pg_mkt_ap_p:'Разбиваем платформу сначала на основные циклы: создание предложения, обнаружение спроса, сигналы доверия и завершение сделки. Это помогает команде запустить сильную первую версию, а не утонуть в админ-сложности слишком рано.',
    pg_mkt_cta_s:'Работаете над двусторонней платформой?',
    pg_mkt_cta_t:'Расскажите, кто пользователи, как они встречаются и где во флоу появляется риск доверия или сделки.',
    pg_mkt_cta_b:'Начать разговор',
    pg_mkt_r_mvp_e:'Путь к запуску', pg_mkt_r_mvp_c:'Для маркетплейсов, которым нужна сфокусированная первая версия для проверки ликвидности, мэтчинга и готовности совершать сделки.',
    pg_mkt_r_ai_e:'Интеллект маркетплейса', pg_mkt_r_ai_c:'Для ранжирования, классификации, суммаризации, ассистентов поддержки и контроля качества внутри платформы.',
    pg_aii_bc:'ИИ-интеграция',
    pg_aii_h:'ИИ-интеграция для продуктов, которым нужны практичная автоматизация, лучший retrieval и умные пользовательские флоу.',
    pg_aii_lead:'Добавляем ИИ там, где он даёт реальный рычаг внутри продукта: поддержка, поиск, суммаризация, классификация, внутренние инструменты и ускорение воркфлоу. Цель — польза, а не новизна.',
    pg_aii_c1_h:'Где ИИ помогает чаще всего',
    pg_aii_d1_l:'Клиентский опыт', pg_aii_d1_v:'Ассистенты, направленный поиск, retrieval знаний, помощь в онбординге и черновики сообщений.',
    pg_aii_d2_l:'Внутренние операции', pg_aii_d2_v:'Классификация, суммаризация, маршрутизация, триаж, обогащение и сокращение повторяющихся воркфлоу.',
    pg_aii_d3_l:'Поддержка решений', pg_aii_d3_v:'Понимание документов, структурированное извлечение и продуктовые функции на основе ваших бизнес-данных.',
    pg_aii_c2_h:'Как мы делаем это пригодным к использованию',
    pg_aii_c2_p:'Хорошим ИИ-функциям нужно больше, чем вызовы моделей. Нужны правильный контекст, fallback-поведение, логика оценки и продуктовый флоу, который остаётся надёжным, когда вывод модели несовершенен.',
    pg_aii_ul1:'Определяем точную задачу, которую должна улучшить ИИ-функция.',
    pg_aii_ul2:'Подключаем правильные источники данных и guardrails.',
    pg_aii_ul3:'Делаем функцию измеримой и тестируемой в контексте.',
    pg_aii_ep_h:'Типичные форматы работы',
    pg_aii_ep_p:'Иногда ИИ-интеграция — отдельный feature-проект. Иногда — часть более крупной сборки платформы. Работаем в обоих форматах, пока продуктовая цель ясна.',
    pg_aii_l_mvp_e:'Быстрый запуск', pg_aii_l_mvp_t:'AI-first MVP', pg_aii_l_mvp_c:'Запуск сфокусированного продукта, где ИИ-функция в центре первого ценностного предложения.',
    pg_aii_l_saas_e:'Слой платформы', pg_aii_l_saas_t:'Усиление SaaS', pg_aii_l_saas_c:'Встраиваем ассистентов, retrieval и автоматизацию в существующую SaaS-платформу без переписывания основных флоу.',
    pg_aii_cta_s:'Есть идея ИИ-функции?',
    pg_aii_cta_t:'Опишите use case, источник данных и где сейчас ломается воркфлоу.',
    pg_aii_cta_b:'Обсудить ИИ-интеграцию',
    pg_404_code:'Ошибка 404',
    pg_404_h:'Страница ушла с орбиты.',
    pg_404_lead:'Адрес мог измениться или страница больше не существует. Можно вернуться на главную, перейти к услугам или сразу в контакты.',
    pg_404_btn_home:'На главную',
    pg_404_btn_services:'Перейти к услугам',
    pg_404_btn_contact:'Открыть контакты',
  },
};

// Merge extras into TRANSLATIONS so future apply calls see them.
// Subpage keys missing in a language fall back to English via applyLang's fallback chain below.
Object.keys(EXTRA_TRANSLATIONS).forEach(function(lang){
  if (TRANSLATIONS[lang]) Object.assign(TRANSLATIONS[lang], EXTRA_TRANSLATIONS[lang]);
});
// For languages without an explicit subpage translation, copy English subpage keys as fallback
// so subpages still render text instead of raw HTML defaults.
Object.keys(TRANSLATIONS).forEach(function(lang){
  if (lang === 'en' || lang === 'ru') return;
  Object.keys(EXTRA_TRANSLATIONS.en).forEach(function(k){
    if (!(k in TRANSLATIONS[lang])) TRANSLATIONS[lang][k] = EXTRA_TRANSLATIONS.en[k];
  });
});

// Nav link keys in order
const NAV_KEYS = ['nav_services','nav_process','nav_stack','nav_projects','nav_ai'];

let currentLang = 'en';

function applyLang(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  // Translate all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // Translate placeholder attributes (data-i18n-placeholder)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
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

function getFormUiCopy() {
  if (currentLang === 'ru') {
    return {
      sending: 'Отправляем...',
      success: 'Спасибо! Заявка отправлена. Мы скоро свяжемся с вами.',
      validation: 'Заполните описание проекта и email.',
      rateLimit: 'Слишком часто. Попробуйте еще раз чуть позже.',
      error: 'Не удалось отправить форму. Напишите нам на hello@queenofspades.tech.'
    };
  }

  return {
    sending: 'Sending...',
    success: 'Thanks! Your request has been sent. We will get back to you soon.',
    validation: 'Please enter a valid project description and email.',
    rateLimit: 'Too many attempts. Please try again a little later.',
    error: 'Could not send the form. Please email us at hello@queenofspades.tech.'
  };
}

function setFormStatus(statusEl, state, message) {
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.classList.remove('is-pending', 'is-success', 'is-error');
  if (state) statusEl.classList.add(state);
}

document.addEventListener('DOMContentLoaded', () => {
  applyLang(localStorage.getItem('lang') || 'en');

  // ─── Burger menu ───
  const pageHeader = document.querySelector('header');
  const burger = document.getElementById('burgerBtn');
  const navLinks = document.getElementById('navLinks');
  const menuOverlay = document.getElementById('menuOverlay');
  if (burger && navLinks && menuOverlay) {
    const closeBurgerMenu = () => {
      burger.classList.remove('open');
      navLinks.classList.remove('open');
      menuOverlay.classList.remove('open');
      pageHeader?.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
    };

    const openBurgerMenu = () => {
      burger.classList.add('open');
      navLinks.classList.add('open');
      menuOverlay.classList.add('open');
      pageHeader?.classList.add('menu-open');
      document.body.classList.add('menu-open');
      burger.setAttribute('aria-expanded', 'true');
    };

    burger.addEventListener('click', event => {
      event.stopPropagation();
      if (burger.classList.contains('open')) {
        closeBurgerMenu();
        return;
      }
      openBurgerMenu();
    });

    menuOverlay.addEventListener('click', closeBurgerMenu);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeBurgerMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        closeBurgerMenu();
      }
    });

    // Close burger on nav link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeBurgerMenu);
    });
  }

  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');
  if (contactForm && formStatus) {
    const submitButton = contactForm.querySelector('.form-submit');
    const defaultButtonText = submitButton ? submitButton.textContent : '';

    contactForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      const ui = getFormUiCopy();
      if (!contactForm.reportValidity()) {
        setFormStatus(formStatus, 'is-error', ui.validation);
        return;
      }
      const formData = new FormData(contactForm);
      const payload = {
        projectType: String(formData.get('project_type') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        contact: String(formData.get('contact') || '').trim(),
        companyWebsite: String(formData.get('company_website') || '').trim()
      };

      if (!payload.description || !payload.contact) {
        setFormStatus(formStatus, 'is-error', ui.validation);
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = ui.sending;
      }
      setFormStatus(formStatus, 'is-pending', ui.sending);

      try {
        const response = await fetch(contactForm.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 429) throw new Error(ui.rateLimit);
          if (response.status === 400) throw new Error(ui.validation);
          throw new Error(ui.error);
        }

        contactForm.reset();
        setFormStatus(formStatus, 'is-success', ui.success);
      } catch (error) {
        setFormStatus(formStatus, 'is-error', error && error.message ? error.message : ui.error);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = defaultButtonText;
        }
      }
    });
  }
});
