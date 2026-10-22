import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type MotionBoot = { recovered: boolean; timer: number };
declare global {
  interface Window {
    __diagramMotionBoot?: MotionBoot;
  }
}

const main = document.querySelector<HTMLElement>('#main');
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const boot = window.__diagramMotionBoot;
const introTargets = main ? Array.from(main.querySelectorAll<HTMLElement>(
  '.breadcrumbs li, .hero h1, .hero-art, .page-intro h1, .article-hero h1',
)) : [];
const originalStyles = new Map(introTargets.map(element => [element, element.getAttribute('style')]));
const articleHeadings = main
  ? Array.from(main.querySelectorAll<HTMLElement>('.article-main .prose h2'))
  : [];
const headingStyles = new Map<HTMLElement, string | null>();
const headingTweens: gsap.core.Tween[] = [];
const headingTriggers: ScrollTrigger[] = [];
const pressTargets = Array.from(document.querySelectorAll<HTMLElement>(
  '.primary-link, .card-link, .topic-row, .text-link, .header-inner nav a, .footer-links a',
));
const pressed = new Set<HTMLElement>();
let intro: gsap.core.Timeline | undefined;
let headingContext: gsap.Context | undefined;
let outro: gsap.core.Tween | undefined;
let navigationPending = false;
let navigationTimer = 0;

function restoreIntro() {
  const active = intro;
  intro = undefined;
  active?.kill();
  for (const [element, original] of originalStyles) {
    if (original === null) element.removeAttribute('style');
    else element.setAttribute('style', original);
  }
  releaseBoot();
  if (main) main.dataset.motionPhase = 'settled';
}

function releaseBoot() {
  if (boot) window.clearTimeout(boot.timer);
  document.documentElement.removeAttribute('data-motion-boot');
}

function restoreHeadingStyle(element: HTMLElement) {
  const original = headingStyles.get(element);
  if (original === null || original === undefined) element.removeAttribute('style');
  else element.setAttribute('style', original);
}

function restoreHeadingReveals() {
  headingContext?.revert();
  headingContext = undefined;
  for (const trigger of headingTriggers.splice(0)) trigger.kill();
  for (const tween of headingTweens.splice(0)) tween.kill();
  for (const element of headingStyles.keys()) restoreHeadingStyle(element);
  headingStyles.clear();
}

function startHeadingReveals() {
  if (preference.matches || !main || !articleHeadings.length || headingContext) return;
  try {
    for (const heading of articleHeadings) headingStyles.set(heading, heading.getAttribute('style'));
    const context = gsap.context(() => {
      for (const heading of articleHeadings) {
        gsap.set(heading, { autoAlpha: 0, y: 24, scale: 0.98, willChange: 'transform, opacity' });
        const tween = gsap.to(heading, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.62,
          ease: 'power3.out',
          paused: true,
          onComplete: () => restoreHeadingStyle(heading),
        });
        headingTweens.push(tween);
        headingTriggers.push(ScrollTrigger.create({
          trigger: heading,
          start: 'top 86%',
          once: true,
          onEnter: () => tween.play(0),
        }));
      }
    }, main);
    headingContext = context;
    void document.fonts.ready.then(() => {
      if (headingContext === context) ScrollTrigger.refresh();
    });
  } catch {
    restoreHeadingReveals();
  }
}

function settlePress(element: HTMLElement) {
  pressed.delete(element);
  gsap.killTweensOf(element);
  gsap.set(element, { clearProps: 'transform' });
}

function press(element: HTMLElement, immediate = false) {
  if (preference.matches || navigationPending || pressed.has(element)) return;
  pressed.add(element);
  if (immediate) gsap.set(element, { scale: 0.975 });
  else gsap.to(element, { scale: 0.975, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
}

function release(element: HTMLElement) {
  if (!pressed.delete(element)) return;
  if (preference.matches || navigationPending) {
    settlePress(element);
    return;
  }
  gsap.to(element, {
    scale: 1,
    duration: 0.22,
    ease: 'power3.out',
    overwrite: 'auto',
    onComplete: () => gsap.set(element, { clearProps: 'transform' }),
  });
}

for (const element of pressTargets) {
  element.addEventListener('pointerdown', event => {
    if (event.button === 0) press(element);
  });
  element.addEventListener('pointerup', () => release(element));
  element.addEventListener('pointercancel', () => release(element));
  element.addEventListener('pointerleave', () => release(element));
  element.addEventListener('keydown', event => {
    if (!event.repeat && event.key === 'Enter') press(element, true);
  });
  element.addEventListener('keyup', () => release(element));
  element.addEventListener('blur', () => release(element));
}

function startIntro() {
  if (!main) return;
  startHeadingReveals();
  if (preference.matches || boot?.recovered || document.documentElement.dataset.motionBoot !== 'pending') {
    restoreIntro();
    return;
  }
  try {
    intro = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: restoreIntro,
    });
    introTargets.forEach((element, index) => {
      const isDiagramArt = element.matches('.hero-art');
      const isBreadcrumb = element.matches('.breadcrumbs li');
      gsap.set(element, isBreadcrumb
        ? { autoAlpha: 0, x: -16, y: 5, willChange: 'transform, opacity' }
        : isDiagramArt
        ? { autoAlpha: 0, x: 18, y: 14, scale: 0.92, rotation: 2.5, willChange: 'transform, opacity' }
        : { autoAlpha: 0, y: 22, willChange: 'transform, opacity' });
      intro!.to(element, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        duration: isBreadcrumb ? 0.38 : isDiagramArt ? 0.72 : 0.56,
        ease: 'power3.out',
      }, index * 0.075);
    });
    main.dataset.motionPhase = 'entering';
    releaseBoot();
    if (!introTargets.length) restoreIntro();
  } catch {
    restoreIntro();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startIntro, { once: true });
else startIntro();

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor || anchor.hasAttribute('download') || anchor.target || preference.matches) return;
  const destination = new URL(anchor.href, location.href);
  if (destination.origin !== location.origin || destination.pathname === location.pathname && destination.search === location.search) return;
  if (!/^https?:$/.test(destination.protocol)) return;
  event.preventDefault();
  if (navigationPending) return;
  navigationPending = true;
  restoreIntro();
  restoreHeadingReveals();
  if (!main) {
    location.assign(destination.href);
    return;
  }
  let followed = false;
  const follow = () => {
    if (followed) return;
    followed = true;
    window.clearTimeout(navigationTimer);
    location.assign(destination.href);
  };
  navigationTimer = window.setTimeout(follow, 350);
  try {
    main.dataset.motionPhase = 'leaving';
    outro = gsap.to(main, { opacity: 0.38, y: -12, duration: 0.24, ease: 'power2.in', onComplete: follow });
  } catch {
    follow();
  }
});

function resetPage() {
  window.clearTimeout(navigationTimer);
  outro?.kill();
  outro = undefined;
  for (const element of pressTargets) settlePress(element);
  if (main) {
    gsap.set(main, { clearProps: 'opacity,transform' });
    main.dataset.motionPhase = 'settled';
  }
  restoreIntro();
  restoreHeadingReveals();
  navigationPending = false;
}

window.addEventListener('pagehide', resetPage);
window.addEventListener('pageshow', event => {
  if (event.persisted) resetPage();
});
preference.addEventListener('change', () => {
  if (!preference.matches) return;
  restoreIntro();
  restoreHeadingReveals();
  for (const element of pressTargets) settlePress(element);
  if (navigationPending) {
    outro?.progress(1);
  }
});
